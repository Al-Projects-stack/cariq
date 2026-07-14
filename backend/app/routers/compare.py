import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    CompareRequest,
    CompareResponse,
    CarProfile,
    CarPriceRange,
    CarFault,
    PriceComparison,
    ReliabilityComparison,
    FaultsComparison,
)

router = APIRouter(tags=["compare"])

KB_DIR = Path(__file__).parent.parent.parent / "knowledge_base" / "cars"


def _load_profile(make: str, model: str) -> dict:
    needle = model.lower().replace(" ", "_")
    if not KB_DIR.exists():
        raise HTTPException(500, detail="Knowledge base not found")
    for fp in KB_DIR.glob("*.json"):
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        if data["make"].lower() == make.lower() and data["model"].lower().replace(" ", "_") == needle:
            return data
    raise HTTPException(404, detail=f"Model '{make} {model}' not found")


def _latest_price_range(ranges: list[dict]) -> dict | None:
    return max(ranges, key=lambda r: r["year_to"]) if ranges else None


def _extract_zar(raw: str | int) -> int:
    if isinstance(raw, int):
        return raw
    cleaned = raw.replace("R", "").replace(",", "").replace(" ", "").split(" - ")[0]
    try:
        return int(cleaned)
    except ValueError:
        return 0


@router.post("/compare", response_model=CompareResponse)
def compare_models(body: CompareRequest):
    a_raw = _load_profile(body.make_a, body.model_a)
    b_raw = _load_profile(body.make_b, body.model_b)

    a_prof = CarProfile(**a_raw)
    b_prof = CarProfile(**b_raw)

    a_price = _latest_price_range(a_raw.get("price_ranges", []))
    b_price = _latest_price_range(b_raw.get("price_ranges", []))

    a_mid = a_price["mid_zar"] if a_price else 0
    b_mid = b_price["mid_zar"] if b_price else 0

    if a_mid < b_mid:
        price_leader = f"{a_raw['make']} {a_raw['model']}"
        price_gap = b_mid - a_mid
    else:
        price_leader = f"{b_raw['make']} {b_raw['model']}"
        price_gap = a_mid - b_mid

    a_score = a_raw.get("reliability_score", 0.0)
    b_score = b_raw.get("reliability_score", 0.0)
    if a_score > b_score:
        rel_winner = f"{a_raw['make']} {a_raw['model']}"
        rel_gap = round(a_score - b_score, 1)
    else:
        rel_winner = f"{b_raw['make']} {b_raw['model']}"
        rel_gap = round(b_score - a_score, 1)

    def count_severity(faults: list[dict]) -> tuple[int, int, int, int]:
        h = sum(1 for f in faults if f.get("severity", "").upper() == "HIGH")
        m = sum(1 for f in faults if f.get("severity", "").upper() == "MEDIUM")
        l_ = sum(1 for f in faults if f.get("severity", "").upper() == "LOW")
        return len(faults), h, m, l_

    a_faults_raw = a_raw.get("known_faults", [])
    b_faults_raw = b_raw.get("known_faults", [])

    return CompareResponse(
        model_a=a_prof,
        model_b=b_prof,
        reliability=ReliabilityComparison(
            a_score=a_score,
            b_score=b_score,
            winner=rel_winner,
            gap=rel_gap,
        ),
        price=PriceComparison(
            a_mid_zar=a_price["mid_zar"] if a_price else 0,
            a_low_zar=a_price["low_zar"] if a_price else 0,
            a_high_zar=a_price["high_zar"] if a_price else 0,
            b_mid_zar=b_price["mid_zar"] if b_price else 0,
            b_low_zar=b_price["low_zar"] if b_price else 0,
            b_high_zar=b_price["high_zar"] if b_price else 0,
            price_leader=price_leader,
            price_gap_zar=price_gap,
        ),
        faults=FaultsComparison(
            a_total=count_severity(a_faults_raw)[0],
            a_high=count_severity(a_faults_raw)[1],
            a_medium=count_severity(a_faults_raw)[2],
            a_low=count_severity(a_faults_raw)[3],
            b_total=count_severity(b_faults_raw)[0],
            b_high=count_severity(b_faults_raw)[1],
            b_medium=count_severity(b_faults_raw)[2],
            b_low=count_severity(b_faults_raw)[3],
        ),
    )
