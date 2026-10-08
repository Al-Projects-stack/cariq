from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AdminUser, SyncJob
from app.routers.admin_auth import require_admin_role, require_admin_user, require_csrf
from app.services import kb_sync
from app.services.kb_admin import iso

router = APIRouter(tags=["admin-sync"])


class ReindexConfirm(BaseModel):
    model_config = {"extra": "forbid"}

    confirm: bool = False


def _job_out(job: SyncJob) -> dict:
    return {
        "id": job.id,
        "kind": job.kind,
        "model_slug": job.model_slug,
        "status": job.status,
        "error": job.error,
        "created_by": job.created_by,
        "started_at": iso(job.started_at),
        "finished_at": iso(job.finished_at),
    }


@router.get("/sync/jobs")
def list_jobs(
    status: str = "",
    page: int = 1,
    page_size: int = 20,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(SyncJob)
    if status in ("queued", "embedding", "upserting", "done", "failed"):
        query = query.filter(SyncJob.status == status)
    total = query.count()
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    rows = query.order_by(SyncJob.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_job_out(j) for j in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/sync/jobs/{job_id}")
def get_job(
    job_id: int,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    job = db.query(SyncJob).filter(SyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_out(job)


@router.post("/sync/reindex-all")
def reindex_all(
    body: ReindexConfirm,
    background: BackgroundTasks,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to start a full reindex")
    job_id = kb_sync.queue_reindex_all(db, background, admin.email)
    return {"job_id": job_id}


@router.get("/sync/health")
def sync_health(
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    try:
        return kb_sync.pinecone_health(db)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Pinecone unreachable: {exc}")
