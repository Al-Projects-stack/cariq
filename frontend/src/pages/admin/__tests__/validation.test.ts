import { describe, it, expect } from "vitest";
import { validateFault, validatePrice } from "../ModelEditor";
import type { AdminFault, AdminPriceRange } from "../../../types";

const goodFault = (over: Partial<AdminFault> = {}): AdminFault => ({
  title: "CVT shudder",
  description: "Shudders.",
  severity: "MEDIUM",
  mileage_range: "60,000km+",
  what_to_inspect: "Test drive",
  repair_min_zar: 5000,
  repair_max_zar: 12000,
  affects_variants: ["1.8 XS"],
  affected_years: null,
  source: "Forums",
  ...over,
});

const goodPrice = (over: Partial<AdminPriceRange> = {}): AdminPriceRange => ({
  year_from: 2019,
  year_to: 2022,
  low_zar: 200000,
  mid_zar: 250000,
  high_zar: 300000,
  ...over,
});

describe("validateFault", () => {
  it("accepts a valid fault", () => {
    expect(validateFault(goodFault())).toBeNull();
  });

  it("rejects short titles", () => {
    expect(validateFault(goodFault({ title: "x" }))).toMatch(/3 characters/);
  });

  it("rejects inverted repair range", () => {
    expect(validateFault(goodFault({ repair_min_zar: 20000, repair_max_zar: 5000 }))).toMatch(/min.*max/i);
  });

  it("allows empty repair costs", () => {
    expect(validateFault(goodFault({ repair_min_zar: null, repair_max_zar: null }))).toBeNull();
  });
});

describe("validatePrice", () => {
  it("accepts a valid band", () => {
    expect(validatePrice(goodPrice())).toBeNull();
  });

  it("rejects non-positive prices", () => {
    expect(validatePrice(goodPrice({ low_zar: 0 }))).toMatch(/positive/);
  });

  it("rejects low > mid > high violations", () => {
    expect(validatePrice(goodPrice({ low_zar: 300000, mid_zar: 200000, high_zar: 250000 }))).toMatch(/low.*mid.*high/i);
  });

  it("rejects inverted years", () => {
    expect(validatePrice(goodPrice({ year_from: 2022, year_to: 2020 }))).toMatch(/year_to/);
  });
});
