from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import User, Watchlist
from app.models.schemas import WatchlistItem, WatchlistCreate, WatchlistResponse
from app.routers.auth import _require_user
from app.routers.models import _load_all_cars

router = APIRouter(tags=["watchlist"])

MAX_WATCHLIST_ITEMS = 100


@router.get("/watchlist", response_model=WatchlistResponse)
def list_watchlist(user: User = Depends(_require_user), db: Session = Depends(get_db)):
    items = db.query(Watchlist).filter(Watchlist.user_id == user.id).order_by(Watchlist.created_at.desc()).all()
    return WatchlistResponse(
        items=[WatchlistItem(id=i.id, make=i.make, model=i.model, created_at=i.created_at.isoformat()) for i in items],
        total=len(items),
    )


@router.post("/watchlist", response_model=WatchlistItem)
def add_watchlist(body: WatchlistCreate, user: User = Depends(_require_user), db: Session = Depends(get_db)):
    # Only real KB models - stops the table being filled with junk rows
    if not any(
        c["make"].lower() == body.make.lower() and c["model"].lower() == body.model.lower()
        for c in _load_all_cars()
    ):
        raise HTTPException(404, detail="Unknown model")
    if db.query(Watchlist).filter(Watchlist.user_id == user.id).count() >= MAX_WATCHLIST_ITEMS:
        raise HTTPException(400, detail=f"Watchlist is full ({MAX_WATCHLIST_ITEMS} models)")
    existing = db.query(Watchlist).filter(
        Watchlist.user_id == user.id,
        Watchlist.make == body.make,
        Watchlist.model == body.model,
    ).first()
    if existing:
        raise HTTPException(409, detail="Already watching this model")
    entry = Watchlist(user_id=user.id, make=body.make, model=body.model)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return WatchlistItem(id=entry.id, make=entry.make, model=entry.model, created_at=entry.created_at.isoformat())


@router.delete("/watchlist/{watch_id}", status_code=204)
def remove_watchlist(watch_id: int, user: User = Depends(_require_user), db: Session = Depends(get_db)):
    entry = db.query(Watchlist).filter(Watchlist.id == watch_id, Watchlist.user_id == user.id).first()
    if not entry:
        raise HTTPException(404, detail="Watchlist entry not found")
    db.delete(entry)
    db.commit()
