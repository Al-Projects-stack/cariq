import { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { listAlerts, markAlertRead, markAllAlertsRead } from "../api";
import type { AlertItem } from "../types";

export function AlertBell() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function fetch() {
    if (!user) return;
    try {
      const data = await listAlerts();
      setAlerts(data.alerts);
      setUnread(data.unread_count);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetch();
    if (!user) return;
    const id = setInterval(fetch, 60000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  async function handleRead(id: number) {
    await markAlertRead(id).catch(() => {});
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    setUnread((n) => Math.max(0, n - 1));
  }

  async function handleReadAll() {
    await markAllAlertsRead().catch(() => {});
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
        aria-label="Alerts"
      >
        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-gray-800 bg-gray-900 shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-gray-100">Alerts</span>
            {unread > 0 && (
              <button onClick={handleReadAll} className="text-xs text-orange-400 hover:text-orange-300 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-gray-400">No alerts yet</p>
                <p className="text-xs text-gray-600 mt-1">Watch a model to get price & fault updates.</p>
              </div>
            ) : (
              <ul>
                {alerts.map((a) => (
                  <li key={a.id} className={`px-4 py-3 border-b border-gray-800/60 flex gap-3 ${a.read ? "opacity-60" : "bg-gray-800/30"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-300">
                        {a.make} {a.model} <span className="text-gray-500 font-normal">· {a.alert_type}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.message}</p>
                      <p className="text-[11px] text-gray-600 mt-1">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                    {!a.read && (
                      <button onClick={() => handleRead(a.id)} className="shrink-0 self-start text-xs text-orange-400 hover:text-orange-300">
                        Mark read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
