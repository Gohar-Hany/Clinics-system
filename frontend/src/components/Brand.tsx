import { useId } from "react";
import Link from "next/link";

const NAVY = "#162937";
const TEAL = "#03CBBE";
const ORANGE = "#FFAB36";

/**
 * The capsule mark from the logo: orange half with a sparkle, teal half with a
 * heartbeat line. `tilted` matches the app-icon / horizontal-lockup angle.
 */
export function PillMark({ size = 32, tilted = true, line = NAVY }: { size?: number; tilted?: boolean; line?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <clipPath id={`${id}-l`}>
          <rect x="0" y="0" width="32" height="64" />
        </clipPath>
        <clipPath id={`${id}-r`}>
          <rect x="32" y="0" width="32" height="64" />
        </clipPath>
      </defs>
      <g transform={tilted ? "rotate(-38 32 32)" : undefined}>
        <rect x="5" y="19" width="54" height="26" rx="13" fill={ORANGE} clipPath={`url(#${id}-l)`} />
        <rect x="5" y="19" width="54" height="26" rx="13" fill={TEAL} clipPath={`url(#${id}-r)`} />
        <rect x="31" y="19" width="2.2" height="26" fill={line} />
        {/* sparkle */}
        <path d="M19 25.5 C19.9 30.2 20.8 31.1 25.5 32 C20.8 32.9 19.9 33.8 19 38.5 C18.1 33.8 17.2 32.9 12.5 32 C17.2 31.1 18.1 30.2 19 25.5 Z" fill={line} />
        {/* heartbeat */}
        <polyline
          points="36.5,32 40.5,32 42.5,27 45.5,37.5 48,29.5 49.8,32 53.5,32"
          fill="none"
          stroke={line}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Rounded navy square with the tilted capsule — the app icon. */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = { sm: "size-8 rounded-[10px]", md: "size-10 rounded-xl", lg: "size-14 rounded-2xl" }[size];
  const px = { sm: 26, md: 32, lg: 46 }[size];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center bg-navy-900 ${box}`}>
      <PillMark size={px} />
    </span>
  );
}

/** Horizontal lockup: wordmark + tilted capsule (as in the brand sheet). */
export function Logo({ tone = "dark", size = "md" }: { tone?: "dark" | "light"; size?: "sm" | "md" | "lg" }) {
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-4xl sm:text-5xl" }[size];
  const mark = { sm: 30, md: 36, lg: 60 }[size];
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="عيادتي">
      <span className={`font-black leading-none tracking-tight ${text} ${tone === "dark" ? "text-navy-900" : "text-white"}`}>عيادتي</span>
      <PillMark size={mark} />
    </span>
  );
}

export function BrandLink({ subtitle, tone = "dark" }: { subtitle?: string; tone?: "dark" | "light" }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="عيادتي — الرئيسية">
      <Logo size="sm" tone={tone} />
      {subtitle && (
        <span className={`hidden border-s ps-3 text-xs leading-tight sm:block ${tone === "dark" ? "border-line-strong text-ink-3" : "border-white/20 text-navy-200"}`}>
          {subtitle}
        </span>
      )}
    </Link>
  );
}
