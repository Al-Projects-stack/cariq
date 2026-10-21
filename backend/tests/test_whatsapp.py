"""Tests for POST /api/v1/whatsapp (Twilio webhook)."""
import os

# Must be set before any module that reads Settings() is imported.
os.environ.setdefault("TWILIO_AUTH_TOKEN", "test-token-12345")

from unittest.mock import AsyncMock, MagicMock, patch

# Prevent RAGService() from connecting to Pinecone at import time.
_rag_patch = patch("app.services.rag.RAGService", return_value=MagicMock())
_rag_patch.start()

import pytest
from fastapi.testclient import TestClient
from twilio.request_validator import RequestValidator

from tests.conftest import make_test_app
from app.models.schemas import QueryResponse
from app.routers import whatsapp
from app.routers.query import rag_service


@pytest.fixture
def client():
    test_client, _ = make_test_app((whatsapp.router, "/api/v1"))
    with test_client as c:
        yield c


def _signed_request(data: dict, token: str = "test-token-12345"):
    """Build (form_data, headers) with a valid Twilio signature for the
    TestServer URL the whatsapp route is mounted on."""
    url = "http://testserver/api/v1/whatsapp"
    signature = RequestValidator(token).compute_signature(url, data)
    return data, {"X-Twilio-Signature": signature}


class TestWhatsAppWebhook:
    def test_valid_signature_returns_twiml_with_answer(self, client):
        with patch.object(rag_service, "query", new_callable=AsyncMock) as mock_query:
            mock_query.return_value = QueryResponse(
                answer="The Toyota Corolla is a reliable choice in SA.",
                session_id="whatsapp:+27820001234",
            )
            data, headers = _signed_request(
                {
                    "Body": "Tell me about the Toyota Corolla",
                    "From": "whatsapp:+27820001234",
                    "ProfileName": "Thabo",
                }
            )
            response = client.post("/api/v1/whatsapp", data=data, headers=headers)

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/xml")
        body = response.text
        assert "Toyota Corolla" in body or "reliable" in body
        _, kwargs = mock_query.call_args
        assert kwargs["question"] == "Tell me about the Toyota Corolla"
        assert kwargs["session_id"] == "whatsapp:+27820001234"

    def test_invalid_signature_returns_403(self, client):
        data, _ = _signed_request(
            {"Body": "Hello", "From": "whatsapp:+27820001234"}
        )
        headers = {"X-Twilio-Signature": "invalid-signature"}
        response = client.post("/api/v1/whatsapp", data=data, headers=headers)
        assert response.status_code == 403

    def test_missing_signature_returns_403(self, client):
        response = client.post(
            "/api/v1/whatsapp",
            data={"Body": "Hello", "From": "whatsapp:+27820001234"},
        )
        assert response.status_code == 403

    def test_empty_body_returns_hint_without_rag(self, client):
        data, headers = _signed_request(
            {"Body": "", "From": "whatsapp:+27820001234", "ProfileName": "Thabo"}
        )
        with patch.object(rag_service, "query", new_callable=AsyncMock) as mock_query:
            response = client.post("/api/v1/whatsapp", data=data, headers=headers)

        assert response.status_code == 200
        assert "car-buying assistant" in response.text
        mock_query.assert_not_called()

    def test_rag_error_returns_apology_twiml_200(self, client):
        data, headers = _signed_request(
            {"Body": "Tell me about the Toyota Corolla", "From": "whatsapp:+27820001234"}
        )
        with patch.object(
            rag_service, "query", new_callable=AsyncMock, side_effect=Exception("down")
        ):
            response = client.post("/api/v1/whatsapp", data=data, headers=headers)

        assert response.status_code == 200
        assert "something went wrong" in response.text.lower()
        assert response.headers["content-type"].startswith("application/xml")

    def test_long_answer_is_truncated(self, client):
        long_answer = "x " * 900  # ~1800 chars, over the 1500 cap
        data, headers = _signed_request(
            {"Body": "Q", "From": "whatsapp:+27820001234"}
        )
        with patch.object(
            rag_service,
            "query",
            new_callable=AsyncMock,
            return_value=QueryResponse(answer=long_answer, session_id="s"),
        ):
            response = client.post("/api/v1/whatsapp", data=data, headers=headers)

        assert response.status_code == 200
        assert len(response.text) < 1700

    def test_no_profile_name_fallback(self, client):
        data, headers = _signed_request(
            {"Body": "", "From": "whatsapp:+27820001234"}
        )
        with patch.object(
            rag_service, "query", new_callable=AsyncMock,
            return_value=QueryResponse(answer="", session_id="s"),
        ):
            response = client.post("/api/v1/whatsapp", data=data, headers=headers)

        assert response.status_code == 200
        assert "there" in response.text
