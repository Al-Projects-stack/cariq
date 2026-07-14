import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.models.schemas import MarketPositionResponse, SegmentModelPrice

router = APIRouter(tags=["market"])

KB_DIR = Path(__file__).parent.parent.parent / "knowledge_base" / "cars"

SEGMENT_LABELS = {
    "bakkie": "Bakkies & SUVs",
    "compact_hatchback": "Compact Hatchbacks",
    "premium_hatchback": "Premium Hatchbacks & Sedans",
    "compact_suv": "Compact SUVs",
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


@router.get("/models/{make}/{model}/market-position", response_model=MarketPositionResponse)
def market_position(make: str, model: str):
    all_cars = _load_all()

    target: dict | None = None
    for c in all_cars:
        if c["make"].lower() == make.lower() and c["model"].lower().replace(" ", "_") == model.lower().replace(" ", "_"):
            target = c
            break

    if not target:
        raise HTTPException(404, detail=f"Model '{make} {model}' not found")

    segment = target.get("segment", "")
    if not segment:
        raise HTTPException(400, detail="Model has no segment classification")

    target_mid = _latest_mid(target)
    if target_mid is None:
        raise HTTPException(400, detail="Model has no price data")

    peers_raw = [c for c in all_cars if c.get("segment") == segment]
    peers: list[dict] = []
    for c in peers_raw:
        mid = _latest_mid(c)
        if mid is not None:
            peers.append({"make": c["make"], "model": c["model"], "mid_zar": mid, "reliability_score": c.get("reliability_score", 0.0)})

    peers.sort(key=lambda p: p["mid_zar"])

    mids = [p["mid_zar"] for p in peers]
    avg_mid = sum(mids) / len(mids) if mids else 0
    low_mid = min(mids) if mids else 0
    high_mid = max(mids) if mids else 0

    rank = 1
    for p in peers:
        if p["mid_zar"] <= target_mid:
            rank = peers.index(p) + 1

    total = len(peers)
    rank_ord = {1: "cheapest", 2: "2nd", 3: "3rd"}.get(rank, f"{rank}th")
    price_ranking = f"{rank_ord} of {total}"

    percentile = ((rank - 1) / (total - 1) * 100) if total > 1 else 50

    if percentile < 33:
        value_label = "Budget Friendly"
    elif percentile < 66:
        value_label = "Mid Range"
    else:
        value_label = "Premium"

    if target_mid < avg_mid * 0.95:
        position_label = "Below Average"
    elif target_mid > avg_mid * 1.05:
        position_label = "Above Average"
    else:
        position_label = "At Average"

    return MarketPositionResponse(
        segment=segment,
        segment_label=SEGMENT_LABELS.get(segment, segment),
        target_mid_zar=target_mid,
        segment_avg_mid_zar=round(avg_mid),
        segment_low_mid_zar=low_mid,
        segment_high_mid_zar=high_mid,
        segment_count=total,
        price_ranking=price_ranking,
        price_percentile=round(percentile, 1),
        position_label=position_label,
        value_label=value_label,
        peers=[SegmentModelPrice(**p) for p in peers],
    )
