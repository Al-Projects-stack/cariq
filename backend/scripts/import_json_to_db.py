"""
One-time seed: load backend/knowledge_base/cars/*.json into PostgreSQL.

Safe to run twice: models are upserted by slug, child rows are replaced
(not appended), and a published version row is only added when the content
actually changed. All logic lives in app.services.kb_admin so the app
startup auto-seed uses the exact same path.

    cd backend
    python scripts/import_json_to_db.py
"""
import sys
from pathlib import Path

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env BEFORE importing app modules (config reads env at import time)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.db.database import SessionLocal, engine, Base
from app.services import kb_admin as kb

KB_DIR = Path(__file__).parent.parent / "knowledge_base" / "cars"


def main() -> int:
    Base.metadata.create_all(bind=engine)
    if not sorted(KB_DIR.glob("*.json")):
        print(f"No JSON files found in {KB_DIR}")
        return 1

    db = SessionLocal()
    try:
        for filename, slug, changed in kb.seed_from_json_files(db, KB_DIR):
            status = "new published version" if changed else "unchanged"
            print(f"  {filename} -> {slug} ({status})")
        print("\nImport complete.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
