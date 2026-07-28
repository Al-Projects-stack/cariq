import os
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
from app.db.database import get_db
from app.db.models import User
from app.models.schemas import SignupRequest, LoginRequest, AuthResponse, UserProfile
from app.config import settings

router = APIRouter(tags=["auth"])

SECRET = os.getenv("JWT_SECRET", settings.database_url)
ALGO = "HS256"
TOKEN_TTL = timedelta(days=7)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _token_for(user: User) -> str:
    return jwt.encode(
        {"sub": user.id, "email": user.email, "exp": datetime.utcnow() + TOKEN_TTL},
        SECRET,
        algorithm=ALGO,
    )


def _require_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> User:
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if not user:
            raise ValueError
        return user
    except Exception:
        raise HTTPException(401, detail="Invalid or expired token")


@router.post("/auth/signup", response_model=AuthResponse)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, detail="Email already registered")
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
def login(body: LoginRequest, db: Session = Depends(get_db)):
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
