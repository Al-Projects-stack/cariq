"""Tests for price ageing and freshness (app/services/pricing.py)."""
import json
from datetime import date
from pathlib import Path

import pytest

from app.services import pricing

KB_DIR = Path(__file__).parent.parent / "knowledge_base" / "cars"
BAND = {"year_from": 2018, "year_to": 2021, "low_zar": 100000, "mid_zar": 140000, "high_zar": 190000}


class TestAgeing:
    def test_no_ageing_on_verification_day(self):
        d = date(2026, 7, 11)
        assert pricing.age_price_range(BAND, d, d) == BAND

    def test_prices_fall_over_time(self):
        aged = pricing.age_price_range(BAND, date(2026, 1, 1), date(2026, 7, 1))
        assert aged["mid_zar"] < BAND["mid_zar"]
        assert aged["low_zar"] <= aged["mid_zar"] <= aged["high_zar"]
        assert aged["mid_zar"] % 1000 == 0

    def test_six_months_is_a_plausible_drop(self):
        # 2018-2021 band is ~6 years old: 12%/yr -> roughly 6% over 6 months
        aged = pricing.age_price_range(BAND, date(2026, 1, 1), date(2026, 7, 1))
        drop = 1 - aged["mid_zar"] / BAND["mid_zar"]
        assert 0.03 < drop < 0.09

    def test_newer_cars_depreciate_faster(self):
        new = {**BAND, "year_from": 2024, "year_to": 2026}
        old = {**BAND, "year_from": 2010, "year_to": 2013}
        start, end = date(2026, 1, 1), date(2027, 1, 1)
        assert pricing.ageing_factor(2024, 2026, start, end) < pricing.ageing_factor(2010, 2013, start, end)
        assert pricing.age_price_range(new, start, end)["mid_zar"] < pricing.age_price_range(old, start, end)["mid_zar"]

    def test_ageing_is_capped(self):
        start = date(2020, 1, 1)
        capped = pricing.age_price_range(BAND, start, date(2030, 1, 1))
        at_cap = pricing.age_price_range(BAND, start, date(2021, 7, 1))  # 18 months
        assert capped == at_cap

    def test_future_verification_date_does_not_raise_prices(self):
        assert pricing.age_price_range(BAND, date(2027, 1, 1), date(2026, 1, 1)) == BAND


class TestFreshness:
    def test_fresh_within_threshold(self):
        f = pricing.price_freshness("2026-10-01", date(2026, 10, 27))
        assert f["stale"] is False
        assert f["days_since_verified"] == 26
        assert f["months_aged"] == 0

    def test_stale_after_threshold(self):
        f = pricing.price_freshness("2026-05-16", date(2026, 10, 27))
        assert f["stale"] is True
        assert f["months_aged"] == 5

    def test_missing_or_bad_date_is_stale_and_unaged(self):
        car = {"make": "X", "model": "Y", "price_ranges": [BAND], "prices_verified_at": "not-a-date"}
        out = pricing.age_car(car, date(2026, 10, 27))
        assert out["price_ranges"] == [BAND]
        assert out["price_freshness"]["stale"] is True
        assert out["price_freshness"]["verified_at"] is None

    def test_age_car_does_not_mutate_input(self):
        car = {"make": "X", "model": "Y", "price_ranges": [dict(BAND)], "prices_verified_at": "2025-01-01"}
        pricing.age_car(car, date(2026, 1, 1))
        assert car["price_ranges"] == [BAND]
        assert "price_freshness" not in car


class TestRetrievedChunks:
    def _match(self, **meta):
        base = {
            "chunk_type": "price_range", "make": "Suzuki", "model": "Swift",
            "year_from": 2018.0, "year_to": 2021.0,  # Pinecone returns floats
            "low_zar": 100000.0, "mid_zar": 140000.0, "high_zar": 190000.0,
            "prices_verified_at": "2026-01-01", "text": "old text",
        }
        return {"id": "suzuki_swift_price_1", "score": 0.9, "metadata": {**base, **meta}}

    def test_price_chunk_is_aged_and_text_rewritten(self):
        out = pricing.age_match(self._match(), date(2026, 7, 1))
        meta = out["metadata"]
        assert meta["mid_zar"] < 140000 and isinstance(meta["mid_zar"], int)
        assert f"R{meta['mid_zar']:,}" in meta["text"]
        assert "Price Range 2018-2021" in meta["text"]  # not 2018.0
        assert "adjusted for 6 month(s)" in meta["text"]
        assert out["score"] == 0.9

    def test_chunk_without_date_passes_through(self):
        m = self._match()
        del m["metadata"]["prices_verified_at"]
        assert pricing.age_match(m, date(2026, 7, 1)) is m

    def test_non_price_chunk_passes_through(self):
        m = {"metadata": {"chunk_type": "fault", "text": "x"}}
        assert pricing.age_match(m) is m

    def test_embedded_text_unchanged_by_refactor(self):
        """chunk text must stay byte-identical or existing vectors drift."""
        from app.services.chunking import chunk_car_dict

        car = {"make": "Suzuki", "model": "Swift", "price_ranges": [BAND], "prices_verified_at": "2026-07-11"}
        chunk = next(c for c in chunk_car_dict(car, "suzuki_swift") if c["chunk_type"] == "price_range")
        assert chunk["text"] == (
            "Suzuki Swift, Price Range 2018-2021\n"
            "Low: R100,000 | Mid: R140,000 | High: R190,000\n"
            "These are typical used car prices for this model in the South African market."
        )
        assert chunk["prices_verified_at"] == "2026-07-11"


class TestKnowledgeBase:
    @pytest.mark.parametrize("fp", sorted(KB_DIR.glob("*.json")), ids=lambda p: p.name)
    def test_every_model_has_a_verified_date(self, fp):
        car = json.loads(fp.read_text(encoding="utf-8"))
        assert pricing.parse_date(car.get("prices_verified_at")), f"{fp.name}: missing/invalid prices_verified_at"

    def test_every_endpoint_serves_aged_prices(self):
        from app.services.cache import all_models_cache
        from app.routers.models import _load_all_cars
        from app.routers import market, recommend, compare

        all_models_cache.clear()
        cars = _load_all_cars()
        assert all("price_freshness" in c for c in cars)
        assert market._load_all() is cars
        assert recommend._load_all() is cars
        assert "price_freshness" in compare._load_profile("Suzuki", "Swift")


class TestAdminFreshnessEndpoint:
    def test_requires_admin_and_lists_every_model(self):
        from tests.conftest import make_test_app
        from app.db.models import AdminUser
        from app.routers import admin_auth, admin_sync
        from app.services import admin_auth as svc

        admin_auth.limiter.reset()
        c, SessionLocal = make_test_app((admin_auth.router, "/api/v1/admin"), (admin_sync.router, "/api/v1/admin"))
        assert c.get("/api/v1/admin/sync/price-freshness").status_code == 401

        db = SessionLocal()
        db.add(AdminUser(email="ed@x.co", password_hash=svc.hash_password("pw-editor-123"), role="editor"))
        db.commit()
        db.close()
        c.post("/api/v1/admin/auth/login", json={"email": "ed@x.co", "password": "pw-editor-123"})

        body = c.get("/api/v1/admin/sync/price-freshness").json()
        assert len(body["models"]) == len(list(KB_DIR.glob("*.json")))
        assert body["stale_count"] == sum(m["stale"] for m in body["models"])
        days = [m["days_since_verified"] for m in body["models"]]
        assert days == sorted(days, reverse=True)  # stalest first
