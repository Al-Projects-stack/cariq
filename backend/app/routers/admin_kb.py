import json
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import KbChecklistItem, KbFault, KbModel, KbPriceRange, ModelVersion
from app.models.admin_schemas import (
    AuditOut,
    ChecklistItemIn,
    DiffChange,
    FaultIn,
    ModelCreate,
    ModelDetail,
    ModelDiff,
    ModelListItem,
    PagedAudit,
    PagedModels,
    PagedVersions,
    PriceRangeIn,
    ModelProfileIn,
    VersionOut,
)
from app.routers.admin_auth import require_admin_role, require_admin_user, require_csrf
from app.services import kb_admin as kb
from app.services.admin_auth import audit
from app.db.models import AdminUser, AuditLog

router = APIRouter(tags=["admin-kb"])


def _get_model(db: Session, slug: str, include_deleted: bool = False) -> KbModel:
    model = db.query(KbModel).filter(KbModel.slug == slug).first()
    if not model or (model.status == "deleted" and not include_deleted):
        raise HTTPException(status_code=404, detail="Model not found")
    return model


def _list_item(db: Session, m: KbModel) -> ModelListItem:
    return ModelListItem(
        slug=m.slug,
        make=m.make,
        model=m.model,
        status=m.status,
        reliability_score=m.reliability_score,
        updated_at=kb.iso(m.updated_at),
        published_at=kb.iso(m.published_at),
        chunk_count=kb.chunk_count(m),
        has_unpublished_changes=kb.has_unpublished_changes(db, m),
    )


def _detail(db: Session, m: KbModel) -> ModelDetail:
    return ModelDetail(
        slug=m.slug,
        make=m.make,
        model=m.model,
        status=m.status,
        variants=json.loads(m.variants or "[]"),
        years_covered=m.years_covered,
        sa_market_summary=m.sa_market_summary,
        reliability_score=m.reliability_score,
        segment=m.segment,
        fuel_type=m.fuel_type,
        fuel_consumption_l_per_100km=m.fuel_consumption_l_per_100km,
        annual_maintenance_zar=m.annual_maintenance_zar,
        annual_insurance_zar=m.annual_insurance_zar,
        owner_sentiment=m.owner_sentiment,
        sources=json.loads(m.sources or "[]"),
        faults=[
            {
                "id": f.id,
                "title": f.title,
                "description": f.description,
                "severity": f.severity,
                "mileage_range": f.mileage_range,
                "what_to_inspect": f.what_to_inspect,
                "repair_min_zar": f.repair_min_zar,
                "repair_max_zar": f.repair_max_zar,
                "affected_variants": json.loads(f.affected_variants or "[]"),
                "affected_years": json.loads(f.affected_years) if f.affected_years else None,
                "source": f.source,
            }
            for f in sorted(m.faults, key=lambda x: (x.position, x.id or 0))
        ],
        price_ranges=[
            {
                "id": p.id,
                "year_from": p.year_from,
                "year_to": p.year_to,
                "low_zar": p.low_zar,
                "mid_zar": p.mid_zar,
                "high_zar": p.high_zar,
            }
            for p in sorted(m.price_ranges, key=lambda x: x.year_from)
        ],
        checklist=[
            {"id": c.id, "text": c.text}
            for c in sorted(m.checklist_items, key=lambda x: (x.position, x.id or 0))
        ],
        updated_at=kb.iso(m.updated_at),
        published_at=kb.iso(m.published_at),
        chunk_count=kb.chunk_count(m),
        has_unpublished_changes=kb.has_unpublished_changes(db, m),
    )


def _save(db: Session, model: KbModel, actor: str, action: str) -> None:
    kb.save_draft_version(db, model, actor)
    db.commit()
    audit(db, actor, action, model_slug=model.slug)


def _drop_children(db: Session, model: KbModel, rel: str) -> None:
    for child in list(getattr(model, rel)):
        db.delete(child)
    db.flush()
    # Expire so the next access reloads (empty) instead of seeing ghosts.
    db.expire(model, [rel])


def _set_faults(db: Session, model: KbModel, faults: list[FaultIn]) -> None:
    _drop_children(db, model, "faults")
    for i, f in enumerate(faults):
        # Append via relationship so the in-memory collection stays correct.
        model.faults.append(KbFault(
            title=f.title,
            description=f.description,
            severity=f.severity,
            mileage_range=f.mileage_range,
            what_to_inspect=f.what_to_inspect,
            repair_min_zar=f.repair_min_zar,
            repair_max_zar=f.repair_max_zar,
            affected_variants=json.dumps(f.affected_variants),
            affected_years=json.dumps(f.affected_years) if f.affected_years else None,
            source=f.source,
            position=i,
        ))


