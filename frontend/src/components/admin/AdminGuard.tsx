import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdmin } from "../../contexts/AdminContext";

// Strict CSP scoped to the admin area. Applied on mount, removed on unmount
// so the public site is unaffected. connect-src must include the API origin:
// the admin UI and API live on different domains in production, and a
// 'self'-only connect-src silently blocks every admin fetch (TypeError:
// Failed to fetch). Same-origin dev needs no extra entry.
function adminCsp(): string {
  let apiOrigin = "";
  try {
    const base = import.meta.env.VITE_API_URL as string | undefined;
    if (base) {
      const origin = new URL(base).origin;
      if (origin !== window.location.origin) apiOrigin = ` ${origin}`;
    }
  } catch {
    // relative or missing base: same origin, 'self' covers it
  }
  return (
    "default-src 'self'; script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    `connect-src 'self'${apiOrigin}; ` +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; object-src 'none'; base-uri 'self'"
  );
}

export function AdminGuard({ children, roles }: { children: React.ReactNode; roles?: ("admin" | "editor")[] }) {
  const { admin, loading } = useAdmin();
  const loc = useLocation();

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.setAttribute("http-equiv", "Content-Security-Policy");
    meta.setAttribute("content", adminCsp());
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
