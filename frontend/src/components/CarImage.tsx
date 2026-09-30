import { useState } from "react";
import { carImageCandidates, CAR_PLACEHOLDER_SRC, HERO_CANDIDATES } from "../utils/carImage";

interface CarImageProps {
  make: string;
  model: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}

/**
 * Car photo with graceful fallback:
 * tries /cars/<slug>.jpg -> .jpeg -> .webp -> .png, then _placeholder.svg,
 * then a styled monogram div (never a broken <img> icon).
 */
export function CarImage({ make, model, className = "", imgClassName = "", eager = false }: CarImageProps) {
  const [idx, setIdx] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const candidates = [...carImageCandidates(make, model), CAR_PLACEHOLDER_SRC];
  const src = candidates[Math.min(idx, candidates.length - 1)];

  if (failedAll) {
    const initials = `${make.charAt(0)}${model.charAt(0)}`.toUpperCase();
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 ${className}`}
        role="img"
        aria-label={`${make} ${model}`}
      >
        <div className="flex flex-col items-center gap-1 p-4 text-center">
          <svg className="h-8 w-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11m-14 0h14a2 2 0 012 2v4h-2.2M5 11a2 2 0 00-2 2v4h2.2m0 0a2 2 0 104 0m-4 0h4m4 0a2 2 0 104 0m-4 0h4m-8 0h4m-10-6v6m16-6v6" />
          </svg>
          <span className="text-lg font-black text-gray-600">{initials}</span>
          <span className="text-[11px] text-gray-600">{make} {model}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-gray-900 ${className}`}>
      <img
        src={src}
        alt={`${make} ${model}`}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        className={`h-full w-full object-cover ${imgClassName}`}
        onError={() => {
          if (idx < candidates.length - 1) setIdx(idx + 1);
          else setFailedAll(true);
        }}
      />
    </div>
  );
}

/**
 * Landing hero photo. Renders nothing until /hero/hero.* exists,
 * so the page looks fine before you drop the file in.
 */
export function HeroImage({ className = "" }: { className?: string }) {
  const [idx, setIdx] = useState(0);
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <img
      src={HERO_CANDIDATES[idx]}
      alt="Used cars in South Africa"
      loading="eager"
      draggable={false}
      onError={() => {
        if (idx < HERO_CANDIDATES.length - 1) setIdx(idx + 1);
        else setMissing(true);
      }}
      className={className}
    />
  );
}
