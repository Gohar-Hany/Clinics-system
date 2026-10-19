"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  RefreshCw,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";
import { clinicApi, type Appointment } from "@/services/api";
import { usePolling } from "@/lib/hooks";
import { addDays, formatDayLong, formatTime, minutesSince, timeAgo, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/StaffShell";
import { Button, Card, CardHeader, EmptyState, ErrorBanner, Skeleton, StatusBadge, Ticket, cx } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Meter, SlotTimeline, UpcomingDaysChart } from "@/components/dashboard/Charts";

export default function DashboardPage() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [seeding, setSeeding] = useState(false);
  const isToday = date === todayISO();

  const overview = usePolling(() => clinicApi.getDashboard(date), 15000, [date]);
  const dayList = usePolling(() => clinicApi.listAppointments(date), 15000, [date]);
  const d = overview.data;

  const refreshAll = () => {
    overview.refresh();
    dayList.refresh();
  };

  const seed = async () => {
    if (!confirm("ده هيمسح كل الحجوزات الحالية ويحط بيانات تجريبية مكانها. متأكد؟")) return;
    setSeeding(true);
    try {
      const res = await clinicApi.seedDemo();
      toast(res.message);
      refreshAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذر إنشاء البيانات", "error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <PageHeader
        title="لوحة التحكم"
        subtitle={
          <span className="flex items-center gap-2">
            {formatDayLong(date)}
            {overview.updatedAt && (
              <span className="flex items-center gap-1 text-xs">
                <span className="live-dot size-2 rounded-full bg-brand-400" />
                آخر تحديث {overview.updatedAt.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </span>
        }
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
            {!isToday && (
              <Button variant="secondary" onClick={() => setDate(todayISO())}>
                النهارده
              </Button>
            )}
            <Button variant="secondary" onClick={refreshAll} aria-label="تحديث">
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />

      {overview.error && !d && <ErrorBanner message={overview.error} onRetry={refreshAll} />}

      {!d ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          {d.is_off_day && (
            <div className="rounded-xl bg-accent-50 px-4 py-3 text-sm font-bold text-accent-900 ring-1 ring-accent-300">
              اليوم ده إجازة أسبوعية — العيادة مقفولة.
            </div>
          )}

          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <div className="bg-cross-pattern col-span-2 rounded-[var(--radius-card)] bg-navy-900 p-5 text-white shadow-[var(--shadow-card)] lg:col-span-1">
              <p className="flex items-center gap-2 text-sm font-bold text-navy-200">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand-400 text-navy-900">
                  <CalendarDays className="size-4" />
                </span>
                {isToday ? "حالات النهارده" : "حالات اليوم"}
              </p>
              <p className="mt-3 text-5xl font-black tracking-tight">{d.counts.total}</p>
              <div className="mt-3">
                <Meter value={d.capacity.booked} max={d.capacity.slots_per_day} label="نسبة الإشغال" />
                <p className="mt-2 text-xs font-medium text-navy-200">
                  <strong className="text-brand-400">{d.capacity.utilization_pct}%</strong> إشغال · {Math.max(0, d.capacity.slots_per_day - d.capacity.booked)} مواعيد فاضية
                </p>
              </div>
            </div>
            <StatTile
              tone="accent"
              icon={<UserCheck className="size-4" />}
              label="في الانتظار"
              value={d.counts.checked_in}
              foot={`${d.counts.scheduled} لسه موصلوش`}
            />
            <StatTile
              tone="violet"
              icon={<Stethoscope className="size-4" />}
              label="تم الكشف"
              value={d.counts.completed}
              foot={
                d.counts.no_show
                  ? `${d.counts.no_show} غياب · ${d.counts.cancelled} ملغي`
                  : `متوسط الكشف ${d.avg_consultation_today ?? d.avg_consultation_minutes} دقيقة`
              }
            />
            <StatTile
              tone="brand"
              icon={<CalendarRange className="size-4" />}
              label="حجوزات الـ 7 أيام الجاية"
              className="col-span-2 lg:col-span-1"
              value={d.upcoming_7_days}
              foot={`${d.new_bookings_today} حجز جديد اتعمل النهارده`}
            />
          </div>

          {/* Live now + today's slots */}
          <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
            <Card className="lg:col-span-2">
              <CardHeader
                title="دلوقتي في العيادة"
                icon={<Users className="size-4" />}
                action={
                  <Link href="/reception" className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-brand-700 hover:bg-brand-50">
                    الاستقبال <ArrowLeft className="size-3.5" />
                  </Link>
                }
              />
              <div className="px-5 pb-5">
                <NowServing appt={d.now_serving} />
                <p className="mt-5 mb-2 text-sm font-bold text-ink">الدور الجاي ({d.waiting.length})</p>
                {d.waiting.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm font-medium text-ink-3 ring-1 ring-inset ring-slate-200">مفيش حد في الانتظار.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.waiting.slice(0, 4).map((a) => (
                      <li key={a.id} className="flex items-center gap-3 py-2.5">
                        <Ticket number={a.queue_number} size="sm" />
                        <span className="flex-1 truncate text-sm font-bold">{a.patient_name || a.patient_phone}</span>
                        <span className="rounded-md bg-accent-50 px-2 py-0.5 text-xs font-bold text-accent-800">منتظر {minutesSince(a.checked_in_at) ?? 0} د</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader
                title={isToday ? "مواعيد النهارده" : "مواعيد اليوم"}
                subtitle="كل خانة = ميعاد نص ساعة"
                icon={<Clock className="size-4" />}
              />
              <div className="px-5 pb-5">
                {dayList.data ? (
                  <SlotTimeline appointments={dayList.data.appointments} slotsPerDay={d.capacity.slots_per_day} />
                ) : (
                  <Skeleton className="h-28" />
                )}
                <SourceSplit sources={d.sources} />
              </div>
            </Card>
          </div>

          {/* Two weeks ahead */}
          <Card>
            <CardHeader
              title="الحجوزات الجاية"
              subtitle="عدد المواعيد المحجوزة لكل يوم مقابل الطاقة الاستيعابية"
              icon={<CalendarRange className="size-4" />}
            />
            <div className="px-5 pt-4 pb-5">
              <UpcomingDaysChart days={d.upcoming_days} today={d.date} />
            </div>
          </Card>

          {/* Lists */}
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <Card>
              <CardHeader title="المواعيد الجاية" icon={<ClipboardList className="size-4" />} />
              <AppointmentList
                items={d.upcoming_list}
                empty="مفيش مواعيد جاية."
                meta={(a) => `${a.date === d.date ? "النهارده" : formatDayLong(a.date)} · ${formatTime(a.time)}`}
              />
            </Card>
            <Card>
              <CardHeader title="آخر الحجوزات" subtitle="أحدث حجوزات اتعملت من الشات أو الاستقبال" icon={<Bot className="size-4" />} />
              <AppointmentList
                items={d.recent_bookings}
                empty="لسه مفيش حجوزات."
                meta={(a) => `لـ ${formatDayLong(a.date)} ${formatTime(a.time)} · ${timeAgo(a.created_at)}`}
                showSource
              />
            </Card>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={seed} loading={seeding} className="text-ink-3">
              {!seeding && <Database className="size-3.5" />}
              ملء النظام ببيانات تجريبية
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const TILE_TONES = {
  accent: "bg-accent-400 text-navy-900",
  violet: "bg-violet-100 text-violet-800",
  brand: "bg-brand-400 text-navy-900",
};

function StatTile({
  icon,
  label,
  value,
  foot,
  tone,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  foot: string;
  tone: keyof typeof TILE_TONES;
  className?: string;
}) {
  return (
    <Card className={cx("p-5", className)}>
      <p className="flex items-center gap-2 text-sm font-bold text-ink-2">
        <span className={cx("flex size-8 items-center justify-center rounded-lg", TILE_TONES[tone])}>{icon}</span>
        {label}
      </p>
      <p className="mt-3 text-4xl font-black tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs font-medium text-ink-3">{foot}</p>
    </Card>
  );
}

function NowServing({ appt }: { appt: Appointment | null }) {
  if (!appt) {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm font-medium text-ink-3 ring-1 ring-inset ring-slate-200">
        مفيش حد داخل الكشف دلوقتي
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded-xl bg-navy-900 px-4 py-4 text-white">
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand-400 text-lg font-black text-navy-900 tabular-nums">
        #{appt.queue_number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-brand-400">داخل الكشف</p>
        <p className="truncate text-lg font-bold">{appt.patient_name || appt.patient_phone}</p>
      </div>
      <div className="text-left">
        <p className="text-2xl font-black tabular-nums">{minutesSince(appt.started_at) ?? 0}</p>
        <p className="text-xs font-medium text-navy-200">دقيقة</p>
      </div>
    </div>
  );
}

function SourceSplit({ sources }: { sources: { ai_chat: number; reception: number } }) {
  const total = sources.ai_chat + sources.reception;
  if (!total) return null;
  const aiPct = Math.round((100 * sources.ai_chat) / total);
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold text-ink">مصدر حجوزات اليوم</span>
        <span className="text-xs font-medium text-ink-3">{total} حجز</span>
      </div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        <div className="bg-chart-bar" style={{ width: `${aiPct}%` }} />
        <div className="flex-1 bg-chart-accent" />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-ink-2">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-bar" />المساعد الذكي {sources.ai_chat} ({aiPct}%)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-accent" />الاستقبال {sources.reception} ({100 - aiPct}%)</span>
      </div>
    </div>
  );
}

function AppointmentList({
  items,
  empty,
  meta,
  showSource,
}: {
  items: Appointment[];
  empty: string;
  meta: (a: Appointment) => string;
  showSource?: boolean;
}) {
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <ul className="divide-y divide-line px-5 pb-3">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 py-3">
          <Ticket number={a.queue_number} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{a.patient_name || "مريض"}</p>
            <p className="truncate text-xs font-medium text-ink-3">{meta(a)}</p>
          </div>
          {showSource ? (
            <span
              className={cx(
                "rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset",
                a.source === "reception" ? "bg-accent-50 text-accent-800 ring-accent-300" : "bg-brand-50 text-brand-800 ring-brand-300"
              )}
            >
              {a.source === "reception" ? "استقبال" : "شات"}
            </span>
          ) : (
            <StatusBadge status={a.status} short />
          )}
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={cx("h-36", i === 0 && "col-span-2 lg:col-span-1")} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72 lg:col-span-3" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
