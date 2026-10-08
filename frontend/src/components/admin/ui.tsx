import { useState } from "react";

// Shared admin UI primitives: toasts, pagination, empty/error states, diffs.

export interface Toast {
  id: number;
  kind: "ok" | "err";
  text: string;
}

let toastId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(kind: "ok" | "err", text: string) {
    const id = ++toastId;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }
  return { toasts, notify: push };
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
            t.kind === "ok"
              ? "border-green-800 bg-green-950/90 text-green-300"
              : "border-red-800 bg-red-950/90 text-red-300"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-800 bg-gray-900/60 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-gray-500">{label}</p>;
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-800 p-10 text-center">
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-5 py-4 text-sm text-red-300">
      <p>{text}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs font-semibold text-red-200 underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
      <span>
        Page {page} of {pages} ({total} total)
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 disabled:opacity-40 hover:border-orange-500/50"
        >
          Prev
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 disabled:opacity-40 hover:border-orange-500/50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function DiffView({ changes }: { changes: { path: string; old: string; new: string }[] }) {
  if (changes.length === 0) return <p className="text-sm text-gray-500">No differences.</p>;
  const trunc = (s: string) => (s.length > 300 ? s.slice(0, 300) + "..." : s);
  return (
    <div className="space-y-2">
      {changes.map((c, i) => (
        <div key={i} className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs">
          <p className="font-mono text-orange-400">{c.path}</p>
          {c.old && (
            <p className="mt-1 text-red-300">
              <span className="text-gray-600">- </span>
              {trunc(c.old)}
            </p>
          )}
          <p className="mt-1 text-green-300">
            <span className="text-gray-600">+ </span>
            {trunc(c.new)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function inputCls() {
  return "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500";
}

export function btnPrimary(disabled?: boolean) {
  return `rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${disabled ? "" : "shadow-lg shadow-orange-500/20"}`;
}

export function btnGhost() {
  return "rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:border-orange-500/50 hover:text-orange-400 transition-colors";
}
