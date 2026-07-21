import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.models.schemas import RecommendRequest, RecommendResponse, RecommendModel

router = APIRouter(tags=["recommend"])

KB_DIR = Path(__file__).parent.parent.parent / "knowledge_base" / "cars"

BODY_MAP = {
    "any": None,
    "hatchback": ["compact_hatchback", "premium_hatchback"],
    "suv": ["compact_suv", "bakkie"],
    "bakkie": ["bakkie"],
    "sedan": ["premium_hatchback"],
}


def _load_all() -> list[dict]:
    cars = []
    if not KB_DIR.exists():
        return cars
    for fp in sorted(KB_DIR.glob("*.json")):
        try:
            with open(fp, encoding="utf-8") as f:
                cars.append(json.load(f))
        except Exception:
            continue
    return cars


def _latest_mid(raw: dict) -> int | None:
    ranges = raw.get("price_ranges", [])
    if not ranges:
        return None
    latest = max(ranges, key=lambda r: r["year_to"])
    return latest.get("mid_zar")


@router.post("/recommend", response_model=RecommendResponse)
def recommend(body: RecommendRequest):
    all_cars = _load_all()

    segments = BODY_MAP.get(body.body_type or "any")
    scored: list[tuple[dict, float, list[str]]] = []

    for car in all_cars:
        mid = _latest_mid(car)
        if mid is None:
            continue

        if mid < body.budget_min or mid > body.budget_max:
            continue

        if segments and car.get("segment") not in segments:
            continue

        reasons = []
        score = 0.0

        for pri in body.priorities[:3]:
            if pri == "reliability":
                rel = car.get("reliability_score", 5.0)
                score += rel * 0.4
                if rel >= 8.5:
                    reasons.append("Excellent reliability record")
                elif rel >= 7.0:
                    reasons.append("Above average reliability")

            elif pri == "fuel_economy":
                cons = car.get("fuel_consumption_l_per_100km", 8.0)
                eff = max(0, 10 - cons)
                score += eff * 0.3
                if cons <= 5.5:
                    reasons.append("Excellent fuel economy")
                elif cons <= 6.5:
                    reasons.append("Good fuel economy")

            elif pri == "low_maintenance":
                maint = car.get("annual_maintenance_zar", 10000)
                aff = max(0, 20 - maint / 1000)
                score += aff * 0.2
                if maint <= 6000:
                    reasons.append("Very affordable maintenance")
                elif maint <= 10000:
                    reasons.append("Moderate maintenance costs")

            elif pri == "resale_value":
                rel = car.get("reliability_score", 5.0)
                score += rel * 0.3
                if rel >= 8.5 or car.get("make") in ("Toyota", "Volkswagen"):
                    reasons.append("Strong resale value")

            elif pri == "performance":
                cons = car.get("fuel_consumption_l_per_100km", 8.0)
                perf = max(0, 12 - cons)
                score += perf * 0.2
                if "GTI" in str(car.get("variants", [])) or "R" in str(car.get("variants", [])):
                    reasons.append("Performance variant available")

        if not reasons:
            reasons.append("Fits your budget")

        scored.append((car, round(score, 1), reasons))

    if not scored:
        return RecommendResponse(recommendations=[], total_count=0)

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:5]

    results = []
    for car, score, reasons in top:
        mid = _latest_mid(car)
        results.append(RecommendModel(
            make=car["make"],
            model=car["model"],
            segment=car.get("segment", ""),
            mid_zar=mid or 0,
            reliability_score=car.get("reliability_score", 0.0),
            score=score,
            match_reasons=reasons[:3],
        ))

    return RecommendResponse(recommendations=results, total_count=len(scored))
