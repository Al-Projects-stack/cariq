"""Tests for GET /api/v1/models endpoints."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


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
