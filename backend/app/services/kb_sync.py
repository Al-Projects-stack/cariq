"""Pinecone publish flow for the admin knowledge base.

Publish order is upsert-first, delete-stale-second: if the upsert fails,
the model's previous vectors are still live and the published version
marker is untouched, so the model is never left with zero vectors.
"""
import asyncio
import json
import logging
from datetime import datetime

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models import KbModel, ModelVersion, SyncJob
from app.services import kb_admin as kb
from app.services.admin_auth import audit
from app.services.cache import (
    all_models_cache,
    compare_cache,
    market_cache,
    model_profile_cache,
    rag_query_cache,
    recommend_cache,
    tco_cache,
)
from app.services.chunking import chunk_car_dict
from app.services.embeddings import EmbeddingsService
from app.services.pinecone_client import PineconeClient

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = ("queued", "embedding", "upserting")


def _utcnow() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


def _running_job(db: Session, model_slug: str | None = None) -> SyncJob | None:
    query = db.query(SyncJob).filter(SyncJob.status.in_(ACTIVE_STATUSES))
    if model_slug is not None:
        query = query.filter(SyncJob.model_slug == model_slug)
    return query.first()


def queue_publish(db: Session, background: BackgroundTasks, model: KbModel, actor: str) -> int:
    if _running_job(db, model.slug):
        raise HTTPException(status_code=409, detail="A sync job is already running for this model")
    job = SyncJob(kind="publish", model_slug=model.slug, status="queued", created_by=actor)
    db.add(job)
    db.commit()
    db.refresh(job)
    snapshot = kb.snapshot_from_db(model)
    background.add_task(_run_publish, job.id, model.slug, snapshot, actor)
    return job.id


def queue_reindex_all(db: Session, background: BackgroundTasks, actor: str) -> int:
    if _running_job(db):
        raise HTTPException(status_code=409, detail="A sync job is already running")
    job = SyncJob(kind="reindex_all", status="queued", created_by=actor)
    db.add(job)
    db.commit()
    db.refresh(job)
    background.add_task(_run_reindex_all, job.id, actor)
    return job.id


def invalidate_model_caches(model: KbModel) -> None:
    """Drop every cache entry that can embed this model's content."""
    make, name = model.make.lower(), model.model.lower()
    for sep in (" ", "_"):
        model_profile_cache.invalidate(f"{make}|{name}".replace(" ", sep))
        market_cache.invalidate(f"mp|{make}|{name}".replace(" ", sep))
        tco_cache.invalidate(f"tco|{make}|{name}".replace(" ", sep))
    all_models_cache.invalidate("all_cars")
    rag_query_cache.clear()
    compare_cache.clear()
    recommend_cache.clear()


def _set_status(db: Session, job: SyncJob, status: str, error: str | None = None) -> None:
    job.status = status
    if error is not None:
        job.error = error[:2000]
    if status in ("done", "failed"):
        job.finished_at = _utcnow()
    db.commit()


def _embed_chunks(texts: list[str]) -> list[list[float]]:
    async def _run() -> list[list[float]]:
        svc = EmbeddingsService()
        out = []
        for i in range(0, len(texts), 10):
            out.extend(await svc.embed_batch(texts[i : i + 10]))
        return out

    return asyncio.run(_run())


def _run_publish(job_id: int, slug: str, snapshot: dict, actor: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(SyncJob).filter(SyncJob.id == job_id).first()
        model = db.query(KbModel).filter(KbModel.slug == slug).first()
        if not job or not model:
            return
        try:
            _set_status(db, job, "embedding")
            chunks = chunk_car_dict(snapshot, slug)
            vectors = _embed_chunks([c["text"] for c in chunks])

            _set_status(db, job, "upserting")
            client = PineconeClient()
            payload = []
            for chunk, embedding in zip(chunks, vectors):
                metadata = {k: v for k, v in chunk.items() if k not in ("text", "id")}
                metadata["text"] = chunk["text"][:1000]
                payload.append({"id": chunk["id"], "values": embedding, "metadata": metadata})
            # Upsert first so a failure leaves the old vectors untouched.
            client.upsert(payload)

            new_ids = [c["id"] for c in chunks]
            old_ids = json.loads(model.chunk_ids or "[]")
            stale = [i for i in old_ids if i not in set(new_ids)]
            client.delete_ids(stale)

            version = ModelVersion(
                model_id=model.id, kind="published",
                snapshot=json.dumps(snapshot), created_by=actor,
            )
            db.add(version)
            db.flush()
            model.published_version_id = version.id
            model.published_at = _utcnow()
            model.chunk_ids = json.dumps(new_ids)
            model.status = "live"
            db.commit()
            invalidate_model_caches(model)
            audit(db, actor, "kb.publish", model_slug=slug, detail=f"{len(new_ids)} chunks")
            _set_status(db, job, "done")
        except Exception as exc:
            logger.error(f"Publish job {job_id} failed: {exc}", exc_info=True)
            db.rollback()
            audit(db, actor, "kb.publish_failed", model_slug=slug, detail=str(exc)[:500])
            _set_status(db, job, "failed", error=str(exc))
    finally:
        db.close()


def _run_reindex_all(job_id: int, actor: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(SyncJob).filter(SyncJob.id == job_id).first()
        if not job:
            return
        try:
            models = db.query(KbModel).filter(KbModel.status == "live").order_by(KbModel.slug).all()
            _set_status(db, job, "embedding")
            client = PineconeClient()
            total = 0
            for model in models:
                snapshot = kb.snapshot_from_db(model)
                chunks = chunk_car_dict(snapshot, model.slug)
                vectors = _embed_chunks([c["text"] for c in chunks])
                _set_status(db, job, "upserting")
                payload = []
                for chunk, embedding in zip(chunks, vectors):
                    metadata = {k: v for k, v in chunk.items() if k not in ("text", "id")}
                    metadata["text"] = chunk["text"][:1000]
                    payload.append({"id": chunk["id"], "values": embedding, "metadata": metadata})
                client.upsert(payload)
                new_ids = [c["id"] for c in chunks]
                old_ids = json.loads(model.chunk_ids or "[]")
                client.delete_ids([i for i in old_ids if i not in set(new_ids)])
                model.chunk_ids = json.dumps(new_ids)
                db.commit()
                total += len(new_ids)
            all_models_cache.invalidate("all_cars")
            rag_query_cache.clear()
            audit(db, actor, "kb.reindex_all", detail=f"{len(models)} models, {total} chunks")
            _set_status(db, job, "done")
        except Exception as exc:
            logger.error(f"Reindex job {job_id} failed: {exc}", exc_info=True)
            db.rollback()
            audit(db, actor, "kb.reindex_failed", detail=str(exc)[:500])
            _set_status(db, job, "failed", error=str(exc))
    finally:
        db.close()


def pinecone_health(db: Session) -> dict:
    """Compare expected chunk IDs (DB) with what Pinecone actually holds."""
    client = PineconeClient()
    total = client.total_count()
    models = db.query(KbModel).filter(KbModel.status == "live").order_by(KbModel.slug).all()
    rows = []
    for model in models:
        expected = json.loads(model.chunk_ids or "[]")
        found = client.fetch_ids(expected) if expected else {}
        rows.append({
            "slug": model.slug,
            "expected": len(expected),
            "found": len(found),
            "ok": len(found) == len(expected),
        })
    return {"total_vectors": total, "models": rows}
