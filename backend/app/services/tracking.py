"""Failed-question tracking: rule-based classifier, grouping, votes.

No AI involved: refusal is phrase-matched, grouping is normalised text.
Logged user questions are untrusted input and are only ever rendered
as plain text in the UI.
"""
import hashlib
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import FailedQuestionGroup, QueryLog

REASON_NOT_IN_KB = "model_not_in_kb"
REASON_LOW_SCORE = "low_score"
REASON_UNHELPFUL = "user_unhelpful"
REASON_ERROR = "system_error"
FAILURE_REASONS = (REASON_NOT_IN_KB, REASON_LOW_SCORE, REASON_UNHELPFUL, REASON_ERROR)

REFUSAL_PHRASES = (
    "don't have enough data",
    "do not have enough data",
    "not in the knowledge base",
    "isn't in the knowledge base",
    "no data on that model",
)


def _utcnow():
    return datetime.now(timezone.utc)


def hash_ip(ip: str | None) -> str | None:
    """Salted one-way hash. Plain IPs are never stored."""
    if not ip:
        return None
    return hashlib.sha256(f"{settings.ip_hash_salt}|{ip}".encode()).hexdigest()


def normalize_question(question: str) -> str:
    text = (question or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def is_refusal(answer: str) -> bool:
    lowered = (answer or "").lower()
    return any(phrase in lowered for phrase in REFUSAL_PHRASES)


def classify_failure(
    top_score: float | None,
    refused: bool,
    error: bool = False,
    vote: str | None = None,
    threshold: float | None = None,
) -> str | None:
    """Return a failure reason, or None when the query looks healthy."""
    if error:
        return REASON_ERROR
    if vote == "down":
        return REASON_UNHELPFUL
    if refused:
        return REASON_NOT_IN_KB
    limit = settings.failure_score_threshold if threshold is None else threshold
    if top_score is not None and top_score < limit:
        return REASON_LOW_SCORE
    return None


def record_failure_group(db: Session, question: str, reason: str) -> int | None:
    """Upsert the normalized group row. Returns the group id (best-effort)."""
    normalized = normalize_question(question)
    if not normalized:
        return None
    try:
        group = (
            db.query(FailedQuestionGroup)
            .filter(FailedQuestionGroup.normalized == normalized)
            .first()
        )
        if group:
            group.count = (group.count or 0) + 1
            group.last_seen = _utcnow()
            if group.status == "resolved" and group.reason != reason:
                group.reason = reason
        else:
            group = FailedQuestionGroup(
                normalized=normalized,
                sample_question=question.strip()[:2000],
                count=1,
                reason=reason,
            )
            db.add(group)
        db.flush()
        return group.id
    except Exception:
        return None


def record_vote(db: Session, query_id: int, vote: str) -> QueryLog | None:
    """Apply a thumbs up/down. A down vote marks the query failed."""
    log = db.query(QueryLog).filter(QueryLog.id == query_id).first()
    if not log:
        return None
    log.vote = vote
    if vote == "down" and log.failure_reason != REASON_ERROR:
        log.failure_reason = REASON_UNHELPFUL
        log.group_id = record_failure_group(db, log.question or "", REASON_UNHELPFUL)
    db.commit()
    return log