def _set_prices(db: Session, model: KbModel, prices: list[PriceRangeIn]) -> None:
    _drop_children(db, model, "price_ranges")
    for p in prices:
        model.price_ranges.append(KbPriceRange(
            year_from=p.year_from,
            year_to=p.year_to,
            low_zar=p.low_zar,
            mid_zar=p.mid_zar,
            high_zar=p.high_zar,
        ))


def _set_checklist(db: Session, model: KbModel, items: list[ChecklistItemIn]) -> None:
    _drop_children(db, model, "checklist_items")
    for i, item in enumerate(items):
        model.checklist_items.append(KbChecklistItem(text=item.text, position=i))


def _set_profile(model: KbModel, profile: ModelProfileIn) -> None:
    model.make = profile.make
    model.model = profile.model
    model.variants = json.dumps(profile.variants)
    model.years_covered = profile.years_covered
    model.sa_market_summary = profile.sa_market_summary
    model.reliability_score = profile.reliability_score
    model.segment = profile.segment
    model.fuel_type = profile.fuel_type
    model.fuel_consumption_l_per_100km = profile.fuel_consumption_l_per_100km
    model.annual_maintenance_zar = profile.annual_maintenance_zar
    model.annual_insurance_zar = profile.annual_insurance_zar
    model.owner_sentiment = profile.owner_sentiment
    model.sources = json.dumps(profile.sources)


