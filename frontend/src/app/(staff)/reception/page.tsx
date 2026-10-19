"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { clinicApi, type Appointment, type AppointmentStatus, type StatusAction } from "@/services/api";
import { usePolling } from "@/lib/hooks";
import { addDays, formatDayLong, formatTime, isValidEgyptianMobile, minutesSince, normalizeDigits, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/StaffShell";
import { Button, Card, EmptyState, ErrorBanner, Field, Modal, Skeleton, StatusBadge, Ticket, cx, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

type Filter = "all" | "scheduled" | "checked_in" | "in_progress" | "done" | "missed";

const FILTERS: { key: Filter; label: string; match: (s: AppointmentStatus) => boolean }[] = [
  { key: "all", label: "الكل", match: (s) => s !== "cancelled" },
  { key: "scheduled", label: "لم يصل", match: (s) => s === "scheduled" },
  { key: "checked_in", label: "في الانتظار", match: (s) => s === "checked_in" },
  { key: "in_progress", label: "في الكشف", match: (s) => s === "in_progress" },
  { key: "done", label: "انتهى", match: (s) => s === "completed" },
  { key: "missed", label: "غياب / ملغي", match: (s) => s === "no_show" || s === "cancelled" },
];

const ACTION_TOAST: Record<StatusAction, string> = {
  check_in: "تم تسجيل الوصول",
  start: "المريض دخل الكشف",
  complete: "تم إنهاء الكشف",
  no_show: "تم تسجيله غياب",
  cancel: "تم إلغاء الحجز",
};

export default function ReceptionPage() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const isToday = date === todayISO();

  const { data, error, refresh } = usePolling(() => clinicApi.listAppointments(date), 10000, [date]);
  const appts = useMemo(() => data?.appointments ?? [], [data]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, appts.filter((a) => f.match(a.status)).length])) as Record<Filter, number>,
    [appts]
  );

  const visible = useMemo(() => {
    const q = normalizeDigits(query).trim().toLowerCase();
    const match = FILTERS.find((f) => f.key === filter)!.match;
    return appts.filter(
      (a) =>
        match(a.status) &&
        (!q ||
          (a.patient_name || "").toLowerCase().includes(q) ||
          a.patient_phone.includes(q) ||
          a.reference_code.toLowerCase().includes(q))
    );
  }, [appts, filter, query]);

  const inConsult = appts.find((a) => a.status === "in_progress");
  const nextUp = appts.find((a) => a.status === "checked_in") ?? null;

  const act = async (appt: Appointment, action: StatusAction) => {
    if (action === "cancel" && !confirm(`إلغاء حجز ${appt.patient_name || appt.patient_phone} الساعة ${formatTime(appt.time)}؟`)) return;
    setBusy(appt.id);
    try {
      await clinicApi.updateStatus(appt.id, action);
      toast(`${ACTION_TOAST[action]} — ${appt.patient_name || `#${appt.queue_number}`}`);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذر تنفيذ الإجراء", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="الاستقبال"
        subtitle={formatDayLong(date)}
        actions={
          <>
            <div className="flex items-center rounded-xl bg-surface ring-1 ring-line-strong">
              <button onClick={() => setDate(addDays(date, -1))} className="p-2 text-ink-2 hover:text-ink" aria-label="اليوم السابق">
                <ChevronRight className="size-4" />
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="bg-transparent px-1 text-sm focus:outline-none"
                aria-label="اختار اليوم"
              />
              <button onClick={() => setDate(addDays(date, 1))} className="p-2 text-ink-2 hover:text-ink" aria-label="اليوم التالي">
                <ChevronLeft className="size-4" />
              </button>
            </div>
            <Button variant="secondary" onClick={refresh} aria-label="تحديث">
              <RefreshCw className="size-4" />
            </Button>
            <Button onClick={() => setWalkInOpen(true)}>
              <Plus className="size-4" />
              حجز جديد
            </Button>
          </>
        }
      />

      {error && !data && <ErrorBanner message={error} onRetry={refresh} />}

      {/* The two things reception does all day, front and center */}
      {isToday && data && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <Card className={cx("flex items-center gap-4 p-4", inConsult && "ring-2 ring-navy-900")}>
            <span className={cx("flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-black tabular-nums", inConsult ? "bg-navy-900 text-brand-400" : "bg-slate-100 text-ink-3")}>
              {inConsult ? `#${inConsult.queue_number}` : "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink-3">داخل الكشف</p>
              <p className="truncate text-lg font-bold">
                {inConsult ? inConsult.patient_name || inConsult.patient_phone : "مفيش حد جوه"}
              </p>
              {inConsult && <p className="text-xs text-ink-3">من {minutesSince(inConsult.started_at) ?? 0} دقيقة</p>}
            </div>
            {inConsult && (
              <Button variant="success" loading={busy === inConsult.id} onClick={() => act(inConsult, "complete")}>
                <CheckCircle2 className="size-4" />
                إنهاء الكشف
              </Button>
            )}
          </Card>

          <Card className="flex items-center gap-4 p-4">
            <span className={cx("flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-black tabular-nums", nextUp ? "bg-accent-400 text-navy-900" : "bg-slate-100 text-ink-3")}>
              {nextUp ? `#${nextUp.queue_number}` : "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink-3">التالي في الانتظار</p>
              <p className="truncate text-lg font-bold">{nextUp ? nextUp.patient_name || nextUp.patient_phone : "مفيش حد منتظر"}</p>
              {nextUp && <p className="text-xs text-ink-3">ميعاده {formatTime(nextUp.time)}</p>}
            </div>
            {nextUp && (
              <Button loading={busy === nextUp.id} onClick={() => act(nextUp, "start")}>
                <Play className="size-4" />
                دخّله الكشف
              </Button>
            )}
          </Card>
        </div>
      )}

      <Card>
        {/* Filters + search */}
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.key ? "bg-navy-900 text-white" : "text-ink-2 hover:bg-slate-100 hover:text-ink"
                )}
              >
                {f.label}
                <span className={cx("rounded-md px-1.5 text-xs tabular-nums", filter === f.key ? "bg-white/20" : "bg-slate-100 text-ink-3")}>
                  {counts[f.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="relative md:w-64">
            <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث بالاسم أو الرقم أو الكود"
              className={cx(inputClass, "h-10 pr-9 text-sm")}
            />
          </div>
        </div>

        {!data ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="size-5" />}
            title={appts.length ? "مفيش نتايج" : "مفيش حجوزات في اليوم ده"}
            hint={appts.length ? "جرّب فلتر أو بحث تاني." : "الحجوزات من الشات أو الاستقبال هتظهر هنا تلقائياً."}
            action={!appts.length && <Button onClick={() => setWalkInOpen(true)}><Plus className="size-4" />حجز جديد</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((a) => (
              <Row key={a.id} appt={a} busy={busy === a.id} onAction={(action) => act(a, action)} isToday={isToday} />
            ))}
          </ul>
        )}
      </Card>

      {walkInOpen && <WalkInModal
        open
        defaultDate={date < todayISO() ? todayISO() : date}
        onClose={() => setWalkInOpen(false)}
        onBooked={(msg, bookedDate) => {
          toast(msg);
          setWalkInOpen(false);
          setDate(bookedDate);
          refresh();
        }}
      />}
    </>
  );
}

