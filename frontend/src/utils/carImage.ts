/**
 * Central naming convention for local car + hero images.
 *
 * Drop real photos into:
 *   frontend/public/cars/<slug>.jpg   (one per model, .jpg preferred)
 *   frontend/public/hero/hero.jpg      (landing hero)
 *   frontend/public/hero/og.jpg        (social share card, 1200x630)
 *
 * Slug = lowercase make + model, non-alphanumerics -> underscore.
 *   "Volkswagen" + "Polo Vivo"  ->  volkswagen_polo_vivo
 *   "Mercedes-Benz" + "C-Class" ->  mercedes_benz_c_class
 *   "BMW" + "3 Series"          ->  bmw_3_series
 */

export function carImageSlug(make: string, model: string): string {
  return `${make}_${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
}

const CAR_EXTS = [".webp", ".jpg", ".jpeg", ".png"] as const;

/** Ordered candidates to try, in order. First file that exists wins. */
export function carImageCandidates(make: string, model: string): string[] {
  const slug = carImageSlug(make, model);
  return CAR_EXTS.map((ext) => `/cars/${slug}${ext}`);
}

export const CAR_PLACEHOLDER_SRC = "/cars/_placeholder.svg";

export const HERO_CANDIDATES = [
  "/hero/hero.jpg",
  "/hero/hero.jpeg",
  "/hero/hero.webp",
  "/hero/hero.png",
] as const;

export const OG_IMAGE_SRC = "/hero/og.jpg";

/**
 * Every slug the UI expects. If you add a model to the backend,
 * drop a matching file here and it lights up automatically.
 */
export const EXPECTED_CAR_IMAGES: { make: string; model: string; slug: string; file: string }[] = [
  { make: "BMW", model: "3 Series", slug: "bmw_3_series", file: "bmw_3_series.jpg" },
  { make: "Chery", model: "Tiggo 4 Pro", slug: "chery_tiggo_4_pro", file: "chery_tiggo_4_pro.jpg" },
  { make: "Ford", model: "Ranger", slug: "ford_ranger", file: "ford_ranger.jpg" },
  { make: "Haval", model: "Jolion", slug: "haval_jolion", file: "haval_jolion.jpg" },
  { make: "Honda", model: "Jazz", slug: "honda_jazz", file: "honda_jazz.jpg" },
  { make: "Hyundai", model: "Grand i10", slug: "hyundai_grand_i10", file: "hyundai_grand_i10.jpg" },
  { make: "Hyundai", model: "i20", slug: "hyundai_i20", file: "hyundai_i20.jpg" },
  { make: "Hyundai", model: "ix35", slug: "hyundai_ix35", file: "hyundai_ix35.jpg" },
  { make: "Isuzu", model: "D-Max", slug: "isuzu_d_max", file: "isuzu_d_max.jpg" },
  { make: "Kia", model: "Sportage", slug: "kia_sportage", file: "kia_sportage.jpg" },
  { make: "Mazda", model: "3", slug: "mazda_3", file: "mazda_3.jpg" },
  { make: "Mercedes-Benz", model: "C-Class", slug: "mercedes_benz_c_class", file: "mercedes_benz_c_class.jpg" },
  { make: "Nissan", model: "NP200", slug: "nissan_np200", file: "nissan_np200.jpg" },
  { make: "Suzuki", model: "Swift", slug: "suzuki_swift", file: "suzuki_swift.jpg" },
  { make: "Toyota", model: "Corolla Cross", slug: "toyota_corolla_cross", file: "toyota_corolla_cross.jpg" },
  { make: "Toyota", model: "Fortuner", slug: "toyota_fortuner", file: "toyota_fortuner.jpg" },
  { make: "Toyota", model: "Hilux", slug: "toyota_hilux", file: "toyota_hilux.jpg" },
  { make: "Volkswagen", model: "Golf", slug: "volkswagen_golf", file: "volkswagen_golf.jpg" },
  { make: "Volkswagen", model: "Polo", slug: "volkswagen_polo", file: "volkswagen_polo.jpg" },
  { make: "Volkswagen", model: "Polo Vivo", slug: "volkswagen_polo_vivo", file: "volkswagen_polo_vivo.jpg" },
];
