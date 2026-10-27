"""Tests for public user auth: signup/login, secret guard, rate limits."""
import pytest

from tests.conftest import make_test_app
from app import config
from app.routers import auth


@pytest.fixture
def client():
    auth.limiter.reset()
    test_client, _ = make_test_app((auth.router, "/api/v1"))
    with test_client as c:
        yield c


def _signup(client, email="thabo@example.com"):
    return client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "correct-horse-1", "display_name": "Thabo"},
    )


class TestUserAuth:
    def test_signup_then_me(self, client):
        res = _signup(client)
        assert res.status_code == 200
        token = res.json()["token"]
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "thabo@example.com"

    def test_token_signed_with_jwt_secret_not_database_url(self, client):
        import jwt

        token = _signup(client).json()["token"]
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, config.settings.database_url, algorithms=["HS256"])
        jwt.decode(token, config.settings.jwt_secret, algorithms=["HS256"])

    def test_production_refuses_default_secret(self, client):
        old_env, old_secret = config.settings.environment, config.settings.jwt_secret
        config.settings.environment = "production"
        config.settings.jwt_secret = "change-me"
        try:
            res = _signup(client)
            assert res.status_code == 503
        finally:
            config.settings.environment = old_env
            config.settings.jwt_secret = old_secret

    def test_login_is_rate_limited(self, client):
        _signup(client)
        codes = [
            client.post(
                "/api/v1/auth/login",
                json={"email": "thabo@example.com", "password": "wrong-password"},
            ).status_code
            for _ in range(11)
        ]
        assert codes[:10] == [401] * 10
        assert codes[10] == 429
