from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import User, Alert
from app.models.schemas import AlertItem, AlertListResponse
from app.routers.auth import _require_user

router = APIRouter(tags=["alerts"])


@router.get("/alerts", response_model=AlertListResponse)
def list_alerts(user: User = Depends(_require_user), db: Session = Depends(get_db)):
    items = db.query(Alert).filter(Alert.user_id == user.id).order_by(Alert.created_at.desc()).limit(50).all()
    unread = sum(1 for a in items if not a.read)
    return AlertListResponse(
        alerts=[AlertItem(id=a.id, make=a.make, model=a.model, alert_type=a.alert_type, message=a.message, read=a.read, created_at=a.created_at.isoformat()) for a in items],
        unread_count=unread,
        total=len(items),
    )


@router.post("/alerts/{alert_id}/read", status_code=204)
def mark_read(alert_id: int, user: User = Depends(_require_user), db: Session = Depends(get_db)):
    entry = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == user.id).first()
    if entry:
        entry.read = True
        db.commit()


@router.post("/alerts/read-all", status_code=204)
def mark_all_read(user: User = Depends(_require_user), db: Session = Depends(get_db)):
    db.query(Alert).filter(Alert.user_id == user.id, Alert.read == False).update({"read": True})
    db.commit()
