import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserProfile, AuthResponse } from "../types";
import { getMe, getAuthToken } from "../api";
import { loadFavoriteCar, saveFavoriteCar, clearFavoriteCar } from "../utils/favorite";
import type { FavoriteCar } from "../utils/favorite";

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  favoriteCar: FavoriteCar | null;
  login: (data: AuthResponse) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  setFavoriteCar: (fav: FavoriteCar) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!getAuthToken());
  const [favoriteCar, setFavoriteCarState] = useState<FavoriteCar | null>(() => loadFavoriteCar());

  const setFavoriteCar = useCallback((fav: FavoriteCar) => {
    saveFavoriteCar(fav);
    setFavoriteCarState(fav);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("cariq_token");
    clearFavoriteCar();
    setToken(null);
    setUser(null);
    setFavoriteCarState(null);
  }, []);

  const login = useCallback((data: AuthResponse) => {
    localStorage.setItem("cariq_token", data.token);
    setToken(data.token);
    setUser({ user_id: data.user_id, email: data.email, display_name: data.display_name, created_at: "" });
  }, []);

  const refresh = useCallback(async () => {
    const t = getAuthToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) refresh();
    else setLoading(false);
  }, [token, refresh]);

  // keep token + favourite state in sync with localStorage changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cariq_token") setToken(e.newValue);
      if (e.key === "cariq_favorite_car") setFavoriteCarState(loadFavoriteCar());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, favoriteCar, login, logout, refresh, setFavoriteCar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
