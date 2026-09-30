export interface FavoriteCar {
  make: string;
  model: string;
}

const KEY = "cariq_favorite_car";

export function loadFavoriteCar(): FavoriteCar | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FavoriteCar>;
    if (typeof parsed.make === "string" && typeof parsed.model === "string") {
      return { make: parsed.make, model: parsed.model };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFavoriteCar(fav: FavoriteCar): void {
  localStorage.setItem(KEY, JSON.stringify(fav));
}

export function clearFavoriteCar(): void {
  localStorage.removeItem(KEY);
}
