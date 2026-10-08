"""
One-time seed: load backend/knowledge_base/cars/*.json into PostgreSQL.

Safe to run twice: models are upserted by slug, child rows are replaced
(not appended), and a published version row is only added when the content
actually changed.

    cd backend
    python scripts/import_json_to_db.py
"""
import json
import sys
from pathlib import Path

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env BEFORE importing app modules (config reads env at import time)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.db.database import SessionLocal, engine, Base
from app.db.models import KbModel, ModelVersion
from app.models.admin_schemas import SEVERITIES
from app.services import kb_admin as kb
from app.services.admin_auth import audit

KB_DIR = Path(__file__).parent.parent / "knowledge_base" / "cars"


def normalise_legacy(car: dict, filename: str) -> dict:
    """Validate a legacy file and return a snapshot-shaped dict."""
    snap = {
        "make": car["make"],
        "model": car["model"],
        "variants": car.get("variants", []),
        "years_covered": car.get("years_covered", ""),
        "sa_market_summary": car.get("sa_market_summary", ""),
        "reliability_score": car.get("reliability_score", 0.0),
        "segment": car.get("segment", ""),
        "fuel_type": car.get("fuel_type", ""),
        "fuel_consumption_l_per_100km": car.get("fuel_consumption_l_per_100km"),
        "annual_maintenance_zar": car.get("annual_maintenance_zar"),
        "annual_insurance_zar": car.get("annual_insurance_zar"),
        "price_ranges": car.get("price_ranges", []),
        "known_faults": [],
        "what_to_inspect_before_buying": car.get("what_to_inspect_before_buying", []),
        "owner_sentiment": car.get("owner_sentiment", ""),
        "sources": car.get("sources", []),
    }
    for f in car.get("known_faults", []):
        severity = str(f.get("severity", "MEDIUM")).upper()
        if severity not in SEVERITIES:
            raise ValueError(f"{filename}: unknown severity {f.get('severity')!r}")
        lo, hi = kb.parse_repair_range(f.get("estimated_repair_zar", ""))
        snap["known_faults"].append({
            "fault": f["fault"],
            "affects_variants": f.get("affects_variants", []),
            "mileage_range": f.get("mileage_range", ""),
            "severity": severity,
            "description": f.get("description", ""),
            "what_to_inspect": f.get("what_to_inspect", ""),
            "repair_min_zar": lo,
            "repair_max_zar": hi,
            "affected_years": None,
            "source": f.get("source", ""),
        })
    return snap


def main() -> int:
    Base.metadata.create_all(bind=engine)
    files = sorted(KB_DIR.glob("*.json"))
    if not files:
        print(f"No JSON files found in {KB_DIR}")
        return 1

    db = SessionLocal()
    try:
        for fp in files:
            with open(fp, encoding="utf-8") as f:
                car = json.load(f)
            snap = normalise_legacy(car, fp.name)
            slug = kb.slugify(snap["make"], snap["model"])
            model = db.query(KbModel).filter(KbModel.slug == slug).first()
            if not model:
                model = KbModel(slug=slug, make=snap["make"], model=snap["model"])
                db.add(model)
                db.flush()
            kb.apply_snapshot(db, model, snap)
            model.status = "live"
            model.chunk_ids = json.dumps(kb.build_chunk_ids(model))

            # Only version when content changed: re-runs stay clean.
            new_snapshot = json.dumps(kb.snapshot_from_db(model), sort_keys=True)
            last = (
                db.query(ModelVersion)
                .filter(ModelVersion.model_id == model.id, ModelVersion.kind == "published")
                .order_by(ModelVersion.id.desc())
                .first()
            )
            if not last or json.dumps(json.loads(last.snapshot), sort_keys=True) != new_snapshot:
                version = ModelVersion(
                    model_id=model.id, kind="published",
                    snapshot=json.dumps(kb.snapshot_from_db(model)), created_by="import-script",
                )
                db.add(version)
                db.flush()
                model.published_version_id = version.id
                from datetime import datetime
                model.published_at = datetime.utcnow()
                print(f"  {fp.name} -> {slug} (new published version)")
            else:
                print(f"  {fp.name} -> {slug} (unchanged)")
            db.commit()
            audit(db, "import-script", "kb.import", model_slug=slug)
        print("\nImport complete.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
