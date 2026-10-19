"use client";

import { useState } from "react";
import type { Appointment, AppointmentStatus, DashboardOverview } from "@/services/api";
import { STATUS_META } from "@/lib/status";
import { formatDayShort, formatTime } from "@/lib/format";
import { cx } from "@/components/ui";

// ───────────── Bookings per day (column chart) ─────────────
// One series (bookings) drawn over a lighter capacity track of the same hue,
// so "how full is each day" reads without a second color.

export function UpcomingDaysChart({ days, today }: { days: DashboardOverview["upcoming_days"]; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(16, ...days.map((d) => Math.max(d.capacity, d.count)));
  const ticks = [0, Math.round(max / 2), max];
  const H = 160;

  return (
    <div className="relative">
      <div className="flex gap-2">
        {/* Y axis (recessive) */}
        <div className="relative w-6 shrink-0 text-[11px] font-medium text-ink-3 tabular-nums" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* Gridlines */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-chart-grid" style={{ bottom: `${(t / max) * H}px` }} />
          ))}

          <div className="relative flex items-end gap-[2px]" style={{ height: H }} role="img" aria-label="عدد الحجوزات لكل يوم خلال الأسبوعين الجايين">
            {days.map((d, i) => {
              const isToday = d.date === today;
              return (
                <div
                  key={d.date}
                  className={cx("group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center", i >= 7 && "max-sm:hidden")}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${d.weekday} ${formatDayShort(d.date)}: ${d.is_off_day ? "إجازة" : `${d.count} حجز من ${d.capacity}`}`}
                >
                  {d.is_off_day ? (
                    <span className="mb-1 text-[11px] font-bold text-ink-3 [writing-mode:vertical-rl]">إجازة</span>
                  ) : (
                    <div className="relative w-full max-w-6" style={{ height: `${(d.capacity / max) * 100}%` }}>
                      <div className="absolute inset-0 rounded-t-[4px] bg-chart-track" />
                      <div
                        className={cx(
                          "absolute inset-x-0 bottom-0 rounded-t-[4px] transition-all",
                          isToday ? "bg-chart-today" : "bg-chart-bar",
                          hover === i && "brightness-110"
                        )}
                        style={{ height: `${(d.count / Math.max(d.capacity, 1)) * 100}%` }}
                      />
                      {isToday && (
                        <span className="absolute -top-5 inset-x-0 text-center text-xs font-black text-ink tabular-nums">{d.count}</span>
                      )}
                    </div>
                  )}
                  {hover === i && !d.is_off_day && (
                    <div
                      className={cx(
                        "pointer-events-none absolute bottom-full z-10 mb-2 rounded-lg bg-ink px-3 py-2 text-xs whitespace-nowrap text-white shadow-[var(--shadow-pop)]",
                        i < 2 ? "right-0" : i >= days.length - 2 || i === 5 || i === 6 ? "left-0" : "left-1/2 -translate-x-1/2"
                      )}
                    >
                      <p className="font-semibold">{d.weekday} {formatDayShort(d.date)}</p>
                      <p className="text-white/80">
                        {d.count} حجز من {d.capacity} · {Math.round((100 * d.count) / Math.max(d.capacity, 1))}% إشغال
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* X axis labels */}
          <div className="mt-2 flex gap-[2px] text-center text-[11px] font-medium text-ink-3">
            {days.map((d, i) => (
              <div key={d.date} className={cx("min-w-0 flex-1 truncate leading-tight", d.date === today && "font-black text-ink", i >= 7 && "max-sm:hidden")}>
                <span className="block truncate">{d.date === today ? "اليوم" : d.weekday.replace("ال", "")}</span>
                <span>{formatDayShort(d.date)}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-ink-2">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-chart-bar" />محجوز</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-chart-today" />النهارده</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-chart-track ring-1 ring-brand-200" />متاح</span>
      </div>
    </div>
  );
}

// ───────────── Today's slot timeline ─────────────

const SLOT_ORDER: (AppointmentStatus | "free")[] = ["completed", "in_progress", "checked_in", "scheduled", "no_show", "free"];

const SLOT_FILL: Record<AppointmentStatus | "free", string> = {
  ...(Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.fill])) as Record<AppointmentStatus, string>),
  free: "bg-st-free",
};

export function SlotTimeline({ appointments, slotsPerDay }: { appointments: Appointment[]; slotsPerDay: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const slots = Array.from({ length: slotsPerDay }, (_, i) => {
    const minutes = 9 * 60 + i * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
  });
  const bySlot = new Map(appointments.filter((a) => a.status !== "cancelled").map((a) => [a.time, a]));
  const hovered = hover ? bySlot.get(hover) : undefined;

  return (
    <div>
      <div className="flex gap-[2px]" role="list" aria-label="مواعيد النهارده">
        {slots.map((time) => {
          const appt = bySlot.get(time);
          const status = appt?.status ?? "free";
          return (
            <div
              key={time}
              role="listitem"
              tabIndex={0}
              onMouseEnter={() => setHover(time)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(time)}
              onBlur={() => setHover(null)}
              aria-label={`${formatTime(time)}: ${appt ? `${appt.patient_name || "مريض"} — ${STATUS_META[appt.status].label}` : "فاضي"}`}
              className={cx("h-11 flex-1 rounded-[4px] transition", SLOT_FILL[status], status === "free" && "ring-1 ring-inset ring-slate-200", hover === time && "ring-2 ring-navy-900 ring-offset-2")}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium text-ink-3 tabular-nums">
        <span>{formatTime(slots[0])}</span>
        <span>{formatTime("13:00")}</span>
        <span>{formatTime(slots[slots.length - 1])}</span>
      </div>

      <div className="mt-3 min-h-10 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200">
        {hover ? (
          <span>
            <strong className="font-semibold">{formatTime(hover, true)}</strong> —{" "}
            {hovered ? `${hovered.patient_name || "مريض"} · ${STATUS_META[hovered.status].label}` : "ميعاد فاضي"}
          </span>
        ) : (
          <span className="text-ink-3">مرّر أو اضغط على أي خانة لتفاصيل الميعاد</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-ink-2">
        {SLOT_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cx("size-3 rounded-sm", SLOT_FILL[s], s === "free" && "ring-1 ring-inset ring-slate-300")} />
            {s === "free" ? "فاضي" : STATUS_META[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ───────────── Meter ─────────────

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((100 * value) / Math.max(max, 1)));
  return (
    <div role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
