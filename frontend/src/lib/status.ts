import type { AppointmentStatus } from "@/services/api";

/**
 * One color per visit state, shared by badges, the slot timeline and legends.
 * The fills are a validated colorblind-safe set; badge text uses the dark step
 * of each hue so every label clears 4.5:1.
 */
export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; short: string; tone: string; dot: string; fill: string }
> = {
  scheduled: {
    label: "لم يصل بعد",
    short: "محجوز",
    tone: "bg-brand-50 text-brand-800 ring-brand-300",
    dot: "bg-st-scheduled",
    fill: "bg-st-scheduled",
  },
  checked_in: {
    label: "في الانتظار",
    short: "منتظر",
    tone: "bg-accent-50 text-accent-800 ring-accent-300",
    dot: "bg-st-waiting",
    fill: "bg-st-waiting",
  },
  in_progress: {
    label: "داخل الكشف",
    short: "في الكشف",
    tone: "bg-navy-900 text-white ring-navy-900",
    dot: "bg-brand-400",
    fill: "bg-st-inside",
  },
  completed: {
    label: "انتهى الكشف",
    short: "تم",
    tone: "bg-violet-50 text-violet-800 ring-violet-200",
    dot: "bg-st-done",
    fill: "bg-st-done",
  },
  no_show: {
    label: "لم يحضر",
    short: "غياب",
    tone: "bg-rose-50 text-rose-800 ring-rose-200",
    dot: "bg-st-noshow",
    fill: "bg-st-noshow",
  },
  cancelled: {
    label: "ملغي",
    short: "ملغي",
    tone: "bg-slate-100 text-slate-600 ring-slate-200 line-through",
    dot: "bg-slate-400",
    fill: "bg-st-free",
  },
};
