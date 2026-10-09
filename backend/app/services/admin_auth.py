"""Admin authentication: short-lived JWT access cookies, rotating refresh
cookies, CSRF double-submit tokens, and brute-force lockout.

Separate from the public user auth (Bearer tokens) on purpose: the admin
area has stricter transport rules (httpOnly + SameSite=Strict cookies).
"""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Request, Response
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import AdminRefreshToken, AdminUser, AuditLog

logger = logging.getLogger(__name__)

ALGO = "HS256"
ACCESS_TTL = timedelta(minutes=15)
REFRESH_TTL = timedelta(days=7)
MAX_FAILED_ATTEMPTS = 10
LOCKOUT_DURATION = timedelta(minutes=15)

ACCESS_COOKIE = "cariq_admin"
REFRESH_COOKIE = "cariq_admin_refresh"
CSRF_COOKIE = "cariq_admin_csrf"
REFRESH_PATH = "/api/v1/admin/auth/refresh"

# Same generic message for unknown user, wrong password, locked, or disabled.
GENERIC_LOGIN_ERROR = "Invalid email or password"

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _jwt_secret() -> str:
    if settings.environment == "production" and settings.jwt_secret == "change-me":
        raise RuntimeError(
            f"JWT_SECRET is not configured (environment={settings.environment})"
        )
    return settings.jwt_secret


def auth_status() -> str:
    """One-line admin-auth readiness for startup logs. Never raises."""
    try:
        _jwt_secret()
        return f"armed (environment={settings.environment})"
    except RuntimeError as exc:
        return f"NOT armed: {exc}"


def hash_password(password: str) -> str:
    return pwd.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd.verify(password, password_hash)
    except Exception:
        return False


def _encode(payload: dict) -> str:
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGO)


def create_access_token(user: AdminUser) -> str:
    return _encode({
        "sub": user.id,
        "role": user.role,
        "type": "access",
        "exp": _utcnow() + ACCESS_TTL,
    })


def create_refresh_token(db: Session, user: AdminUser) -> str:
    raw = secrets.token_hex(32)
    db.add(AdminRefreshToken(
        admin_user_id=user.id,
        token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        expires_at=_utcnow() + REFRESH_TTL,
    ))
    db.commit()
    return _encode({
        "sub": user.id,
        "type": "refresh",
        "jti": raw,
        "exp": _utcnow() + REFRESH_TTL,
    })


def _cookie_samesite() -> str:
    # Production serves the UI and API on different domains: browsers never
    # send SameSite=Strict cookies on cross-origin requests, which silently
    # breaks every authenticated call. Same-origin dev keeps Strict.
    return "none" if settings.environment == "production" else "strict"


def _cookie_secure() -> bool:
    # SameSite=None is rejected by browsers without Secure. Plain
    # http://localhost is a secure context, so this also covers local dev.
    return True if _cookie_samesite() == "none" else settings.environment == "production"


def set_auth_cookies(response: Response, access: str, refresh: str) -> str:
    """Set the three auth cookies. Returns the CSRF token for the response body.

    Mutations stay protected by the double-submit CSRF token regardless of
    SameSite mode.
    """
    csrf = secrets.token_hex(16)
    secure = _cookie_secure()
    samesite = _cookie_samesite()
    response.set_cookie(
        ACCESS_COOKIE, access, max_age=15 * 60, httponly=True,
        secure=secure, samesite=samesite, path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE, refresh, max_age=7 * 24 * 3600, httponly=True,
        secure=secure, samesite=samesite, path=REFRESH_PATH,
    )
    response.set_cookie(
        CSRF_COOKIE, csrf, max_age=7 * 24 * 3600, httponly=False,
        secure=secure, samesite=samesite, path="/",
    )
    return csrf


def clear_auth_cookies(response: Response) -> None:
    for name, path in ((ACCESS_COOKIE, "/"), (REFRESH_COOKIE, REFRESH_PATH), (CSRF_COOKIE, "/")):
        response.delete_cookie(name, path=path)


def audit(db: Session, actor: str, action: str, model_slug: str | None = None, detail: str | None = None) -> None:
    """Best-effort audit write: a logging failure must never break the request."""
    try:
        db.add(AuditLog(actor=actor, action=action, model_slug=model_slug, detail=detail))
        db.commit()
    except Exception as exc:
        logger.warning(f"Audit log write skipped: {exc}")


def get_current_admin(request: Request, db: Session) -> AdminUser | None:
    """Return the logged-in admin, or None. No exceptions: callers map to 401."""
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        return None
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGO])
        if payload.get("type") != "access":
            return None
        user = db.query(AdminUser).filter(AdminUser.id == payload["sub"]).first()
        if not user or user.disabled:
            return None
        return user
    except Exception:
        return None


def check_csrf(request: Request) -> bool:
    """Double-submit check: header must match the readable CSRF cookie."""
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get("x-csrf-token")
    return bool(cookie) and bool(header) and secrets.compare_digest(cookie, header)


def is_locked(user: AdminUser) -> bool:
    if not user.locked_until:
        return False
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    return locked_until > _utcnow()


def record_failed_login(db: Session, user: AdminUser) -> None:
    user.failed_attempts = (user.failed_attempts or 0) + 1
    if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = _utcnow() + LOCKOUT_DURATION
        audit(db, user.email, "admin.lockout", detail=f"{user.failed_attempts} failed attempts")
    db.commit()


def record_successful_login(db: Session, user: AdminUser) -> None:
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()
