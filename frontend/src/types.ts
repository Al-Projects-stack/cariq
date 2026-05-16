export interface PriceRange {
  low: number;
  mid: number;
  high: number;
}

export interface PriceIntelligence {
  model: string;
  year: number | null;
  price_range: PriceRange;
  verdict: "GOOD DEAL" | "FAIR" | "ABOVE MARKET" | "OVERPRICED";
  verdict_label: string;
}

export interface KnownFault {
  fault: string;
  mileage_range: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  estimated_repair_zar: string;
}

export interface QueryResponse {
  answer: string;
  price_intelligence: PriceIntelligence | null;
  known_faults: KnownFault[];
  sources: string[];
  session_id: string;
}

export interface CarVariant {
  make: string;
  model: string;
  variants: string[];
  years_covered: string;
  reliability_score: number;
  sa_market_summary: string;
}

export interface CarFault {
  fault: string;
  affects_variants: string[];
  mileage_range: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  what_to_inspect: string;
  estimated_repair_zar: string;
  source: string;
}

export interface CarPriceRange {
  year_from: number;
  year_to: number;
  low_zar: number;
  mid_zar: number;
  high_zar: number;
}

export interface CarProfile {
  make: string;
  model: string;
  variants: string[];
  years_covered: string;
  sa_market_summary: string;
  reliability_score: number;
  price_ranges: CarPriceRange[];
  known_faults: CarFault[];
  what_to_inspect_before_buying: string[];
  owner_sentiment: string;
  sources: string[];
}
