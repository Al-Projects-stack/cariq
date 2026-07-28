from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import User, SavedSearch
from app.models.schemas import SavedSearchItem, SavedSearchCreate, SavedSearchResponse
from app.routers.auth import _require_user

router = APIRouter(tags=["saved_searches"])


@router.get("/saved-searches", response_model=SavedSearchResponse)
def list_saved(user: User = Depends(_require_user), db: Session = Depends(get_db)):
    items = db.query(SavedSearch).filter(SavedSearch.user_id == user.id).order_by(SavedSearch.created_at.desc()).all()
    return SavedSearchResponse(
        items=[SavedSearchItem(id=i.id, label=i.label, query=i.query, filters=i.filters, created_at=i.created_at.isoformat()) for i in items],
        total=len(items),
    )


@router.post("/saved-searches", response_model=SavedSearchItem)
def save_search(body: SavedSearchCreate, user: User = Depends(_require_user), db: Session = Depends(get_db)):
    entry = SavedSearch(user_id=user.id, label=body.label, query=body.query, filters=body.filters)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return SavedSearchItem(id=entry.id, label=entry.label, query=entry.query, filters=entry.filters, created_at=entry.created_at.isoformat())


@router.delete("/saved-searches/{search_id}", status_code=204)
def delete_saved(search_id: int, user: User = Depends(_require_user), db: Session = Depends(get_db)):
    entry = db.query(SavedSearch).filter(SavedSearch.id == search_id, SavedSearch.user_id == user.id).first()
    if not entry:
        return
    db.delete(entry)
    db.commit()
