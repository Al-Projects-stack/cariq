"""Tests for failure classification, feedback endpoint, and failure groups."""
from unittest.mock import MagicMock

import pytest

# Stub network clients before importing the query router: it builds a real
# RAGService (Pinecone + embeddings) at module import time.
import app.services.rag as _rag

_rag.PineconeClient = MagicMock()
_rag.EmbeddingsService = MagicMock()

from tests.conftest import make_test_app  # noqa: E402
from app.routers import admin_auth, admin_failures  # noqa: E402
from app.routers import query as query_router  # noqa: E402
from app.services import admin_auth as svc  # noqa: E402
from app.services.tracking import (  # noqa: E402
    classify_failure,
    hash_ip,
    is_refusal,
    normalize_question,
)
from app.db.models import AdminUser, FailedQuestionGroup, QueryLog  # noqa: E402

query_router.limiter.enabled = False
admin_auth.limiter.enabled = False


@pytest.fixture
def client():
    c, SessionLocal = make_test_app(
        (query_router.router, "/api/v1"),
        (admin_auth.router, "/api/v1/admin"),
        (admin_failures.router, "/api/v1/admin"),
    )
    db = SessionLocal()
    db.add(AdminUser(email="admin@x.co", password_hash=svc.hash_password("pw-admin-123"), role="admin"))
    db.commit()
    db.close()
    c.SessionLocal = SessionLocal
    return c


def _login(c):
    r = c.post("/api/v1/admin/auth/login", json={"email": "admin@x.co", "password": "pw-admin-123"})
    assert r.status_code == 200
    csrf = next(x.value for x in c.cookies.jar if x.name == "cariq_admin_csrf")
    return {"X-CSRF-Token": csrf}


def _seed_log(c, **kwargs):
    kwargs.setdefault("question", "Is the Polo reliable?")
    db = c.SessionLocal()
    try:
        log = QueryLog(session_id="s", answer="Yes.", **kwargs)
        db.add(log)
        db.commit()
        return log.id
    finally:
        db.close()


class TestClassifier:
    def test_low_score(self):
        assert classify_failure(0.2, False) == "low_score"

    def test_threshold_boundary_healthy(self):
        assert classify_failure(0.45, False) is None

    def test_no_score_no_failure(self):
        assert classify_failure(None, False) is None

    def test_refusal(self):
        assert classify_failure(0.9, True) == "model_not_in_kb"

    def test_error_wins(self):
        assert classify_failure(0.9, True, error=True) == "system_error"

    def test_downvote(self):
        assert classify_failure(0.9, False, vote="down") == "user_unhelpful"

    def test_refusal_phrases(self):
        assert is_refusal("I don't have enough data on that model yet. Try VW Polo.")
        assert not is_refusal("The Polo is a solid buy.")

    def test_normalize(self):
        assert normalize_question("  What about the DIESEL one?!? ") == "what about the diesel one"

    def test_ip_hashed_never_plain(self):
        h = hash_ip("1.2.3.4")
        assert h and h != "1.2.3.4" and h == hash_ip("1.2.3.4")
        assert hash_ip(None) is None


class TestFeedback:
    def test_up_vote_ok(self, client):
        qid = _seed_log(client)
        r = client.post("/api/v1/feedback", json={"query_id": qid, "vote": "up"})
        assert r.status_code == 200

    def test_down_vote_marks_failed_and_groups(self, client):
        qid = _seed_log(client, top_score=0.9)
        assert client.post("/api/v1/feedback", json={"query_id": qid, "vote": "down"}).status_code == 200
        db = client.SessionLocal()
        try:
            log = db.query(QueryLog).filter(QueryLog.id == qid).first()
            assert log.vote == "down"
            assert log.failure_reason == "user_unhelpful"
            assert log.group_id is not None
            group = db.query(FailedQuestionGroup).filter(
                FailedQuestionGroup.id == log.group_id).first()
            assert group and group.count >= 1
        finally:
            db.close()

    def test_unknown_query_404(self, client):
        assert client.post("/api/v1/feedback", json={"query_id": 999999, "vote": "up"}).status_code == 404

    def test_bad_vote_422(self, client):
        qid = _seed_log(client)
        assert client.post("/api/v1/feedback", json={"query_id": qid, "vote": "meh"}).status_code == 422

    def test_missing_body_422(self, client):
        assert client.post("/api/v1/feedback", json={}).status_code == 422


class TestFailureGroups:
    def test_grouping_counts_duplicates(self, client):
        db = client.SessionLocal()
        try:
            from app.services.tracking import record_failure_group
            record_failure_group(db, "What about the diesel one?", "low_score")
            record_failure_group(db, "What about the diesel one?!?", "low_score")
            db.commit()
            groups = db.query(FailedQuestionGroup).all()
            assert len(groups) == 1 and groups[0].count == 2
        finally:
            db.close()

    def test_list_and_resolve(self, client):
        _seed_log(client, failure_reason="low_score", top_score=0.2)
        db = client.SessionLocal()
        try:
            from app.services.tracking import record_failure_group
            gid = record_failure_group(db, "Is the Polo reliable?", "low_score")
            db.query(QueryLog).filter(QueryLog.question == "Is the Polo reliable?").update(
                {"group_id": gid})
            db.commit()
        finally:
            db.close()
        h = _login(client)
        r = client.get("/api/v1/admin/failures/groups")
        assert r.status_code == 200 and r.json()["total"] == 1
        r = client.post(f"/api/v1/admin/failures/groups/{gid}/resolve",
                        json={"note": "added data"}, headers=h)
        assert r.status_code == 200
        r = client.get("/api/v1/admin/failures/groups?status=resolved")
        assert r.json()["total"] == 1

    def test_detail_and_prefill(self, client):
        _seed_log(client, question="VW Polo diesel faults?", failure_reason="low_score",
                  top_score=0.2, retrieved_chunk_ids='["a"]', scores='[0.2]')
        db = client.SessionLocal()
        try:
            from app.services.tracking import record_failure_group
            gid = record_failure_group(db, "VW Polo diesel faults?", "low_score")
            db.query(QueryLog).update({"group_id": gid})
            db.commit()
        finally:
            db.close()
        _login(client)
        r = client.get(f"/api/v1/admin/failures/groups/{gid}")
        assert r.status_code == 200
        assert "chunks" in r.json() and "queries" in r.json()
        r = client.get(f"/api/v1/admin/failures/groups/{gid}/prefill")
        assert r.status_code == 200 and "prefill" in r.json()

    def test_overview_shape(self, client):
        _seed_log(client)
        _login(client)
        r = client.get("/api/v1/admin/overview")
        assert r.status_code == 200
        body = r.json()
        for key in ("total_queries", "queries_7d", "queries_30d", "failure_rate",
                    "avg_top_score", "unresolved_groups", "models_live", "models_total", "daily"):
            assert key in body
        assert len(body["daily"]) == 14

    def test_unauthenticated_blocked(self, client):
        assert client.get("/api/v1/admin/failures/groups").status_code == 401
        assert client.get("/api/v1/admin/overview").status_code == 401
