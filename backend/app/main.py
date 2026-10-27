import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from app.routers import query, models, health, compare, market, recommend, public, auth, watchlist, saved_searches, alerts, dashboard, admin_auth, admin_users, admin_kb, admin_sync, admin_failures, admin_playground, whatsapp
from app.config import settings
from app.db.database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create DB tables on startup - non-fatal so the app works without a DB
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:
    logger.warning(f"DB init skipped: {exc}")

# Self-healing admin seed. The default SQLite file lives on ephemeral disk
# and is wiped on every deploy - along with any admin created via shell.
# If ADMIN_EMAIL + ADMIN_PASSWORD are set, ensure that admin exists on every
# startup. Never touches an existing account (no password overwrites).
try:
    from app.db.database import SessionLocal
    from app.db.models import AdminUser
    from app.services.admin_auth import hash_password

    _seed_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    _seed_password = os.getenv("ADMIN_PASSWORD", "")
    if _seed_email and _seed_password:
        if len(_seed_password) < 8:
            logger.warning("Admin seed skipped: ADMIN_PASSWORD must be at least 8 characters")
        else:
            _db = SessionLocal()
            try:
                if not _db.query(AdminUser).filter(AdminUser.email == _seed_email).first():
                    _db.add(AdminUser(
                        email=_seed_email,
                        password_hash=hash_password(_seed_password),
                        role="admin",
                    ))
                    _db.commit()
                    logger.info(f"Seeded admin user {_seed_email}")
            finally:
                _db.close()
except Exception as exc:
    logger.warning(f"Admin seed skipped: {exc}")

# One-line admin auth readiness so misconfiguration is visible at startup
# instead of surfacing as a bare 500 on first login.
if settings.environment == "production":
    for _name in ("jwt_secret", "dashboard_token", "ip_hash_salt"):
        if getattr(settings, _name) in ("", "change-me"):
            logger.warning(f"SECURITY: {_name.upper()} is not set - set a long random value in Render")

try:
    from app.services.admin_auth import auth_status

    logger.info(f"Admin auth {auth_status()}")
except Exception as exc:
    logger.warning(f"Admin auth status unknown: {exc}")

# Self-healing KB seed. The KB tables are empty on a fresh database (and
# ephemeral SQLite wipes them on every deploy), which leaves the admin
# Knowledge Base page blank. Seed from the JSON files only when empty -
# never touches existing rows. Same code path as scripts/import_json_to_db.py.
try:
    from pathlib import Path

    from app.db.database import SessionLocal
    from app.db.models import KbModel
    from app.services import kb_admin as _kb_seed

    _db = SessionLocal()
    try:
        if _db.query(KbModel).count() == 0:
            _kb_dir = Path(__file__).parent.parent / "knowledge_base" / "cars"
            seeded = _kb_seed.seed_from_json_files(_db, _kb_dir)
            logger.info(f"Seeded {len(seeded)} KB models from JSON")
    finally:
        _db.close()
except Exception as exc:
    logger.warning(f"KB seed skipped: {exc}")

# Interactive docs + schema are a full map of the API - development only
_dev = settings.environment == "development"
app = FastAPI(
    title="CarIQ API",
    version="1.0.0",
    docs_url="/docs" if _dev else None,
    redoc_url="/redoc" if _dev else None,
    openapi_url="/openapi.json" if _dev else None,
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment != "development":
            if request.url.path == "/api/v1/dashboard":
                # The cost dashboard is a single self-contained HTML page with
                # inline <style>/<script>; 'self' alone would block both.
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; "
                    "style-src 'self' 'unsafe-inline'"
                )
            else:
                response.headers["Content-Security-Policy"] = "default-src 'self'"
        if request.url.path.startswith("/api/v1/admin/"):
            # Admin responses must never be cached anywhere.
            response.headers["Cache-Control"] = "no-store"
        return response


app.add_middleware(SecurityHeadersMiddleware)

origins = (
    ["*"]
    if settings.environment == "development"
    else [settings.frontend_url]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)

app.include_router(health.router)
app.include_router(query.router, prefix="/api/v1")
app.include_router(whatsapp.router, prefix="/api/v1")
app.include_router(models.router, prefix="/api/v1")
app.include_router(compare.router, prefix="/api/v1")
app.include_router(market.router, prefix="/api/v1")
app.include_router(recommend.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(watchlist.router, prefix="/api/v1")
app.include_router(saved_searches.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(admin_auth.router, prefix="/api/v1/admin")
app.include_router(admin_users.router, prefix="/api/v1/admin")
app.include_router(admin_kb.router, prefix="/api/v1/admin")
app.include_router(admin_sync.router, prefix="/api/v1/admin")
app.include_router(admin_failures.router, prefix="/api/v1/admin")
app.include_router(admin_playground.router, prefix="/api/v1/admin")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )
