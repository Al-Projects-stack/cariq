import json
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AdminUser, FailedQuestionGroup, KbModel, QueryLog
from app.models.admin_schemas import (
    EntryPrefill,
    FailureChunkOut,
    FailureGroupDetail,
    FailureGroupOut,
    FailureQueryOut,
    PagedFailureGroups,
    ResolveIn,
)
from app.routers.admin_auth import require_admin_user, require_csrf
from app.services import kb_admin as kb
from app.services.admin_auth import audit
from app.services.tracking import FAILURE_REASONS, normalize_question

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-failures"])


def _group_out(db: Session, g: FailedQuestionGroup) -> FailureGroupOut:
    avg = (
        db.query(func.avg(QueryLog.top_score))
        .filter(QueryLog.group_id == g.id, QueryLog.top_score.isnot(None))
        .scalar()
    )
    return FailureGroupOut(
        id=g.id,
        sample_question=g.sample_question,
        count=g.count,
        reason=g.reason,
        avg_top_score=round(float(avg), 3) if avg is not None else None,
        status=g.status,
        note=g.note,
        first_seen=kb.iso(g.first_seen),
        last_seen=kb.iso(g.last_seen),
    )


@router.get("/overview")
def admin_overview(
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Dashboard aggregates: queries, failures, groups, models, daily series."""
    # Naive UTC to match the created_at columns (datetime.utcnow defaults).
    now = datetime.utcnow()
    q_all = db.query(QueryLog)
    total = q_all.count()
    q7 = q_all.filter(QueryLog.created_at >= now - timedelta(days=7)).count()
    q30 = q_all.filter(QueryLog.created_at >= now - timedelta(days=30)).count()
    failed30 = q_all.filter(
        QueryLog.created_at >= now - timedelta(days=30),
        QueryLog.failure_reason.isnot(None),
    ).count()
    avg_score = (
        db.query(func.avg(QueryLog.top_score))
        .filter(QueryLog.created_at >= now - timedelta(days=30), QueryLog.top_score.isnot(None))
        .scalar()
    )
    unresolved = (
        db.query(FailedQuestionGroup).filter(FailedQuestionGroup.status == "open").count()
    )
    live_models = db.query(KbModel).filter(KbModel.status == "live").count()
    total_models = db.query(KbModel).filter(KbModel.status != "deleted").count()

    daily = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_start = datetime(day.year, day.month, day.day)
        day_end = day_start + timedelta(days=1)
        dq = db.query(QueryLog).filter(
            QueryLog.created_at >= day_start, QueryLog.created_at < day_end
        )
        daily.append({
            "day": day.isoformat(),
            "queries": dq.count(),
            "failures": dq.filter(QueryLog.failure_reason.isnot(None)).count(),
        })
    return {
        "total_queries": total,
        "queries_7d": q7,
        "queries_30d": q30,
        "failure_rate": round(failed30 / q30 * 100, 1) if q30 else 0.0,
        "avg_top_score": round(float(avg_score), 3) if avg_score is not None else None,
        "unresolved_groups": unresolved,
        "models_live": live_models,
        "models_total": total_models,
        "daily": daily,
    }


@router.get("/failures/groups", response_model=PagedFailureGroups)
def list_failure_groups(
    reason: str = "",
    status: str = "",
    page: int = 1,
    page_size: int = 20,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(FailedQuestionGroup)
    if reason in FAILURE_REASONS:
        query = query.filter(FailedQuestionGroup.reason == reason)
    if status in ("open", "resolved"):
        query = query.filter(FailedQuestionGroup.status == status)
    total = query.count()
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    rows = (
        query.order_by(FailedQuestionGroup.count.desc(), FailedQuestionGroup.last_seen.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PagedFailureGroups(
        items=[_group_out(db, g) for g in rows], total=total, page=page, page_size=page_size,
    )


@router.get("/failures/groups/{group_id}", response_model=FailureGroupDetail)
def failure_group_detail(
    group_id: int,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    group = db.query(FailedQuestionGroup).filter(FailedQuestionGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    queries = (
        db.query(QueryLog)
        .filter(QueryLog.group_id == group_id)
        .order_by(QueryLog.created_at.desc())
        .limit(10)
        .all()
    )
    # Show the retrieved chunks/scores from the most recent query for debugging.
    chunks: list[FailureChunkOut] = []
    if queries:
        latest = queries[0]
        try:
            ids = json.loads(latest.retrieved_chunk_ids or "[]")
            scores = json.loads(latest.scores or "[]")
        except Exception:
            ids, scores = [], []
        texts: dict = {}
        if ids:
            try:
                from app.services.pinecone_client import PineconeClient

                texts = PineconeClient().fetch_ids(ids)
            except Exception as exc:
                logger.warning(f"Chunk fetch for debugging skipped: {exc}")
        for i, cid in enumerate(ids):
            meta = texts.get(cid, {}) or {}
            chunks.append(FailureChunkOut(
                id=cid,
                score=scores[i] if i < len(scores) else None,
                text=str(meta.get("text", ""))[:500],
            ))
    return FailureGroupDetail(
        group=_group_out(db, group),
        queries=[
            FailureQueryOut(
                id=q.id, question=q.question, top_score=q.top_score,
                refused=bool(q.refused), vote=q.vote, created_at=kb.iso(q.created_at),
            )
            for q in queries
        ],
        chunks=chunks,
    )


@router.post("/failures/groups/{group_id}/resolve")
def resolve_group(
    group_id: int,
    body: ResolveIn,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    group = db.query(FailedQuestionGroup).filter(FailedQuestionGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.status = "resolved"
    group.note = body.note or None
    db.commit()
    audit(db, admin.email, "failures.resolve", detail=f"group {group_id}")
    return {"ok": True}


@router.get("/failures/groups/{group_id}/prefill", response_model=EntryPrefill)
def prefill_from_group(
    group_id: int,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Detect a known model in the failed question and return an editor prefill."""
    group = db.query(FailedQuestionGroup).filter(FailedQuestionGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    text = normalize_question(group.sample_question)
    detected_make, detected_model = None, None
    for m in db.query(KbModel).filter(KbModel.status != "deleted").all():
        if m.make.lower() in text and m.model.lower() in text:
            detected_make, detected_model = m.make, m.model
            break
    prefill = {
        "make": detected_make or "",
        "model": detected_model or "",
        "variants": [],
        "years_covered": "",
        "sa_market_summary": "",
        "reliability_score": 0.0,
        "segment": "",
        "fuel_type": "",
        "sources": [],
        "faults": [],
        "price_ranges": [],
        "checklist": [],
    }
    return EntryPrefill(detected_make=detected_make, detected_model=detected_model, prefill=prefill)
