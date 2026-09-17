import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AlertBell } from "./AlertBell";
import { useState, useRef, useEffect } from "react";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-900/80 bg-gray-950/90 backdrop-blur-sm px-6 py-4">
      <div className="mx-auto max-w-5xl flex items-center justify-between">
        <Link to="/" className="shrink-0">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-orange-500" style={{ textShadow: "0 0 20px rgba(249,115,22,0.4)" }}>Car</span>
            <span className="text-white">IQ</span>
          </span>
          <p className="text-xs text-gray-700 mt-0.5 font-mono tracking-wide">SA used car intelligence</p>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <Link to="/#results" className="hover:text-gray-200 transition-colors">Results</Link>
            <Link to="/#models" className="hover:text-gray-200 transition-colors">Models</Link>
            <Link to="/recommend" className="hover:text-gray-200 transition-colors">Find My Car</Link>
          </nav>

          {user && <AlertBell />}

          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5">
                Log in
              </Link>
              <Link to="/signup" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition-colors">
                Sign up
              </Link>
            </div>
          ) : (
            <div className="relative" ref={ref}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 px-3 py-1.5 hover:border-gray-700 transition-colors"
              >
                <span className="h-7 w-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                  {(user.display_name || user.email).charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-sm text-gray-300 max-w-[120px] truncate">{user.display_name || user.email}</span>
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-800 bg-gray-900 shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-sm font-medium text-gray-200 truncate">{user.display_name || "User"}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link to="/watchlist" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800">
                    Watchlist
                  </Link>
                  <Link to="/history" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800">
                    History
                  </Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800">
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
