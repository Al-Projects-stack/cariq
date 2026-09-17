import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AlertBell } from "./AlertBell";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <motion.header
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
      className={`sticky top-0 z-40 px-6 transition-all duration-300 ${
        scrolled ? "py-3 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl shadow-lg shadow-black/10" : "py-4 border-b border-gray-900/80 bg-gray-950/90 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto max-w-5xl flex items-center justify-between">
        <Link to="/" className="shrink-0 group">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-orange-500 group-hover:brightness-110 transition" style={{ textShadow: "0 0 20px rgba(249,115,22,0.35)" }}>Car</span>
            <span className="text-white">IQ</span>
          </span>
          <p className="text-xs text-gray-700 mt-0.5 font-mono tracking-wide">SA used car intelligence</p>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <Link to="/#models" className="hover:text-gray-200 transition-colors">Models</Link>
            <Link to="/recommend" className="hover:text-gray-200 transition-colors">Find My Car</Link>
            {user && <Link to="/#how-it-works" className="hover:text-gray-200 transition-colors">How it works</Link>}
          </nav>

          {user && <AlertBell />}

          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5">
                Log in
              </Link>
              <Link to="/signup" className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-400 transition-colors shadow shadow-orange-500/20">
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
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-800 bg-gray-900 shadow-xl overflow-hidden z-50"
                >
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
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
