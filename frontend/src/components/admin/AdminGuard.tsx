import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdmin } from "../../contexts/AdminContext";

// Strict CSP scoped to the admin area: no inline scripts, no external
// resources. Applied on mount, removed on unmount so the public site
// (Google Fonts etc.) is unaffected.
const ADMIN_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'";

export function AdminGuard({ children, roles }: { children: React.ReactNode; roles?: ("admin" | "editor")[] }) {
  const { admin, loading } = useAdmin();
  const loc = useLocation();

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.setAttribute("http-equiv", "Content-Security-Policy");
    meta.setAttribute("content", ADMIN_CSP);
    meta.setAttribute("data-admin-csp", "1");
    document.head.appendChild(meta);
    return () => {
      document.head.querySelectorAll("meta[data-admin-csp]").forEach((m) => m.remove());
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading admin...</p>
      </div>
    );
  }
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(admin.role)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
        <p className="text-sm text-gray-400">Forbidden: this page requires an admin role.</p>
      </div>
    );
  }
  return <>{children}</>;
}
