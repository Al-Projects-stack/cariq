import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from app.routers import query, models, health
from app.config import settings
from app.db.database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create DB tables on startup — non-fatal so the app works without a DB
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:
    logger.warning(f"DB init skipped: {exc}")

app = FastAPI(title="CarIQ API", version="1.0.0", docs_url="/docs", redoc_url="/redoc")

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
            response.headers["Content-Security-Policy"] = "default-src 'self'"
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
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(health.router)
app.include_router(query.router, prefix="/api/v1")
app.include_router(models.router, prefix="/api/v1")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )
