import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AdminSession } from "../types";
import { adminLogin, adminLogout, adminMe, adminRefresh } from "../api";

interface AdminState {
  admin: AdminSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminState | undefined>(undefined);

async function loadSession(): Promise<AdminSession | null> {
  try {
    return await adminMe();
  } catch {
    try {
      await adminRefresh();
      return await adminMe();
    } catch {
      return null;
    }
  }
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession()
      .then(setAdmin)
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await adminLogin(email, password);
    setAdmin({ email: session.email, role: session.role });
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } catch {
      // ignore: cookies are cleared server-side best-effort
    }
    setAdmin(null);
  }, []);

  return (
    <AdminContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminState {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
