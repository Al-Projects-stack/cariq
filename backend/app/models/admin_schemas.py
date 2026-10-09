"""Strict Pydantic schemas for knowledge-base admin.

Every text field is screened with the existing prompt-injection filter
because this content is later fed to the language model. Unknown fields
are rejected everywhere.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.services.claude_client import sanitise_for_prompt

SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
MIN_YEAR = 1980
MAX_YEAR = datetime.now().year + 1


def _screen_text(v: str) -> str:
    v = v.strip()
    if "<" in v and ">" in v:
        import re

        if re.search(r"<[^>]+>", v):
            raise ValueError("Invalid characters in text")
    sanitise_for_prompt(v)
    return v


def _check_year(v: int) -> int:
    if not (MIN_YEAR <= v <= MAX_YEAR):
        raise ValueError(f"Year must be between {MIN_YEAR} and {MAX_YEAR}")
    return v


class StrictModel(BaseModel):
    model_config = {"extra": "forbid", "protected_namespaces": ()}


class FaultIn(StrictModel):
    title: str = Field(min_length=3, max_length=300)
    description: str = Field(default="", max_length=5000)
    severity: str = Field(default="MEDIUM", max_length=20)
    mileage_range: str = Field(default="", max_length=100)
    what_to_inspect: str = Field(default="", max_length=2000)
    repair_min_zar: Optional[int] = Field(default=None, ge=0)
    repair_max_zar: Optional[int] = Field(default=None, ge=0)
    # NOTE: legacy JSON key is "affects_variants" (kept for exact shape match).
    affects_variants: list[str] = Field(default_factory=list, max_length=50)
    affected_years: Optional[list[int]] = Field(default=None, max_length=60)
    source: str = Field(default="", max_length=500)

    @field_validator("title", "description", "what_to_inspect", "source")
    @classmethod
    def screen(cls, v: str) -> str:
        return _screen_text(v)

    @field_validator("severity")
    @classmethod
    def normalise_severity(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in SEVERITIES:
            raise ValueError(f"Severity must be one of {', '.join(SEVERITIES)}")
        return v

    @field_validator("affected_years")
    @classmethod
    def check_years(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        if v is None:
            return v
        return [_check_year(y) for y in v]

    @field_validator("repair_max_zar")
    @classmethod
    def check_range(cls, v: Optional[int], info) -> Optional[int]:
        lo = (info.data or {}).get("repair_min_zar")
        if v is not None and lo is not None and lo > v:
            raise ValueError("repair_min_zar must be less than or equal to repair_max_zar")
        return v


class PriceRangeIn(StrictModel):
    year_from: int
    year_to: int
    low_zar: int = Field(gt=0)
    mid_zar: int = Field(gt=0)
    high_zar: int = Field(gt=0)

    @field_validator("year_from", "year_to")
    @classmethod
    def check_year(cls, v: int) -> int:
        return _check_year(v)

    @field_validator("year_to")
    @classmethod
    def check_order(cls, v: int, info) -> int:
        if (info.data or {}).get("year_from") is not None and v < info.data["year_from"]:
            raise ValueError("year_to must be greater than or equal to year_from")
        return v

    @field_validator("high_zar")
    @classmethod
    def check_prices(cls, v: int, info) -> int:
        data = info.data or {}
        lo, mid = data.get("low_zar"), data.get("mid_zar")
        if lo is not None and mid is not None and not (lo <= mid <= v):
            raise ValueError("Prices must satisfy low <= mid <= high")
        return v


class ChecklistItemIn(StrictModel):
    text: str = Field(min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def screen(cls, v: str) -> str:
        return _screen_text(v)


class ModelProfileIn(StrictModel):
    """Scalar (non-child-row) fields of a model."""

    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    variants: list[str] = Field(default_factory=list, max_length=60)
    years_covered: str = Field(default="", max_length=50)
    sa_market_summary: str = Field(default="", max_length=8000)
    reliability_score: float = Field(default=0.0, ge=0.0, le=10.0)
    segment: str = Field(default="", max_length=100)
    fuel_type: str = Field(default="", max_length=50)
    fuel_consumption_l_per_100km: Optional[float] = Field(default=None, gt=0)
    annual_maintenance_zar: Optional[int] = Field(default=None, gt=0)
    annual_insurance_zar: Optional[int] = Field(default=None, gt=0)
    owner_sentiment: str = Field(default="", max_length=4000)
    sources: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("sa_market_summary", "owner_sentiment")
    @classmethod
    def screen(cls, v: str) -> str:
        return _screen_text(v)


class ModelCreate(ModelProfileIn):
    faults: list[FaultIn] = Field(default_factory=list, max_length=60)
    price_ranges: list[PriceRangeIn] = Field(default_factory=list, max_length=20)
    checklist: list[ChecklistItemIn] = Field(default_factory=list, max_length=60)


class FaultOut(FaultIn):
    id: int


class PriceRangeOut(PriceRangeIn):
    id: int


class ChecklistItemOut(ChecklistItemIn):
    id: int


class ModelListItem(BaseModel):
    slug: str
    make: str
    model: str
    status: str
    reliability_score: float
    updated_at: str
    published_at: Optional[str] = None
    chunk_count: int
    has_unpublished_changes: bool


class ModelDetail(BaseModel):
    slug: str
    make: str
    model: str
    status: str
    variants: list[str]
    years_covered: str
    sa_market_summary: str
    reliability_score: float
    segment: str
    fuel_type: str
    fuel_consumption_l_per_100km: Optional[float] = None
    annual_maintenance_zar: Optional[int] = None
    annual_insurance_zar: Optional[int] = None
    owner_sentiment: str
    sources: list[str]
    faults: list[FaultOut]
    price_ranges: list[PriceRangeOut]
    checklist: list[ChecklistItemOut]
    updated_at: str
    published_at: Optional[str] = None
    chunk_count: int
    has_unpublished_changes: bool


class PagedModels(BaseModel):
    items: list[ModelListItem]
    total: int
    page: int
    page_size: int


class DiffChange(BaseModel):
    path: str
    old: str = ""
    new: str = ""


class ModelDiff(BaseModel):
    slug: str
    has_changes: bool
    changes: list[DiffChange]


class VersionOut(BaseModel):
    id: int
    kind: str
    created_by: str
    created_at: str


class PagedVersions(BaseModel):
    items: list[VersionOut]
    total: int


class AuditOut(BaseModel):
    id: int
    actor: str
    action: str
    model_slug: Optional[str] = None
    detail: Optional[str] = None
    created_at: str


class PagedAudit(BaseModel):
    items: list[AuditOut]
    total: int
    page: int
    page_size: int


class FailureGroupOut(BaseModel):
    id: int
    sample_question: str
    count: int
    reason: str
    avg_top_score: Optional[float] = None
    status: str
    note: Optional[str] = None
    first_seen: str
    last_seen: str


class PagedFailureGroups(BaseModel):
    items: list[FailureGroupOut]
    total: int
    page: int
    page_size: int


class FailureQueryOut(BaseModel):
    id: int
    question: str
    top_score: Optional[float] = None
    refused: bool = False
    vote: Optional[str] = None
    created_at: str


class FailureChunkOut(BaseModel):
    id: str
    score: Optional[float] = None
    text: str = ""


class FailureGroupDetail(BaseModel):
    group: FailureGroupOut
    queries: list[FailureQueryOut]
    chunks: list[FailureChunkOut]


class ResolveIn(StrictModel):
    note: str = Field(default="", max_length=2000)

    @field_validator("note")
    @classmethod
    def screen(cls, v: str) -> str:
        return _screen_text(v) if v.strip() else v


class EntryPrefill(BaseModel):
    detected_make: Optional[str] = None
    detected_model: Optional[str] = None
    prefill: dict
