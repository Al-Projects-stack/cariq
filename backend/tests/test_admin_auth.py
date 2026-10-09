"""Tests for admin cookie auth, roles, CSRF, and lockout.

Uses an isolated in-memory DB per test via conftest.make_test_app.
"""
import pytest

from tests.conftest import make_test_app
from app.routers import admin_auth, admin_users
from app.services import admin_auth as svc
from app.db.models import AdminUser

# The @limiter.limit("5/minute") decorator shares module-level limiter state
# across tests in one process, so rate limiting is disabled for this module
# except in TestLoginRateLimit, which re-enables it explicitly.
admin_auth.limiter.enabled = False


@pytest.fixture
def seeded():
    client, SessionLocal = make_test_app(
        (admin_auth.router, "/api/v1/admin"),
        (admin_users.router, "/api/v1/admin"),
    )
    db = SessionLocal()
    db.add(AdminUser(email="admin@x.co", password_hash=svc.hash_password("pw-admin-123"), role="admin"))
    db.add(AdminUser(email="ed@x.co", password_hash=svc.hash_password("pw-editor-123"), role="editor"))
    db.commit()
    db.close()
    return client


def _login(client, email, password):
    return client.post("/api/v1/admin/auth/login", json={"email": email, "password": password})


def _csrf(client):
    # CSRF cookie is set by login; TestClient keeps it, header must be explicit.
    for cookie in client.cookies.jar:
        if cookie.name == "cariq_admin_csrf":
            return {"X-CSRF-Token": cookie.value}
    return {}


class TestAdminLogin:
    def test_login_success_sets_cookies(self, seeded):
        r = _login(seeded, "admin@x.co", "pw-admin-123")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        assert "cariq_admin=" in r.headers.get("set-cookie", "")
        assert r.json()["csrf_token"]

    def test_wrong_password_generic_error(self, seeded):
        r = _login(seeded, "admin@x.co", "wrong")
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid email or password"

    def test_unknown_user_same_generic_error(self, seeded):
        r = _login(seeded, "ghost@x.co", "wrong")
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid email or password"

    def test_me_without_cookie_is_401(self, seeded):
        assert seeded.get("/api/v1/admin/auth/me").status_code == 401

    def test_me_with_cookie(self, seeded):
        _login(seeded, "ed@x.co", "pw-editor-123")
        r = seeded.get("/api/v1/admin/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "ed@x.co"

    def test_password_hash_never_returned(self, seeded):
        _login(seeded, "admin@x.co", "pw-admin-123")
        r = seeded.get("/api/v1/admin/users")
        assert r.status_code == 200
        assert all("password_hash" not in u for u in r.json())

    def test_lockout_after_ten_failures(self, seeded):
        for _ in range(10):
            r = _login(seeded, "ed@x.co", "wrong")
            assert r.status_code == 401
        # Correct password is still rejected with the generic error.
        r = _login(seeded, "ed@x.co", "pw-editor-123")
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid email or password"


class TestLoginRateLimit:
    def test_sixth_rapid_login_is_rejected(self, seeded):
        admin_auth.limiter.enabled = True
        try:
            statuses = [
                _login(seeded, "admin@x.co", "pw-admin-123").status_code
                for _ in range(8)
            ]
            assert 429 in statuses
        finally:
            admin_auth.limiter.enabled = False


class TestRolesAndCsrf:
    def test_editor_blocked_from_admin_route(self, seeded):
        _login(seeded, "ed@x.co", "pw-editor-123")
        r = seeded.get("/api/v1/admin/users", headers=_csrf(seeded))
        assert r.status_code == 403

    def test_unauthenticated_blocked(self, seeded):
        assert seeded.get("/api/v1/admin/users").status_code == 401

    def test_mutation_without_csrf_is_403(self, seeded):
        _login(seeded, "admin@x.co", "pw-admin-123")
        # Drop just the CSRF cookie; auth cookies stay.
        for cookie in list(seeded.cookies.jar):
            if cookie.name == "cariq_admin_csrf":
                seeded.cookies.jar.clear(cookie.domain, cookie.path, cookie.name)
        r = seeded.post("/api/v1/admin/users",
                        json={"email": "n@x.co", "password": "pw-new-user-1"})
        assert r.status_code == 403

    def test_admin_can_create_editor(self, seeded):
        _login(seeded, "admin@x.co", "pw-admin-123")
        r = seeded.post("/api/v1/admin/users",
                        json={"email": "n@x.co", "password": "pw-new-user-1", "role": "editor"},
                        headers=_csrf(seeded))
        assert r.status_code == 200
        assert r.json()["role"] == "editor"

    def test_editor_cannot_create_users(self, seeded):
        _login(seeded, "ed@x.co", "pw-editor-123")
        r = seeded.post("/api/v1/admin/users",
                        json={"email": "n@x.co", "password": "pw-new-user-1"},
                        headers=_csrf(seeded))
        assert r.status_code == 403

    def test_cannot_disable_self(self, seeded):
        _login(seeded, "admin@x.co", "pw-admin-123")
        me = [u for u in seeded.get("/api/v1/admin/users").json() if u["email"] == "admin@x.co"][0]
        r = seeded.patch(f"/api/v1/admin/users/{me['id']}",
                         json={"disabled": True}, headers=_csrf(seeded))
        assert r.status_code == 400

    def test_refresh_rotates_session(self, seeded):
        _login(seeded, "admin@x.co", "pw-admin-123")
        r = seeded.post("/api/v1/admin/auth/refresh", headers=_csrf(seeded))
        assert r.status_code == 200
        assert r.json()["email"] == "admin@x.co"

    def test_logout_clears_session(self, seeded):
        _login(seeded, "admin@x.co", "pw-admin-123")
        # Refresh CSRF header (rotation may have issued a new token).
        headers = _csrf(seeded)
        assert seeded.post("/api/v1/admin/auth/logout", headers=headers).status_code == 200
