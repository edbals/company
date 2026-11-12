// The only free-standing decoration left on the rationale page: a hand-drawn underline.
// Everything else is a small piece of the product (see Mocks.tsx). Always aria-hidden.
import type { CSSProperties } from "react";

interface DecorProps {
  className?: string;
  style?: CSSProperties;
}

export function Scribble({ className, style }: DecorProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 300 20"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 13C48 5 92 4 140 9s98 3 154-4M30 17c52-5 110-5 170-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
