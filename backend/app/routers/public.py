from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
from app.routers.models import _load_all_cars

router = APIRouter(tags=["public"])

KB_DIR = Path(__file__).parent.parent.parent / "knowledge_base" / "cars"

limiter = Limiter(key_func=get_remote_address)


class PublicModelItem(BaseModel):
    make: str
    model: str
    segment: str
    reliability_score: float
    years_covered: str
    variants: list[str]
    mid_zar: int | None = None


@router.get("/public/models")
@limiter.limit("5/minute")
async def public_list_models(request: Request):
    # Shared loader (and cache entry): prices are aged to today
    cars = _load_all_cars()

    result = []
    for c in cars:
        price = c.get("price_ranges", [])
        mid = None
        if price:
            latest = max(price, key=lambda r: r["year_to"])
            mid = latest.get("mid_zar")
        result.append(PublicModelItem(
            make=c["make"],
            model=c["model"],
            segment=c.get("segment", ""),
            reliability_score=c.get("reliability_score", 0.0),
            years_covered=c.get("years_covered", ""),
            variants=c.get("variants", []),
            mid_zar=mid,
        ))
    return {"models": result, "total": len(result)}


@router.get("/public/models/{make}/{model}")
@limiter.limit("5/minute")
async def public_get_model(request: Request, make: str, model: str):
    needle = model.lower().replace(" ", "_")
    if not KB_DIR.exists():
        raise HTTPException(500, detail="Knowledge base not found")
    for data in _load_all_cars():
        if data["make"].lower() == make.lower() and data["model"].lower().replace(" ", "_") == needle:
            return data
    raise HTTPException(404, detail=f"Model '{make} {model}' not found")
