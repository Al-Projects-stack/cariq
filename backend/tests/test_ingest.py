"""Tests for the KB ingestion script."""
import json
import pytest
from pathlib import Path

KB_DIR = Path(__file__).parent.parent / "knowledge_base" / "cars"


class TestKBFiles:
    def test_kb_dir_exists(self):
        assert KB_DIR.exists(), f"KB directory not found at {KB_DIR}"

    def test_at_least_10_models(self):
        files = list(KB_DIR.glob("*.json"))
        assert len(files) >= 10, f"Expected 10+ KB files, found {len(files)}"

    @pytest.mark.parametrize("filename", [
        "vw_polo.json",
        "vw_golf.json",
        "toyota_hilux.json",
        "toyota_fortuner.json",
        "bmw_3series.json",
        "ford_ranger.json",
        "mazda_3.json",
        "hyundai_i20.json",
        "honda_jazz.json",
        "mercedes_c_class.json",
    ])
    def test_required_file_exists(self, filename):
        fp = KB_DIR / filename
        assert fp.exists(), f"Required KB file missing: {filename}"

    @pytest.mark.parametrize("fp", list(KB_DIR.glob("*.json")))
    def test_json_is_valid(self, fp):
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict)

    @pytest.mark.parametrize("fp", list(KB_DIR.glob("*.json")))
    def test_required_fields_present(self, fp):
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        required = ["make", "model", "variants", "years_covered", "sa_market_summary",
                    "reliability_score", "price_ranges", "known_faults",
                    "what_to_inspect_before_buying", "owner_sentiment", "sources"]
        for field in required:
            assert field in data, f"Missing field '{field}' in {fp.name}"

    @pytest.mark.parametrize("fp", list(KB_DIR.glob("*.json")))
    def test_price_ranges_have_required_keys(self, fp):
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        for pr in data.get("price_ranges", []):
            assert "year_from" in pr
            assert "year_to" in pr
            assert "low_zar" in pr
            assert "mid_zar" in pr
            assert "high_zar" in pr
            assert pr["low_zar"] <= pr["mid_zar"] <= pr["high_zar"]

    @pytest.mark.parametrize("fp", list(KB_DIR.glob("*.json")))
    def test_faults_have_required_keys(self, fp):
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        for fault in data.get("known_faults", []):
            assert "fault" in fault
            assert "mileage_range" in fault
            assert "severity" in fault
            assert fault["severity"] in ["LOW", "MEDIUM", "HIGH"], \
                f"Invalid severity '{fault['severity']}' in {fp.name}"
            assert "estimated_repair_zar" in fault

    @pytest.mark.parametrize("fp", list(KB_DIR.glob("*.json")))
    def test_reliability_score_in_range(self, fp):
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        score = data.get("reliability_score", 0)
        assert 0.0 <= score <= 10.0, f"Reliability score {score} out of range in {fp.name}"


class TestChunkingLogic:
    def test_chunk_car_file_produces_chunks(self):
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
        from ingest import chunk_car_file

        sample_car = {
            "make": "Test",
            "model": "Car",
            "variants": ["1.0", "1.5"],
            "years_covered": "2018-2022",
            "sa_market_summary": "A test car for testing.",
            "reliability_score": 8.0,
            "owner_sentiment": "Positive",
            "sources": ["Test source"],
            "price_ranges": [
                {"year_from": 2018, "year_to": 2020, "low_zar": 100000, "mid_zar": 120000, "high_zar": 150000}
            ],
            "known_faults": [
                {
                    "fault": "Test fault",
                    "affects_variants": ["1.0"],
                    "mileage_range": "50,000km",
                    "severity": "LOW",
                    "description": "A test fault.",
                    "what_to_inspect": "Check it.",
                    "estimated_repair_zar": "R1,000",
                    "source": "Test"
                }
            ],
            "what_to_inspect_before_buying": ["Check the engine", "Check the tyres"],
        }

        chunks = chunk_car_file(sample_car)
        assert len(chunks) >= 4  # summary + 1 price range + 1 fault + inspection

        types = [c["chunk_type"] for c in chunks]
        assert "summary" in types
        assert "price_range" in types
        assert "fault" in types
        assert "inspection" in types

    def test_fault_chunk_has_metadata(self):
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
        from ingest import chunk_car_file

        sample_car = {
            "make": "VW", "model": "Polo", "variants": [], "years_covered": "2018-2022",
            "sa_market_summary": "Test", "reliability_score": 7.5,
            "owner_sentiment": "Good", "sources": ["Test"],
            "price_ranges": [],
            "known_faults": [
                {
                    "fault": "DSG shudder",
                    "affects_variants": ["1.0 TSI"],
                    "mileage_range": "50,000km",
                    "severity": "MEDIUM",
                    "description": "Shudder",
                    "what_to_inspect": "Test drive",
                    "estimated_repair_zar": "R5,000",
                    "source": "MyBroadband"
                }
            ],
            "what_to_inspect_before_buying": [],
        }

        chunks = chunk_car_file(sample_car)
        fault_chunks = [c for c in chunks if c["chunk_type"] == "fault"]
        assert len(fault_chunks) == 1
        assert fault_chunks[0]["fault_name"] == "DSG shudder"
        assert fault_chunks[0]["severity"] == "MEDIUM"
