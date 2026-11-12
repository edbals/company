/** Hand-drawn, purely decorative shapes. Always aria-hidden and text-free. */

interface DecorProps {
  className?: string;
}

const BLOB_PATHS = {
  a: "M44 -58C58 -44 70 -28 74 -8C78 12 70 34 54 50C38 66 14 76 -8 72C-30 68 -54 50 -66 28C-78 6 -76 -22 -62 -42C-48 -62 -22 -76 0 -74C20 -72 30 -72 44 -58Z",
  b: "M58 -46C72 -26 70 2 60 26C50 50 30 70 4 74C-22 78 -52 66 -64 44C-76 22 -70 -8 -54 -30C-38 -52 -12 -68 12 -68C36 -68 44 -66 58 -46Z",
  c: "M62 -30C74 -8 66 22 48 44C30 66 2 78 -24 70C-50 62 -72 34 -72 6C-72 -22 -52 -48 -28 -60C-4 -72 22 -66 40 -56C50 -50 54 -44 62 -30Z",
} as const;

export type BlobVariant = keyof typeof BLOB_PATHS;

interface BlobProps extends DecorProps {
  variant?: BlobVariant;
}
/** A soft, organic patch of colour. Fill comes from `color`. */
export function Blob({ variant = "a", className = "" }: BlobProps) {
  return (
    <svg
      className={`decor decor-blob ${className}`.trim()}
      viewBox="-90 -90 180 180"
      aria-hidden="true"
      focusable="false"
    >
      <path d={BLOB_PATHS[variant]} fill="currentColor" />
    </svg>
  );
}

/** A small four-point sparkle. */
export function Sparkle({ className = "" }: DecorProps) {
  return (
    <svg
      className={`decor decor-sparkle ${className}`.trim()}
      viewBox="-20 -20 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 -18C2 -8 8 -2 18 0C8 2 2 8 0 18C-2 8 -8 2 -18 0C-8 -2 -2 -8 0 -18Z"
        fill="currentColor"
      />
    </svg>
  );
}

const RAY_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;

/** A sun with a halo and short hand-drawn rays; sits behind the bear. */
export function Sun({ className = "" }: DecorProps) {
  return (
    <svg
      className={`decor decor-sun ${className}`.trim()}
      viewBox="-100 -100 200 200"
      aria-hidden="true"
      focusable="false"
    >
      <circle r="46" fill="currentColor" opacity="0.5" />
      <circle r="30" fill="currentColor" />
      {RAY_ANGLES.map((angle) => (
        <line
          key={angle}
          x1="0"
          y1={angle % 60 === 0 ? -62 : -60}
          x2="0"
          y2={angle % 60 === 0 ? -86 : -74}
          transform={`rotate(${angle})`}
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** A wavy hand-drawn underline stroke. */
export function Scribble({ className = "" }: DecorProps) {
  return (
    <svg
      className={`decor decor-scribble ${className}`.trim()}
      viewBox="0 0 220 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 14C28 6 44 20 70 12C96 4 112 20 140 11C164 4 186 16 216 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
