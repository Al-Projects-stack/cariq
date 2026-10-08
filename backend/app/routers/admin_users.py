from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AdminUser
from app.routers.admin_auth import require_admin_role, require_csrf
from app.services import admin_auth as auth_svc

router = APIRouter(tags=["admin-users"])


class AdminUserCreate(BaseModel):
    model_config = {"extra": "forbid"}

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=200)
    role: str = Field(default="editor", pattern="^(admin|editor)$")


class AdminUserUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    disabled: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)


class AdminUserOut(BaseModel):
    id: int
    email: str
    role: str
    disabled: bool


def _out(user: AdminUser) -> AdminUserOut:
    return AdminUserOut(id=user.id, email=user.email, role=user.role, disabled=user.disabled)


@router.get("/users", response_model=list[AdminUserOut])
def list_admin_users(
    admin: AdminUser = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    return [_out(u) for u in db.query(AdminUser).order_by(AdminUser.id).all()]


@router.post("/users", response_model=AdminUserOut)
def create_admin_user(
    body: AdminUserCreate,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()
    if db.query(AdminUser).filter(AdminUser.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = AdminUser(email=email, password_hash=auth_svc.hash_password(body.password), role=body.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    auth_svc.audit(db, admin.email, "admin.user_create", detail=f"{email} role={body.role}")
    return _out(user)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_admin_user(
    user_id: int,
    body: AdminUserUpdate,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and body.disabled:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    if body.disabled is not None:
        user.disabled = body.disabled
    if body.password:
        user.password_hash = auth_svc.hash_password(body.password)
        user.failed_attempts = 0
        user.locked_until = None
    db.commit()
    db.refresh(user)
    auth_svc.audit(db, admin.email, "admin.user_update", detail=f"{user.email}")
    return _out(user)
