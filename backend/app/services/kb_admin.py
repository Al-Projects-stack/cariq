"""Knowledge-base admin helpers: snapshots, diffs, deterministic chunk IDs.

The working copy lives in the kb_* tables. Every mutating save also writes a
ModelVersion(kind="draft") snapshot; publish copies a published snapshot
marker. Chunk IDs are deterministic so republishing overwrites vectors
instead of duplicating them. kb_sync (Step 4) reuses build_chunk_ids().
"""
import json
import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import KbChecklistItem, KbFault, KbModel, KbPriceRange, ModelVersion

_REPAIR_NUMBERS = re.compile(r"R?\s?(\d[\d\s,]*)")


def slugify(make: str, model: str) -> str:
    raw = f"{make}_{model}".lower().replace(" ", "_")
    return re.sub(r"[^a-z0-9_\-]", "", raw)


def parse_repair_range(text: str) -> tuple[int | None, int | None]:
    """Best-effort parse of legacy free-text costs like "R5,000 - R18,000"."""
    nums = []
    for m in _REPAIR_NUMBERS.finditer(text or ""):
        try:
            nums.append(int(m.group(1).replace(" ", "").replace(",", "")))
        except ValueError:
            continue
    if not nums:
        return None, None
    if len(nums) == 1:
        return nums[0], nums[0]
    lo, hi = nums[0], nums[1]
    return (lo, hi) if lo <= hi else (hi, lo)


def format_repair_range(lo: int | None, hi: int | None) -> str:
    if lo is None and hi is None:
        return ""
    if lo is not None and hi is not None and lo != hi:
        return f"R{lo:,} - R{hi:,}"
    n = lo if lo is not None else hi
    return f"R{n:,}"


def snapshot_from_db(model: KbModel) -> dict:
    """Full model JSON in legacy car-file shape (plus affected_years)."""
    faults = []
    for f in sorted(model.faults, key=lambda x: (x.position, x.id or 0)):
        entry = {
            "fault": f.title,
            "affects_variants": json.loads(f.affected_variants or "[]"),
            "mileage_range": f.mileage_range,
            "severity": f.severity,
            "description": f.description,
            "what_to_inspect": f.what_to_inspect,
            "estimated_repair_zar": format_repair_range(f.repair_min_zar, f.repair_max_zar),
            "source": f.source,
        }
        years = json.loads(f.affected_years) if f.affected_years else None
        if years:
            entry["affected_years"] = years
        faults.append(entry)
    return {
        "make": model.make,
        "model": model.model,
        "variants": json.loads(model.variants or "[]"),
        "years_covered": model.years_covered,
        "sa_market_summary": model.sa_market_summary,
        "reliability_score": model.reliability_score,
        "segment": model.segment,
        "fuel_type": model.fuel_type,
        "fuel_consumption_l_per_100km": model.fuel_consumption_l_per_100km,
        "annual_maintenance_zar": model.annual_maintenance_zar,
        "annual_insurance_zar": model.annual_insurance_zar,
        "price_ranges": [
            {
                "year_from": p.year_from,
                "year_to": p.year_to,
                "low_zar": p.low_zar,
                "mid_zar": p.mid_zar,
                "high_zar": p.high_zar,
            }
            for p in sorted(model.price_ranges, key=lambda x: x.year_from)
        ],
        "known_faults": faults,
        "what_to_inspect_before_buying": [
            c.text for c in sorted(model.checklist_items, key=lambda x: (x.position, x.id or 0))
        ],
        "owner_sentiment": model.owner_sentiment,
        "sources": json.loads(model.sources or "[]"),
    }


