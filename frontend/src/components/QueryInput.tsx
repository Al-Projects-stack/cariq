import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface Props {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

const CHIPS = [
  "BMW 3 Series known faults",
  "Is R250k fair for a Golf 7 GTI?",
  "Toyota Fortuner reliability",
  "What to check on a Ford Ranger",
  "VW Polo Vivo common problems",
  "Honda Jazz long-term reliability",
];

const PLACEHOLDERS = [
  "Is R200k fair for a 2015 Golf GTI?",
  "What to check before buying a used Fortuner?",
  "Ford Ranger 2.2 vs 3.2 reliability?",
  "Best used SUV under R300k in SA?",
  "How many km is too many on a Hilux?",
  "Are Chinese cars reliable long-term?",
  "What causes the EGR issues on NP200 diesels?",
  "Is the Suzuki Swift automatic any good?",
];

function validate(q: string): string | null {
  if (!q.trim()) return "Please enter a question";
  if (q.trim().length < 3) return "Question is too short";
  if (q.length > 500) return "Question must be under 500 characters";
  return null;
}

export function QueryInput({ onSubmit, isLoading }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phText, setPhText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [phCharIdx, setPhCharIdx] = useState(0);
  const [phDeleting, setPhDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (value) return;
    const target = PLACEHOLDERS[phIdx];
    let timer: ReturnType<typeof setTimeout>;
    if (!phDeleting) {
      if (phCharIdx < target.length) {
        timer = setTimeout(() => {
          setPhText(target.slice(0, phCharIdx + 1));
          setPhCharIdx((i) => i + 1);
        }, 40);
      } else {
        timer = setTimeout(() => setPhDeleting(true), 2500);
      }
    } else {
      if (phCharIdx > 0) {
        timer = setTimeout(() => {
          setPhText(target.slice(0, phCharIdx - 1));
          setPhCharIdx((i) => i - 1);
        }, 20);
      } else {
        setPhDeleting(false);
        setPhIdx((i) => (i + 1) % PLACEHOLDERS.length);
      }
    }
    return () => clearTimeout(timer);
  }, [phIdx, phCharIdx, phDeleting, value]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  function handleSubmit() {
    const err = validate(value);
    if (err) { setError(err); return; }
    setError(null);
    onSubmit(value.trim());
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Input container ,  ui-pro-max: glow on focus, smooth transition */}
      <div className="relative group">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
          onKeyDown={handleKey}
          placeholder={phText}
          rows={2}
          disabled={isLoading}
          className="
            w-full resize-none rounded-xl
            border border-gray-700 bg-gray-900
            px-5 py-4 pr-40
            text-base leading-relaxed text-gray-100 placeholder-gray-600
            focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            scrollbar-thin
            font-sans
          "
          style={{ minHeight: "72px" }}
        />

        {/* Submit button ,  ui-pro-max: glow-orange, loading state disables */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !value.trim()}
          aria-label="Submit question to CarIQ"
          className="
            absolute right-3 bottom-3
            flex items-center gap-2
            rounded-lg bg-orange-500 px-4 py-2.5
            text-sm font-semibold text-white
            hover:bg-orange-400 active:scale-95
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
            transition-all duration-150
            glow-orange
            cursor-pointer
          "
        >
          {isLoading ? <LoadingDots /> : <SearchIcon />}
          <span>{isLoading ? "Searching..." : "Ask CarIQ"}</span>
        </button>
      </div>

      {/* Error message ,  ui-pro-max: inline error near the input */}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400 flex items-center gap-1">
          <span aria-hidden className="text-red-400">!</span> {error}
        </p>
      )}

      <p className="mt-2 text-xs text-gray-700">
        Press{" "}
        <kbd className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-xs text-gray-500 border border-gray-700">
          Ctrl+Enter
        </kbd>{" "}
        to submit
      </p>

      {/* Example chips ,  ui-pro-max: min 44px touch target, hover transition */}
      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => { setValue(chip); setError(null); setTimeout(() => textareaRef.current?.focus(), 50); }}
            disabled={isLoading}
            className="
              rounded-full border border-gray-700 bg-gray-900
              px-3 py-1.5 text-xs text-gray-500
              hover:border-orange-500/60 hover:text-orange-400 hover:bg-gray-800
              focus-visible:ring-2 focus-visible:ring-orange-500
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150
              cursor-pointer
            "
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-white animate-bounce"
          style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.8s" }}
        />
      ))}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
