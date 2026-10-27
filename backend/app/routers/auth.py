from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
from app.db.database import get_db
from app.db.models import User
from app.models.schemas import SignupRequest, LoginRequest, AuthResponse, UserProfile
from app.config import settings
from app.services import usage_guard

router = APIRouter(tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

ALGO = "HS256"
TOKEN_TTL = timedelta(days=7)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _secret() -> str:
    # Never fall back to a guessable value: a known secret lets anyone forge
    # user tokens. Same rule as the admin auth service.
    if settings.environment == "production" and settings.jwt_secret == "change-me":
        raise HTTPException(503, detail="Authentication is not configured")
    return settings.jwt_secret


def _token_for(user: User) -> str:
    return jwt.encode(
        {"sub": user.id, "email": user.email, "exp": datetime.now(timezone.utc) + TOKEN_TTL},
        _secret(),
        algorithm=ALGO,
    )


def _require_user(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization:
        raise HTTPException(401, detail="Missing authorization header")
    secret = _secret()
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError
        payload = jwt.decode(token, secret, algorithms=[ALGO])
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if not user:
            raise ValueError
        return user
    except Exception:
        raise HTTPException(401, detail="Invalid or expired token")


def _optional_user(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> User | None:
    """Signed-in user if a valid token was sent, else None (never raises)."""
    if not authorization:
        return None
    try:
        return _require_user(authorization, db)
    except HTTPException:
        return None


@router.post("/auth/signup", response_model=AuthResponse)
@limiter.limit("5/minute")
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, detail="Email already registered")
    usage_guard.consume_signup()
    user = User(
        email=body.email,
        password_hash=pwd.hash(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(
        token=_token_for(user), user_id=user.id, email=user.email, display_name=user.display_name,
    )


@router.post("/auth/login", response_model=AuthResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not pwd.verify(body.password, user.password_hash):
        raise HTTPException(401, detail="Invalid email or password")
    return AuthResponse(
        token=_token_for(user), user_id=user.id, email=user.email, display_name=user.display_name,
    )


@router.get("/auth/me", response_model=UserProfile)
def me(user: User = Depends(_require_user)):
    return UserProfile(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at.isoformat(),
    )
