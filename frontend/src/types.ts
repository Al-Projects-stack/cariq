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

export interface PriceComparison {
  a_mid_zar: number;
  a_low_zar: number;
  a_high_zar: number;
  b_mid_zar: number;
  b_low_zar: number;
  b_high_zar: number;
  price_leader: string;
  price_gap_zar: number;
}

export interface ReliabilityComparison {
  a_score: number;
  b_score: number;
  winner: string;
  gap: number;
}

export interface FaultsComparison {
  a_total: number;
  a_high: number;
  a_medium: number;
  a_low: number;
  b_total: number;
  b_high: number;
  b_medium: number;
  b_low: number;
}

export interface CompareResponse {
  model_a: CarProfile;
  model_b: CarProfile;
  reliability: ReliabilityComparison;
  price: PriceComparison;
  faults: FaultsComparison;
}

export interface SegmentModelPrice {
  make: string;
  model: string;
  mid_zar: number;
  reliability_score: number;
}

export interface MarketPosition {
  segment: string;
  segment_label: string;
  target_mid_zar: number;
  segment_avg_mid_zar: number;
  segment_low_mid_zar: number;
  segment_high_mid_zar: number;
  segment_count: number;
  price_ranking: string;
  price_percentile: number;
  position_label: string;
  value_label: string;
  peers: SegmentModelPrice[];
}

export interface TCOEstimate {
  purchase_price: number;
  fuel_3yr: number;
  insurance_3yr: number;
  maintenance_3yr: number;
  total_3yr: number;
  monthly: number;
  fuel_type: string;
  fuel_consumption_l_per_100km: number;
  annual_km: number;
}

export interface RecommendModel {
  make: string;
  model: string;
  segment: string;
  mid_zar: number;
  reliability_score: number;
  score: number;
  match_reasons: string[];
}

export interface RecommendResponse {
  recommendations: RecommendModel[];
  total_count: number;
}

export interface AuthResponse {
  token: string;
  user_id: number;
  email: string;
  display_name: string;
}

export interface UserProfile {
  user_id: number;
  email: string;
  display_name: string;
  created_at: string;
}

export interface WatchlistItem {
  id: number;
  make: string;
  model: string;
  created_at: string;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
  total: number;
}

export interface SavedSearchItem {
  id: number;
  label: string;
  query: string;
  filters: string;
  created_at: string;
}

export interface SavedSearchResponse {
  items: SavedSearchItem[];
  total: number;
}

export interface AlertItem {
  id: number;
  make: string;
  model: string;
  alert_type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AlertListResponse {
  alerts: AlertItem[];
  unread_count: number;
  total: number;
}
