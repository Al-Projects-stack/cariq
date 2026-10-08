import hashlib
import logging
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AdminRefreshToken, AdminUser
from app.services import admin_auth as auth_svc
from app.services.admin_auth import GENERIC_LOGIN_ERROR

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["admin-auth"])


class AdminLoginRequest(BaseModel):
    model_config = {"extra": "forbid"}

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=200)


class AdminSessionResponse(BaseModel):
    email: str
    role: str
    csrf_token: str = ""


def _forbidden_csrf() -> HTTPException:
    return HTTPException(status_code=403, detail="CSRF validation failed")


def require_admin_user(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    """Any authenticated admin (admin or editor role)."""
    user = auth_svc.get_current_admin(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_admin_role(user: AdminUser = Depends(require_admin_user)) -> AdminUser:
    """Admin role only. Editors are rejected here, in the backend."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


def require_csrf(request: Request) -> None:
    if not auth_svc.check_csrf(request):
        raise _forbidden_csrf()


@router.post("/auth/login", response_model=AdminSessionResponse)
@limiter.limit("5/minute")
def admin_login(
    request: Request,
    body: AdminLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        email = body.email.strip().lower()
        user = db.query(AdminUser).filter(AdminUser.email == email).first()
        if not user or user.disabled or auth_svc.is_locked(user):
            if user and not user.disabled:
                auth_svc.record_failed_login(db, user)
            raise ValueError(GENERIC_LOGIN_ERROR)
        if not auth_svc.verify_password(body.password, user.password_hash):
            auth_svc.record_failed_login(db, user)
            raise ValueError(GENERIC_LOGIN_ERROR)
        auth_svc.record_successful_login(db, user)
        access = auth_svc.create_access_token(user)
        refresh = auth_svc.create_refresh_token(db, user)
        csrf = auth_svc.set_auth_cookies(response, access, refresh)
        auth_svc.audit(db, user.email, "admin.login")
        return AdminSessionResponse(email=user.email, role=user.role, csrf_token=csrf)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Admin login misconfigured: {e}")
        raise HTTPException(status_code=500, detail="Authentication is not configured")


@router.post("/auth/refresh", response_model=AdminSessionResponse)
def admin_refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    if not auth_svc.check_csrf(request):
        raise _forbidden_csrf()
    token = request.cookies.get(auth_svc.REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, auth_svc._jwt_secret(), algorithms=[auth_svc.ALGO])
        if payload.get("type") != "refresh":
            raise ValueError("Not authenticated")
        row = (
            db.query(AdminRefreshToken)
            .filter(AdminRefreshToken.token_hash == hashlib.sha256(payload["jti"].encode()).hexdigest())
            .first()
        )
        user = db.query(AdminUser).filter(AdminUser.id == payload["sub"]).first()
        if not row or row.revoked or not user or user.disabled:
            raise ValueError("Not authenticated")
        # Rotate: revoke the used token, issue a fresh pair.
        row.revoked = True
        access = auth_svc.create_access_token(user)
        refresh = auth_svc.create_refresh_token(db, user)
        csrf = auth_svc.set_auth_cookies(response, access, refresh)
        return AdminSessionResponse(email=user.email, role=user.role, csrf_token=csrf)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")


@router.post("/auth/logout")
def admin_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    if not auth_svc.check_csrf(request):
        raise _forbidden_csrf()
    token = request.cookies.get(auth_svc.REFRESH_COOKIE)
    if token:
        try:
            payload = jwt.decode(token, auth_svc._jwt_secret(), algorithms=[auth_svc.ALGO])
            row = (
                db.query(AdminRefreshToken)
                .filter(AdminRefreshToken.token_hash == hashlib.sha256(payload.get("jti", "").encode()).hexdigest())
                .first()
            )
            if row:
                row.revoked = True
                db.commit()
        except Exception:
            pass
    auth_svc.clear_auth_cookies(response)
    return {"ok": True}


@router.get("/auth/me", response_model=AdminSessionResponse)
def admin_me(user: AdminUser = Depends(require_admin_user)):
    return AdminSessionResponse(email=user.email, role=user.role)
