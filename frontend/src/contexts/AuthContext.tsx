import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserProfile, AuthResponse } from "../types";
import { getMe, getAuthToken } from "../api";

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (data: AuthResponse) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!getAuthToken());

  const logout = useCallback(() => {
    localStorage.removeItem("cariq_token");
    setToken(null);
    setUser(null);
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

  // keep token state in sync with localStorage changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cariq_token") setToken(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
