from __future__ import annotations
import re
import uuid
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class QueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    session_id: Optional[str] = Field(default=None)

    @field_validator("question")
    @classmethod
    def sanitise_question(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Question cannot be empty")
        if re.search(r"<[^>]+>", v):
            raise ValueError("Invalid characters in question")
        return v

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("session_id must be a valid UUID")
        return v


class PriceRange(BaseModel):
    low: int
    mid: int
    high: int


class PriceIntelligence(BaseModel):
    model: str
    year: Optional[int]
    price_range: PriceRange
    verdict: str
    verdict_label: str


class KnownFault(BaseModel):
    fault: str
    mileage_range: str
    severity: str
    estimated_repair_zar: str


class QueryResponse(BaseModel):
    answer: str
    price_intelligence: Optional[PriceIntelligence] = None
    known_faults: list[KnownFault] = []
    sources: list[str] = []
    session_id: str


class CarVariant(BaseModel):
    make: str
    model: str
    variants: list[str]
    years_covered: str
    reliability_score: float
    sa_market_summary: str


class CarFault(BaseModel):
    fault: str
    affects_variants: list[str]
    mileage_range: str
    severity: str
    description: str
    what_to_inspect: str
    estimated_repair_zar: str
    source: str


class CarPriceRange(BaseModel):
    year_from: int
    year_to: int
    low_zar: int
    mid_zar: int
    high_zar: int


class CarProfile(BaseModel):
    make: str
    model: str
    variants: list[str]
    years_covered: str
    sa_market_summary: str
    reliability_score: float
    price_ranges: list[CarPriceRange]
    known_faults: list[CarFault]
    what_to_inspect_before_buying: list[str]
    owner_sentiment: str
    sources: list[str]


class HealthResponse(BaseModel):
    status: str
    pinecone: str
    claude: str
    database: str


class CompareRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    make_a: str
    model_a: str
    make_b: str
    model_b: str


class PriceComparison(BaseModel):
    a_mid_zar: int
    a_low_zar: int
    a_high_zar: int
    b_mid_zar: int
    b_low_zar: int
    b_high_zar: int
    price_leader: str
    price_gap_zar: int


class ReliabilityComparison(BaseModel):
    a_score: float
    b_score: float
    winner: str
    gap: float


class FaultsComparison(BaseModel):
    a_total: int
    a_high: int
    a_medium: int
    a_low: int
    b_total: int
    b_high: int
    b_medium: int
    b_low: int


class CompareResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_a: CarProfile
    model_b: CarProfile
    reliability: ReliabilityComparison
    price: PriceComparison
    faults: FaultsComparison
