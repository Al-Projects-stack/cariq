import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.models.schemas import CarProfile, CarVariant
from app.services.cache import all_models_cache, model_profile_cache

router = APIRouter(tags=["models"])

KB_DIR = Path(__file__).parent.parent.parent / "knowledge_base" / "cars"


def _load_all_cars() -> list[dict]:
    cached = all_models_cache.get("all_cars")
    if cached is not None:
        return cached
    cars = []
    if not KB_DIR.exists():
        return cars
    for fp in sorted(KB_DIR.glob("*.json")):
        try:
            with open(fp, encoding="utf-8") as f:
                cars.append(json.load(f))
        except Exception:
            continue
    all_models_cache.set("all_cars", cars)
    return cars


@router.get("/models", response_model=list[CarVariant])
def list_models():
    cars = _load_all_cars()
    return [
        CarVariant(
            make=c["make"],
            model=c["model"],
            variants=c.get("variants", []),
            years_covered=c.get("years_covered", ""),
            reliability_score=c.get("reliability_score", 0.0),
            sa_market_summary=c.get("sa_market_summary", ""),
        )
        for c in cars
    ]


@router.get("/models/{make}/{model}", response_model=CarProfile)
def get_model_profile(make: str, model: str):
    cache_key = f"{make.lower()}|{model.lower()}"
    cached = model_profile_cache.get(cache_key)
    if cached is not None:
        return CarProfile(**cached)

    cars = _load_all_cars()
    for car in cars:
        if (
            car["make"].lower() == make.lower()
            and car["model"].lower().replace(" ", "_") == model.lower().replace(" ", "_")
        ):
            model_profile_cache.set(cache_key, car)
            return CarProfile(**car)

    raise HTTPException(
        status_code=404,
        detail=f"Model '{make} {model}' not found in knowledge base.",
    )
