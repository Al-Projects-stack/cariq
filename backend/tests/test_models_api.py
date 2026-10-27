"""Tests for GET /api/v1/models endpoints."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Client signed in as a user (model profiles require an account)."""
    from app.main import app
    from app.db.models import User
    from app.routers.auth import _require_user

    app.dependency_overrides[_require_user] = lambda: User(id=1, email="t@x.co", display_name="T")
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(_require_user, None)


@pytest.fixture
def anon_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


class TestModelDataRequiresAccount:
    @pytest.mark.parametrize("method,path,body", [
        ("get", "/api/v1/models/Volkswagen/Polo", None),
        ("get", "/api/v1/models/Volkswagen/Polo/market-position", None),
        ("get", "/api/v1/models/Volkswagen/Polo/tco", None),
        ("post", "/api/v1/compare", {"make_a": "Volkswagen", "model_a": "Polo", "make_b": "Toyota", "model_b": "Hilux"}),
        ("get", "/api/v1/public/models", None),
        ("get", "/api/v1/public/models/Volkswagen/Polo", None),
    ])
    def test_signed_out_is_refused(self, anon_client, method, path, body):
        r = getattr(anon_client, method)(path, **({"json": body} if body else {}))
        assert r.status_code == 401

    def test_landing_list_stays_public_without_prices(self, anon_client):
        r = anon_client.get("/api/v1/models")
        assert r.status_code == 200
        assert all("price_ranges" not in c for c in r.json())

    def test_api_docs_hidden_outside_development(self, anon_client):
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert anon_client.get(path).status_code == 404


class TestModelsEndpoint:
    def test_list_models_returns_200(self, client):
        response = client.get("/api/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 10  # We have 10 KB files

    def test_list_models_has_required_fields(self, client):
        response = client.get("/api/v1/models")
        assert response.status_code == 200
        for car in response.json():
            assert "make" in car
            assert "model" in car
            assert "variants" in car
            assert "reliability_score" in car

    def test_get_vw_polo_profile(self, client):
        response = client.get("/api/v1/models/Volkswagen/Polo")
        assert response.status_code == 200
        data = response.json()
        assert data["make"] == "Volkswagen"
        assert data["model"] == "Polo"
        assert len(data["known_faults"]) > 0
        assert len(data["price_ranges"]) > 0

    def test_get_toyota_hilux_profile(self, client):
        response = client.get("/api/v1/models/Toyota/Hilux")
        assert response.status_code == 200
        data = response.json()
        assert data["make"] == "Toyota"
        assert data["model"] == "Hilux"

    def test_get_bmw_3_series_profile(self, client):
        response = client.get("/api/v1/models/BMW/3_Series")
        assert response.status_code == 200
        data = response.json()
        assert data["make"] == "BMW"

    def test_unknown_model_returns_404(self, client):
        response = client.get("/api/v1/models/Ferrari/F40")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_model_profile_has_what_to_inspect(self, client):
        response = client.get("/api/v1/models/Ford/Ranger")
        assert response.status_code == 200
        data = response.json()
        assert len(data["what_to_inspect_before_buying"]) > 0

    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "pinecone" in data
        assert "claude" in data
