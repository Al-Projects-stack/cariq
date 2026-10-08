import { useCallback, useEffect, useState } from "react";
import { adminListUsers, adminCreateUser, adminUpdateUser } from "../../api";
import type { AdminUserItem } from "../../types";
import { Card, Loading, ErrorBox, Empty, Toasts, useToasts, inputCls, btnPrimary } from "../../components/admin/ui";

export function AdminUsers() {
  const { toasts, notify } = useToasts();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await adminListUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminCreateUser(email.trim(), password, role);
      notify("ok", "User created");
      setEmail("");
      setPassword("");
      load();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Create failed");
    }
  }

  async function toggleDisabled(u: AdminUserItem) {
    try {
      await adminUpdateUser(u.id, { disabled: !u.disabled });
      notify("ok", u.disabled ? "User enabled" : "User disabled");
      load();
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Update failed");
    }
  }

  async function resetPassword(u: AdminUserItem) {
    const pw = window.prompt(`New password for ${u.email} (min 8 chars):`);
    if (!pw) return;
    try {
      await adminUpdateUser(u.id, { password: pw });
      notify("ok", "Password reset");
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Reset failed");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} />
      <h1 className="text-xl font-bold text-gray-100">Users</h1>
      <Card>
        <h2 className="text-sm font-semibold text-gray-200">Create editor / admin</h2>
        <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required className={inputCls()} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8)" type="password" required minLength={8} className={inputCls()} />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "editor")} className={inputCls()} aria-label="Role">
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
          <button type="submit" className={btnPrimary()}>Create</button>
        </form>
      </Card>
      {users.length === 0 ? <Empty text="No users." /> : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-100">{u.email}</span>
                <span className="ml-2 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{u.role}</span>
                {u.disabled && <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">disabled</span>}
              </div>
              <div className="flex gap-3 text-xs">
                <button onClick={() => resetPassword(u)} className="text-orange-400 hover:underline">Reset password</button>
                <button onClick={() => toggleDisabled(u)} className={u.disabled ? "text-green-400 hover:underline" : "text-red-400 hover:underline"}>
                  {u.disabled ? "Enable" : "Disable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
