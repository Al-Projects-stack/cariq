import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdmin } from "../../contexts/AdminContext";

const LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/failures", label: "Failed Questions", end: false },
  { to: "/admin/models", label: "Knowledge Base", end: false },
  { to: "/admin/health", label: "System Health", end: false },
  { to: "/admin/audit", label: "Audit Log", end: false },
  { to: "/admin/users", label: "Users", end: false, adminOnly: true },
];

export function AdminLayout() {
  const { admin, logout } = useAdmin();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-b border-gray-900 bg-gray-900/40 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
          <div className="px-5 py-4">
            <Link to="/" className="text-xl font-extrabold">
              <span className="text-orange-500">Car</span>
              <span className="text-white">IQ</span>
              <span className="ml-2 rounded bg-orange-500/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-widest text-orange-400">
                Admin
              </span>
            </Link>
            {admin && (
              <p className="mt-1 truncate text-xs text-gray-500">
                {admin.email} · {admin.role}
              </p>
            )}
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-6" aria-label="Admin">
            {LINKS.filter((l) => !l.adminOnly || admin?.role === "admin").map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-orange-500/15 text-orange-300" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-500 hover:bg-gray-800 hover:text-gray-200 md:mt-4"
            >
              Log out
            </button>
          </nav>
        </aside>
        <main className="flex-1 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