def apply_snapshot(db: Session, model: KbModel, snap: dict) -> None:
    """Replace the working copy with a snapshot dict. Does not commit."""
    model.make = snap.get("make", model.make)
    model.model = snap.get("model", model.model)
    model.variants = json.dumps(snap.get("variants", []))
    model.years_covered = snap.get("years_covered", "")
    model.sa_market_summary = snap.get("sa_market_summary", "")
    model.reliability_score = snap.get("reliability_score", 0.0)
    model.segment = snap.get("segment", "")
    model.fuel_type = snap.get("fuel_type", "")
    model.fuel_consumption_l_per_100km = snap.get("fuel_consumption_l_per_100km")
    model.annual_maintenance_zar = snap.get("annual_maintenance_zar")
    model.annual_insurance_zar = snap.get("annual_insurance_zar")
    model.owner_sentiment = snap.get("owner_sentiment", "")
    model.sources = json.dumps(snap.get("sources", []))

    for child in list(model.faults) + list(model.price_ranges) + list(model.checklist_items):
        db.delete(child)
    db.flush()
    # session.delete() leaves ghosts in already-loaded collections, so expire
    # them: the next access reloads from the DB (empty), and the appends below
    # then leave exactly the new rows in memory.
    db.expire(model, ["faults", "price_ranges", "checklist_items"])

    # NOTE: children are appended via the relationship (not raw FK + db.add)
    # so the in-memory collections stay correct without further refreshes.
    for i, f in enumerate(snap.get("known_faults", [])):
        lo, hi = parse_repair_range(f.get("estimated_repair_zar", ""))
        if "repair_min_zar" in f or "repair_max_zar" in f:
            lo = f.get("repair_min_zar", lo)
            hi = f.get("repair_max_zar", hi)
        model.faults.append(KbFault(
            title=f.get("fault", f.get("title", "")),
            description=f.get("description", ""),
            what_to_inspect=f.get("what_to_inspect", ""),
            severity=str(f.get("severity", "MEDIUM")).upper(),
            mileage_range=f.get("mileage_range", ""),
            repair_min_zar=lo,
            repair_max_zar=hi,
            affected_variants=json.dumps(f.get("affects_variants", [])),
            affected_years=json.dumps(f["affected_years"]) if f.get("affected_years") else None,
            source=f.get("source", ""),
            position=i,
        ))
    for p in snap.get("price_ranges", []):
        model.price_ranges.append(KbPriceRange(
            year_from=p["year_from"],
            year_to=p["year_to"],
            low_zar=p["low_zar"],
            mid_zar=p["mid_zar"],
            high_zar=p["high_zar"],
        ))
    for i, text in enumerate(snap.get("what_to_inspect_before_buying", snap.get("checklist", []))):
        item = text["text"] if isinstance(text, dict) else text
        model.checklist_items.append(KbChecklistItem(text=item, position=i))
    db.flush()


def save_draft_version(db: Session, model: KbModel, actor: str) -> ModelVersion:
    version = ModelVersion(
        model_id=model.id,
        kind="draft",
        snapshot=json.dumps(snapshot_from_db(model)),
        created_by=actor,
    )
    db.add(version)
    return version


def last_published_snapshot(db: Session, model: KbModel) -> dict | None:
    if not model.published_version_id:
        return None
    v = db.query(ModelVersion).filter(ModelVersion.id == model.published_version_id).first()
    return json.loads(v.snapshot) if v else None


def diff_snapshots(old: dict | None, new: dict) -> list[dict]:
    """Flat human-readable diff: [{path, old, new}]. Old None = everything new."""
    changes: list[dict] = []

    def fmt(v) -> str:
        if v is None:
            return ""
        if isinstance(v, (dict, list)):
            return json.dumps(v)
        return str(v)

    def walk(path: str, o, n) -> None:
        if isinstance(n, dict) and isinstance(o, dict):
            for key in sorted(set(o) | set(n)):
                walk(f"{path}.{key}" if path else key, o.get(key), n.get(key))
        elif isinstance(n, list) and isinstance(o, list):
            if o != n:
                changes.append({"path": path, "old": fmt(o), "new": fmt(n)})
        elif o != n:
            changes.append({"path": path, "old": fmt(o), "new": fmt(n)})

    walk("", old or {}, new)
    return changes


def build_chunk_ids(model: KbModel) -> list[str]:
    """Deterministic vector IDs for a model's chunks.

    Single source of truth: kb_sync embeds in the same section order
    (summary, prices, faults, inspection), so IDs line up exactly.
    """
    slug = model.slug
    ids = [f"{slug}_summary_0"]
    prices = sorted(model.price_ranges, key=lambda x: x.year_from)
    ids += [f"{slug}_price_{i}" for i in range(len(prices))]
    faults = sorted(model.faults, key=lambda x: (x.position, x.id or 0))
    ids += [f"{slug}_fault_{i}" for i in range(len(faults))]
    if model.checklist_items:
        ids.append(f"{slug}_inspection_0")
    return ids


def chunk_count(model: KbModel) -> int:
    return len(build_chunk_ids(model))


def has_unpublished_changes(db: Session, model: KbModel) -> bool:
    old = last_published_snapshot(db, model)
    if old is None:
        return True
    return bool(diff_snapshots(old, snapshot_from_db(model)))


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None
