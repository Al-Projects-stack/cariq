"""Daily spend caps (app/services/usage_guard.py) and anti-abuse input rules."""
import pytest
from fastapi import HTTPException

from app.config import settings
from app.services import usage_guard


@pytest.fixture(autouse=True)
def fresh_counters(monkeypatch):
    usage_guard.reset()
    monkeypatch.setattr(settings, "anon_daily_query_limit", 3)
    monkeypatch.setattr(settings, "user_daily_query_limit", 2)
    monkeypatch.setattr(settings, "total_daily_query_limit", 6)
    monkeypatch.setattr(settings, "daily_signup_limit", 2)
    yield
    usage_guard.reset()


class TestQueryCaps:
    def test_anon_pool_is_capped(self):
        for _ in range(3):
            usage_guard.consume_query(None)
        with pytest.raises(HTTPException) as e:
            usage_guard.consume_query(None)
        assert e.value.status_code == 429
        assert "Sign in" in e.value.detail

    def test_anon_abuse_does_not_block_signed_in_users(self):
        for _ in range(3):
            usage_guard.consume_query(None)
        usage_guard.consume_query(7)  # own allowance, still fine

    def test_each_user_has_own_allowance(self):
        usage_guard.consume_query(1)
        usage_guard.consume_query(1)
        with pytest.raises(HTTPException):
            usage_guard.consume_query(1)
        usage_guard.consume_query(2)

    def test_total_is_a_hard_ceiling(self):
        for uid in range(1, 4):
            usage_guard.consume_query(uid)
            usage_guard.consume_query(uid)
        with pytest.raises(HTTPException) as e:
            usage_guard.consume_query(99)
        assert "daily question limit" in e.value.detail

    def test_rejected_request_is_not_counted(self):
        usage_guard.consume_query(1)
        usage_guard.consume_query(1)
        for _ in range(5):
            with pytest.raises(HTTPException):
                usage_guard.consume_query(1)
        # 2 counted, not 7: four more slots left under the total of 6
        for uid in (2, 2, 3, 3):
            usage_guard.consume_query(uid)

    def test_counters_reset_on_a_new_day(self, monkeypatch):
        for _ in range(3):
            usage_guard.consume_query(None)
        monkeypatch.setattr(usage_guard, "_today", lambda: "2099-01-01")
        usage_guard.consume_query(None)


class TestSignupRules:
    @pytest.fixture
    def client(self):
        from tests.conftest import make_test_app
        from app.routers import auth

        auth.limiter.reset()
        c, _ = make_test_app((auth.router, "/api/v1"))
        return c

    def test_daily_signup_cap(self, client):
        for i in range(2):
            r = client.post("/api/v1/auth/signup", json={"email": f"u{i}@x.co", "password": "secret123"})
            assert r.status_code == 200
        r = client.post("/api/v1/auth/signup", json={"email": "u9@x.co", "password": "secret123"})
        assert r.status_code == 429

    @pytest.mark.parametrize("body", [
        {"email": "not-an-email", "password": "secret123"},
        {"email": "a@x.co", "password": "x" * 129},
        {"email": "a@x.co", "password": "secret123", "display_name": "x" * 51},
        {"email": ("x" * 250) + "@x.co", "password": "secret123"},
    ])
    def test_bad_signup_payloads_rejected(self, client, body):
        assert client.post("/api/v1/auth/signup", json=body).status_code == 422


class TestUserDataCaps:
    @pytest.fixture
    def client(self):
        from tests.conftest import make_test_app
        from app.routers import auth, watchlist, saved_searches

        auth.limiter.reset()
        c, _ = make_test_app(
            (auth.router, "/api/v1"), (watchlist.router, "/api/v1"), (saved_searches.router, "/api/v1")
        )
        token = c.post("/api/v1/auth/signup", json={"email": "w@x.co", "password": "secret123"}).json()["token"]
        c.headers["Authorization"] = f"Bearer {token}"
        return c

    def test_watchlist_rejects_unknown_models(self, client):
        assert client.post("/api/v1/watchlist", json={"make": "Fake", "model": "Car"}).status_code == 404
        assert client.post("/api/v1/watchlist", json={"make": "Volkswagen", "model": "Polo"}).status_code == 200

    def test_watchlist_cap(self, client, monkeypatch):
        from app.routers import watchlist

        monkeypatch.setattr(watchlist, "MAX_WATCHLIST_ITEMS", 1)
        assert client.post("/api/v1/watchlist", json={"make": "Volkswagen", "model": "Polo"}).status_code == 200
        assert client.post("/api/v1/watchlist", json={"make": "Toyota", "model": "Hilux"}).status_code == 400

    def test_saved_search_cap_and_size(self, client, monkeypatch):
        from app.routers import saved_searches

        assert client.post("/api/v1/saved-searches", json={"query": "x" * 501}).status_code == 422
        monkeypatch.setattr(saved_searches, "MAX_SAVED_SEARCHES", 1)
        assert client.post("/api/v1/saved-searches", json={"query": "polo faults"}).status_code == 200
        assert client.post("/api/v1/saved-searches", json={"query": "hilux faults"}).status_code == 400
