import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAdmin } from "../../contexts/AdminContext";
import { inputCls, btnPrimary } from "../../components/admin/ui";

export function AdminLogin() {
  const { admin, loading, login } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && admin) return <Navigate to="/admin" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
        <h1 className="text-lg font-bold text-gray-100">
          <span className="text-orange-500">Car</span>IQ Admin
        </h1>
        <p className="mt-1 text-xs text-gray-500">Restricted area. Attempts are logged.</p>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-gray-500">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputCls()} mt-1`}
            autoComplete="username"
            required
          />
        </label>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-widest text-gray-500">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls()} mt-1`}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${btnPrimary(busy)} mt-4 w-full`}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
