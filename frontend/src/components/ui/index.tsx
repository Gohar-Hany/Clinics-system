"use client";

import { forwardRef, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import type { AppointmentStatus } from "@/services/api";
import { STATUS_META } from "@/lib/status";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
export { cx };

// ───────────── Button ─────────────

type ButtonVariant = "primary" | "brand" | "navy" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  brand: "bg-brand-400 text-navy-900 hover:bg-brand-300 shadow-sm",
  navy: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-slate-50 hover:ring-slate-400",
  ghost: "text-ink-2 hover:bg-slate-100 hover:text-ink",
  danger: "bg-surface text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50",
  success: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }
>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

// ───────────── Card ─────────────

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-[var(--radius-card)] bg-surface ring-1 ring-line shadow-[var(--shadow-card)]", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ───────────── Badges ─────────────

export function StatusBadge({ status, short }: { status: AppointmentStatus; short?: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.scheduled;
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset", meta.tone)}>
      <span className={cx("size-1.5 rounded-full", meta.dot)} />
      {short ? meta.short : meta.label}
    </span>
  );
}

export function Ticket({ number, size = "md", tone = "neutral" }: { number: number; size?: "sm" | "md"; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-bold tabular-nums",
        size === "sm" ? "h-7 min-w-8 px-1.5 text-xs" : "h-9 min-w-10 px-2 text-sm",
        tone === "brand" ? "bg-navy-900 text-brand-400" : "bg-slate-100 text-ink ring-1 ring-inset ring-slate-200"
      )}
    >
      #{number}
    </span>
  );
}

// ───────────── Feedback ─────────────

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-5 animate-spin text-brand-600", className)} />;
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100 text-ink-3">{icon}</div>}
      <p className="font-bold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-3">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-300">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline-offset-2 hover:underline">
          حاول تاني
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

// ───────────── Form ─────────────

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl bg-surface px-3.5 text-[15px] text-ink ring-1 ring-inset ring-line-strong placeholder:text-slate-500 hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow";

// ───────────── Modal ─────────────

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-rise relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-[var(--shadow-pop)] sm:max-w-lg sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-ink-3 hover:bg-slate-100 hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
