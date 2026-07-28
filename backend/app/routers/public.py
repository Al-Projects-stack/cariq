import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
from app.services.cache import all_models_cache

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
    cached = all_models_cache.get("all_cars")
    if cached is None:
        cars = []
        if KB_DIR.exists():
            for fp in sorted(KB_DIR.glob("*.json")):
                try:
                    with open(fp, encoding="utf-8") as f:
                        cars.append(json.load(f))
                except Exception:
                    continue
        all_models_cache.set("all_cars", cars)
    else:
        cars = cached

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
    for fp in KB_DIR.glob("*.json"):
        try:
            with open(fp, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        if data["make"].lower() == make.lower() and data["model"].lower().replace(" ", "_") == needle:
            return data
    raise HTTPException(404, detail=f"Model '{make} {model}' not found")