@router.get("/kb/models", response_model=PagedModels)
def list_models(
    q: str = "",
    status: str = "",
    page: int = 1,
    page_size: int = 20,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(KbModel)
    if q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.filter((KbModel.make.ilike(like)) | (KbModel.model.ilike(like)))
    if status in ("draft", "live", "deleted"):
        query = query.filter(KbModel.status == status)
    else:
        query = query.filter(KbModel.status != "deleted")
    total = query.count()
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    items = query.order_by(KbModel.make, KbModel.model).offset((page - 1) * page_size).limit(page_size).all()
    return PagedModels(items=[_list_item(db, m) for m in items], total=total, page=page, page_size=page_size)


@router.post("/kb/models", response_model=ModelDetail)
def create_model(
    body: ModelCreate,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    slug = kb.slugify(body.make, body.model)
    if db.query(KbModel).filter(KbModel.slug == slug).first():
        raise HTTPException(status_code=409, detail="Model already exists")
    model = KbModel(slug=slug, make=body.make, model=body.model, status="draft")
    db.add(model)
    db.flush()
    _set_profile(model, body)
    _set_faults(db, model, body.faults)
    _set_prices(db, model, body.price_ranges)
    _set_checklist(db, model, body.checklist)
    _save(db, model, admin.email, "kb.create")
    return _detail(db, model)


@router.get("/kb/models/{slug}", response_model=ModelDetail)
def get_model(
    slug: str,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return _detail(db, _get_model(db, slug, include_deleted=True))


@router.put("/kb/models/{slug}/profile", response_model=ModelDetail)
def update_profile(
    slug: str,
    body: ModelProfileIn,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    _set_profile(model, body)
    new_slug = kb.slugify(model.make, model.model)
    if new_slug != model.slug and db.query(KbModel).filter(KbModel.slug == new_slug).first():
        raise HTTPException(status_code=409, detail="A model with that name already exists")
    model.slug = new_slug
    _save(db, model, admin.email, "kb.update_profile")
    return _detail(db, model)


@router.put("/kb/models/{slug}/faults", response_model=ModelDetail)
def replace_faults(
    slug: str,
    body: list[FaultIn],
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    _set_faults(db, model, body)
    _save(db, model, admin.email, "kb.update_faults")
    return _detail(db, model)


@router.post("/kb/models/{slug}/faults")
def add_fault(
    slug: str,
    body: FaultIn,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    position = max([f.position for f in model.faults], default=-1) + 1
    fault = KbFault(
        title=body.title,
        description=body.description,
        severity=body.severity,
        mileage_range=body.mileage_range,
        what_to_inspect=body.what_to_inspect,
        repair_min_zar=body.repair_min_zar,
        repair_max_zar=body.repair_max_zar,
        affected_variants=json.dumps(body.affected_variants),
        affected_years=json.dumps(body.affected_years) if body.affected_years else None,
        source=body.source,
        position=position,
    )
    model.faults.append(fault)
    db.flush()
    _save(db, model, admin.email, "kb.fault_add")
    return {"id": fault.id}


@router.patch("/kb/models/{slug}/faults/{fault_id}")
def edit_fault(
    slug: str,
    fault_id: int,
    body: FaultIn,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    fault = db.query(KbFault).filter(KbFault.id == fault_id, KbFault.model_id == model.id).first()
    if not fault:
        raise HTTPException(status_code=404, detail="Fault not found")
    fault.title = body.title
    fault.description = body.description
    fault.severity = body.severity
    fault.mileage_range = body.mileage_range
    fault.what_to_inspect = body.what_to_inspect
    fault.repair_min_zar = body.repair_min_zar
    fault.repair_max_zar = body.repair_max_zar
    fault.affected_variants = json.dumps(body.affected_variants)
    fault.affected_years = json.dumps(body.affected_years) if body.affected_years else None
    fault.source = body.source
    _save(db, model, admin.email, "kb.fault_edit")
    return {"ok": True}


@router.delete("/kb/models/{slug}/faults/{fault_id}")
def delete_fault(
    slug: str,
    fault_id: int,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    fault = db.query(KbFault).filter(KbFault.id == fault_id, KbFault.model_id == model.id).first()
    if not fault:
        raise HTTPException(status_code=404, detail="Fault not found")
    db.delete(fault)
    _save(db, model, admin.email, "kb.fault_delete")
    return {"ok": True}


@router.put("/kb/models/{slug}/prices", response_model=ModelDetail)
def replace_prices(
    slug: str,
    body: list[PriceRangeIn],
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    _set_prices(db, model, body)
    _save(db, model, admin.email, "kb.update_prices")
    return _detail(db, model)


@router.put("/kb/models/{slug}/checklist", response_model=ModelDetail)
def replace_checklist(
    slug: str,
    body: list[ChecklistItemIn],
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    _set_checklist(db, model, body)
    _save(db, model, admin.email, "kb.update_checklist")
    return _detail(db, model)


@router.post("/kb/models/{slug}/soft-delete")
def soft_delete(
    slug: str,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug)
    model.status = "deleted"
    _save(db, model, admin.email, "kb.soft_delete")
    return {"ok": True}


@router.post("/kb/models/{slug}/restore")
def restore(
    slug: str,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug, include_deleted=True)
    model.status = "live" if model.published_version_id else "draft"
    _save(db, model, admin.email, "kb.restore")
    return {"ok": True}


@router.get("/kb/models/{slug}/diff", response_model=ModelDiff)
def preview_diff(
    slug: str,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug, include_deleted=True)
    old = kb.last_published_snapshot(db, model)
    changes = kb.diff_snapshots(old, kb.snapshot_from_db(model))
    return ModelDiff(
        slug=slug,
        has_changes=bool(changes),
        changes=[DiffChange(path=c["path"], old=c["old"], new=c["new"]) for c in changes],
    )


@router.post("/kb/models/{slug}/publish")
def publish(
    slug: str,
    background: BackgroundTasks,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    from app.services import kb_sync

    model = _get_model(db, slug)
    if model.status == "deleted":
        raise HTTPException(status_code=400, detail="Cannot publish a deleted model")
    job_id = kb_sync.queue_publish(db, background, model, admin.email)
    audit(db, admin.email, "kb.publish_queued", model_slug=model.slug, detail=f"job {job_id}")
    return {"job_id": job_id}


@router.get("/kb/models/{slug}/versions", response_model=PagedVersions)
def list_versions(
    slug: str,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug, include_deleted=True)
    versions = (
        db.query(ModelVersion)
        .filter(ModelVersion.model_id == model.id)
        .order_by(ModelVersion.id.desc())
        .limit(100)
        .all()
    )
    return PagedVersions(
        items=[
            VersionOut(id=v.id, kind=v.kind, created_by=v.created_by, created_at=kb.iso(v.created_at))
            for v in versions
        ],
        total=len(versions),
    )


@router.post("/kb/models/{slug}/rollback/{version_id}", response_model=ModelDetail)
def rollback(
    slug: str,
    version_id: int,
    _csrf: None = Depends(require_csrf),
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    model = _get_model(db, slug, include_deleted=True)
    version = (
        db.query(ModelVersion)
        .filter(ModelVersion.id == version_id, ModelVersion.model_id == model.id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    kb.apply_snapshot(db, model, json.loads(version.snapshot))
    _save(db, model, admin.email, f"kb.rollback:{version_id}")
    return _detail(db, model)


@router.get("/kb/models/{slug}/export")
def export_model(
    slug: str,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Regenerate the legacy JSON file content for a model from the database."""
    model = _get_model(db, slug, include_deleted=True)
    return kb.snapshot_from_db(model)


@router.get("/kb/audit", response_model=PagedAudit)
def list_audit(
    action: str = "",
    actor: str = "",
    page: int = 1,
    page_size: int = 20,
    admin: AdminUser = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action.strip():
        query = query.filter(AuditLog.action == action.strip())
    if actor.strip():
        query = query.filter(AuditLog.actor.ilike(f"%{actor.strip()}%"))
    total = query.count()
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    rows = query.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PagedAudit(
        items=[
            AuditOut(
                id=r.id, actor=r.actor, action=r.action, model_slug=r.model_slug,
                detail=r.detail, created_at=kb.iso(r.created_at),
            )
            for r in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
