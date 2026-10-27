"""Keep knowledge-base prices current between manual verifications.

Each model records `prices_verified_at` (ISO date): the day someone last
checked its price bands against the market. Between checks, a fixed
model-year band keeps losing value as those cars get older, so every price
served to users is aged month by month along an SA used-car depreciation
curve. Prices are an estimate after ageing, never live listings: once a
model goes STALE_AFTER_DAYS without re-verification it is flagged so an
admin re-checks it, and ageing stops at MAX_AGEING_MONTHS so a forgotten
model can't drift arbitrarily far from reality.

Pure functions, no I/O: callers decide where prices come from.
"""
from copy import deepcopy
from datetime import date

STALE_AFTER_DAYS = 90
MAX_AGEING_MONTHS = 18

# Annual depreciation by vehicle age (years). Young cars lose value fastest;
# SA used-car values flatten out after roughly a decade.
DEPRECIATION_CURVE: list[tuple[float, float]] = [
    (3.0, 0.15),
    (6.0, 0.12),
    (10.0, 0.09),
    (float("inf"), 0.06),
]


def parse_date(value) -> date | None:
    if isinstance(value, date):
        return value
    if not isinstance(value, str) or not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def annual_rate(vehicle_age_years: float) -> float:
    for max_age, rate in DEPRECIATION_CURVE:
        if vehicle_age_years < max_age:
            return rate
    return DEPRECIATION_CURVE[-1][1]


def months_between(start: date, end: date) -> int:
    """Whole calendar months from start to end (0 if end is not later)."""
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(0, months)


def _vehicle_age(year_from: int, year_to: int, on: date) -> float:
    # Treat the band as one car built mid-way through its model years.
    mid_year = (year_from + year_to) / 2 + 0.5
    return max(0.0, on.year + (on.month - 1) / 12 - mid_year)


def ageing_factor(year_from: int, year_to: int, verified: date, today: date) -> float:
    """Multiplier (<= 1) for a band's verified prices on `today`."""
    months = min(months_between(verified, today), MAX_AGEING_MONTHS)
    factor = 1.0
    for m in range(months):
        y, mo = divmod(verified.month - 1 + m, 12)
        age = _vehicle_age(year_from, year_to, date(verified.year + y, mo + 1, 1))
        factor *= (1 - annual_rate(age)) ** (1 / 12)
    return factor


def _round_zar(value: float) -> int:
    return int(round(value / 1000.0)) * 1000


def age_price_range(pr: dict, verified: date, today: date) -> dict:
    """Return a copy of one price band aged from `verified` to `today`."""
    factor = ageing_factor(pr["year_from"], pr["year_to"], verified, today)
    if factor >= 1.0:
        return dict(pr)
    # Same factor + monotonic rounding keeps low <= mid <= high.
    return {
        **pr,
        "low_zar": _round_zar(pr["low_zar"] * factor),
        "mid_zar": _round_zar(pr["mid_zar"] * factor),
        "high_zar": _round_zar(pr["high_zar"] * factor),
    }


def price_freshness(verified_raw, today: date | None = None) -> dict:
    today = today or date.today()
    verified = parse_date(verified_raw)
    if verified is None:
        return {"verified_at": None, "months_aged": 0, "days_since_verified": None, "stale": True}
    days = max(0, (today - verified).days)
    return {
        "verified_at": verified.isoformat(),
        "months_aged": min(months_between(verified, today), MAX_AGEING_MONTHS),
        "days_since_verified": days,
        "stale": days > STALE_AFTER_DAYS,
    }


def age_car(car: dict, today: date | None = None) -> dict:
    """Copy of a KB car with current (aged) price bands and a freshness note.

    Cars without a valid `prices_verified_at` keep their prices unchanged:
    with no baseline date there is nothing safe to age from.
    """
    today = today or date.today()
    out = deepcopy(car)
    verified = parse_date(car.get("prices_verified_at"))
    if verified is not None:
        out["price_ranges"] = [age_price_range(pr, verified, today) for pr in car.get("price_ranges", [])]
    out["price_freshness"] = price_freshness(verified, today)
    return out


def price_chunk_text(make: str, model: str, pr: dict, freshness: dict | None = None) -> str:
    """Price-band chunk text. Without `freshness`, identical to what is embedded."""
    text = (
        f"{make} {model}, Price Range {pr['year_from']}-{pr['year_to']}\n"
        f"Low: R{pr['low_zar']:,} | Mid: R{pr['mid_zar']:,} | High: R{pr['high_zar']:,}\n"
        f"These are typical used car prices for this model in the South African market."
    )
    if freshness and freshness.get("verified_at") and freshness.get("months_aged"):
        text += (
            f"\nPrices verified {freshness['verified_at']} and adjusted for "
            f"{freshness['months_aged']} month(s) of depreciation since."
        )
    return text


def age_match(match: dict, today: date | None = None) -> dict:
    """Age a retrieved Pinecone price chunk so answers quote current prices.

    Non-price chunks, and price chunks without a verified date, pass through
    unchanged.
    """
    metadata = match.get("metadata") or {}
    if metadata.get("chunk_type") != "price_range":
        return match
    verified = parse_date(metadata.get("prices_verified_at"))
    if verified is None:
        return match
    today = today or date.today()
    try:
        aged = age_price_range(metadata, verified, today)
    except (KeyError, TypeError):
        return match
    for key in ("year_from", "year_to", "low_zar", "mid_zar", "high_zar"):
        if isinstance(aged.get(key), float):
            aged[key] = int(aged[key])  # Pinecone returns numbers as floats
    aged["text"] = price_chunk_text(
        metadata.get("make", ""), metadata.get("model", ""), aged, price_freshness(verified, today)
    )
    return {**match, "metadata": aged}