function Row({ appt: a, busy, onAction, isToday }: { appt: Appointment; busy: boolean; onAction: (a: StatusAction) => void; isToday: boolean }) {
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  const primary: { action: StatusAction; label: string; icon: React.ReactNode; variant: "primary" | "secondary" | "success" } | null =
    !isToday
      ? null
      : a.status === "scheduled"
        ? { action: "check_in", label: "تسجيل وصول", icon: <UserCheck className="size-4" />, variant: "secondary" }
        : a.status === "checked_in"
          ? { action: "start", label: "دخول الكشف", icon: <Play className="size-4" />, variant: "primary" }
          : a.status === "in_progress"
            ? { action: "complete", label: "إنهاء الكشف", icon: <CheckCircle2 className="size-4" />, variant: "success" }
            : a.status === "no_show"
              ? { action: "check_in", label: "وصل متأخر", icon: <UserCheck className="size-4" />, variant: "secondary" }
              : null;

  const secondary: { action: StatusAction; label: string; icon: React.ReactNode }[] = [];
  if (isToday && (a.status === "scheduled" || a.status === "checked_in")) secondary.push({ action: "no_show", label: "لم يحضر", icon: <UserX className="size-4" /> });
  if (["scheduled", "checked_in", "no_show"].includes(a.status)) secondary.push({ action: "cancel", label: "إلغاء الحجز", icon: <XCircle className="size-4" /> });

  return (
    <li className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap", a.status === "in_progress" && "bg-brand-50", a.status === "cancelled" && "opacity-60")}>
      <div className="w-16 shrink-0 text-sm font-black text-ink tabular-nums">{formatTime(a.time)}</div>
      <Ticket number={a.queue_number} size="sm" tone={a.status === "in_progress" ? "brand" : "neutral"} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-bold text-ink">{a.patient_name || "بدون اسم"}</p>
        <p className="flex items-center gap-2 text-xs font-medium text-ink-3">
          <a href={`tel:${a.patient_phone}`} className="flex items-center gap-1 hover:text-brand-700" dir="ltr">
            <Phone className="size-3" />
            {a.patient_phone}
          </a>
          <span dir="ltr">{a.reference_code}</span>
          {a.source === "reception" && <span className="rounded bg-accent-50 px-1.5 font-bold text-accent-800">استقبال</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
        <StatusBadge status={a.status} />
        <div className="flex items-center gap-1">
          {primary && (
            <Button size="sm" variant={primary.variant} loading={busy} onClick={() => onAction(primary.action)}>
              {!busy && primary.icon}
              {primary.label}
            </Button>
          )}
          {secondary.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu((m) => !m);
                }}
                aria-label="إجراءات أخرى"
                aria-expanded={menu}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-slate-100 hover:text-ink"
              >
                <MoreHorizontal className="size-5" />
              </button>
              {menu && (
                <div className="animate-rise absolute left-0 z-20 mt-1 w-40 overflow-hidden rounded-xl bg-surface py-1 shadow-[var(--shadow-pop)] ring-1 ring-line">
                  {secondary.map((s) => (
                    <button
                      key={s.action}
                      onClick={() => onAction(s.action)}
                      className={cx("flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50", s.action === "cancel" ? "text-rose-700" : "text-ink-2")}
                    >
                      {s.icon}
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function WalkInModal({
  open,
  defaultDate,
  onClose,
  onBooked,
}: {
  open: boolean;
  defaultDate: string;
  onClose: () => void;
  onBooked: (message: string, date: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  // Slots are stored with the date they belong to, so a date change shows a loader without resetting state in an effect
  const [slotsFor, setSlotsFor] = useState<{ date: string; slots: { time: string; formatted: string }[]; message: string } | null>(null);
  const slots = slotsFor?.date === date ? slotsFor.slots : null;
  const slotMsg = slotsFor?.message ?? "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    clinicApi
      .getSlots(date)
      .then((r) => alive && setSlotsFor({ date, slots: r.available_slots ?? [], message: r.success ? "" : r.message }))
      .catch(() => alive && setSlotsFor({ date, slots: [], message: "تعذر تحميل المواعيد" }));
    return () => {
      alive = false;
    };
  }, [date]);

  const phoneNorm = normalizeDigits(phone).replace(/\s|-/g, "");
  const nameError = touched && name.trim().length < 2 ? "اكتب اسم المريض" : undefined;
  const phoneError = touched && !isValidEgyptianMobile(phoneNorm) ? "رقم موبايل مصري من 11 رقم يبدأ بـ 01" : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (name.trim().length < 2 || !isValidEgyptianMobile(phoneNorm) || !time) return;
    setSaving(true);
    setError(null);
    try {
      const res = await clinicApi.createWalkIn({ patient_name: name.trim(), patient_phone: phoneNorm, date, time, notes: notes.trim() || undefined });
      onBooked(`تم الحجز — دور #${res.queue_number} · ${res.reference_code}`, date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الحجز");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="حجز جديد">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم المريض" error={nameError}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
          </Field>
          <Field label="رقم الموبايل" error={phoneError}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} inputMode="tel" dir="ltr" placeholder="01xxxxxxxxx" />
          </Field>
        </div>

        <Field label="اليوم">
          <input type="date" value={date} min={todayISO()} onChange={(e) => { setDate(e.target.value); setTime(""); }} className={inputClass} />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">الميعاد</p>
          {slots === null ? (
            <Skeleton className="h-20" />
          ) : slots.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-ink-3">{slotMsg || "مفيش مواعيد فاضية في اليوم ده."}</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s.time}
                  onClick={() => setTime(s.time)}
                  aria-pressed={time === s.time}
                  className={cx(
                    "rounded-lg py-2 text-sm font-medium tabular-nums ring-1 transition",
                    time === s.time ? "bg-navy-900 text-white ring-navy-900" : "bg-surface text-ink ring-line-strong hover:bg-brand-50 hover:ring-brand-500"
                  )}
                >
                  {formatTime(s.time)}
                </button>
              ))}
            </div>
          )}
          {touched && !time && slots && slots.length > 0 && <p className="mt-1 text-xs text-rose-600">اختار ميعاد</p>}
        </div>

        <Field label="ملاحظات (اختياري)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="سبب الزيارة، متابعة…" />
        </Field>

        {error && <ErrorBanner message={error} />}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" loading={saving}>تأكيد الحجز</Button>
        </div>
      </form>
    </Modal>
  );
}
