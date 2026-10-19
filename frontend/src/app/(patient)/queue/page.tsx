"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BellRing, CalendarClock, CheckCircle2, Clock, Search, Users } from "lucide-react";
import { clinicApi, ApiError, type QueuePosition } from "@/services/api";
import { usePolling } from "@/lib/hooks";
import { formatWait, normalizeDigits } from "@/lib/format";
import { Button, Card, ErrorBanner, Spinner, cx, inputClass } from "@/components/ui";

const SAVED_KEY = "clinic-queue-identifier";

export default function QueuePage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Spinner /></div>}>
      <QueueTracker />
    </Suspense>
  );
}

function QueueTracker() {
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState(() => params.get("q") ?? "");
  const [position, setPosition] = useState<QueuePosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const lookup = useCallback(async (value: string, quiet = false) => {
    const ident = normalizeDigits(value).trim();
    if (!ident) return;
    if (!quiet) setSearching(true);
    try {
      const res = await clinicApi.getQueuePosition(ident);
      setPosition(res);
      if (!quiet) setIdentifier(ident);
      setError(null);
      try {
        localStorage.setItem(SAVED_KEY, ident);
      } catch {}
    } catch (e) {
      if (!quiet) {
        setPosition(null);
        setError(
          e instanceof ApiError && e.status === 404
            ? "مش لاقيين حجز بالرقم أو الكود ده. اتأكد من الرقم، أو احجز موعد جديد."
            : e instanceof Error ? e.message : "حصل خطأ، جرّب تاني."
        );
      }
    } finally {
      if (!quiet) setSearching(false);
    }
  }, []);

  // Pre-fill from ?q= (link from the booking card) or the last search
  useEffect(() => {
    let initial = params.get("q");
    if (!initial) {
      try {
        initial = localStorage.getItem(SAVED_KEY);
      } catch {}
    }
    if (!initial) return;
    let alive = true;
    const ident = initial;
    clinicApi
      .getQueuePosition(ident)
      .then((res) => {
        if (!alive) return;
        setPosition(res);
        setIdentifier(ident);
      })
      .catch(() => {}); // a stale saved number just leaves the form empty
    return () => {
      alive = false;
    };
  }, [params]);

  // Keep today's ticket live
  useEffect(() => {
    if (!position?.is_today || !["scheduled", "checked_in"].includes(position.status)) return;
    const id = setInterval(() => lookup(position.reference_code, true), 20000);
    return () => clearInterval(id);
  }, [position, lookup]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">تابع دورك</h1>
        <p className="mt-1 text-ink-2">اكتب رقم موبايلك أو كود الحجز (REF-XXXX)</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(identifier);
        }}
        className="flex gap-2"
      >
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          inputMode="text"
          placeholder="01xxxxxxxxx أو REF-XXXX"
          aria-label="رقم الموبايل أو كود الحجز"
          className={cx(inputClass, "h-12 text-base")}
          dir="ltr"
        />
        <Button type="submit" size="lg" loading={searching}>
          {!searching && <Search className="size-4" />}
          اعرف دورك
        </Button>
      </form>

      <div className="mt-6 space-y-6">
        {error && <ErrorBanner message={error} />}
        {position && <TicketCard position={position} />}
        <LiveBoard highlight={position?.is_today ? position.queue_number : undefined} />
      </div>
    </main>
  );
}

function TicketCard({ position: p }: { position: QueuePosition }) {
  const waitingToday = p.is_today && (p.status === "scheduled" || p.status === "checked_in");

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
        <span className="text-ink-2">
          {p.patient_name ? <strong className="font-semibold text-ink">{p.patient_name}</strong> : "حجزك"} · {p.day_label} · {p.time_label}
        </span>
        <span className="font-medium text-ink-3" dir="ltr">{p.reference_code}</span>
      </div>

      {p.status === "in_progress" && (
        <Banner tone="brand" icon={<BellRing className="size-6" />} title="دورك دلوقتي!" text="اتفضل ادخل للدكتور." />
      )}
      {p.status === "completed" && (
        <Banner tone="green" icon={<CheckCircle2 className="size-6" />} title="الكشف انتهى" text="ألف سلامة عليك 🌿" />
      )}
      {(p.status === "no_show" || p.status === "cancelled") && (
        <Banner
          tone="slate"
          icon={<CalendarClock className="size-6" />}
          title={p.status === "cancelled" ? "الحجز ده اتلغى" : "الحجز ده انتهى"}
          text="لو محتاج ميعاد جديد احجز من صفحة الحجز."
          action={<Link href="/chat" className="font-semibold text-brand-700 hover:underline">احجز موعد</Link>}
        />
      )}
      {!p.is_today && (p.status === "scheduled" || p.status === "checked_in") && (
        <Banner
          tone="slate"
          icon={<CalendarClock className="size-6" />}
          title={`ميعادك ${p.day_label} الساعة ${p.time_label}`}
          text="الطابور المباشر بيشتغل يوم الكشف. افتح الصفحة دي يومها وهتلاقي دورك بيتحدث لوحده."
        />
      )}

      {waitingToday && (
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric label="رقم دورك" value={`#${p.queue_number}`} strong />
            <Metric label="قدامك" value={p.patients_ahead === 0 ? "ولا حد" : `${p.patients_ahead}`} />
            <Metric label="الانتظار التقريبي" value={formatWait(p.estimated_wait_minutes)} />
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-2">
            {p.patients_ahead === 0
              ? "إنت التالي — خليك قريب من غرفة الكشف."
              : p.status === "scheduled"
                ? "أول ما توصل العيادة سجّل وصولك في الاستقبال."
                : "وصولك متسجل ✓ — الصفحة دي بتتحدث لوحدها."}
            <span className="mt-1 block text-xs text-ink-3">
              متوسط الكشف النهارده حوالي {p.avg_consultation_minutes} دقيقة، والوقت تقريبي.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx("rounded-xl px-2 py-3", strong ? "bg-brand-50" : "bg-slate-50")}>
      <p className="text-xs text-ink-3">{label}</p>
      <p className={cx("mt-1 text-xl font-bold sm:text-2xl", strong ? "text-brand-700" : "text-ink")}>{value}</p>
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  text,
  action,
}: {
  tone: "brand" | "green" | "slate";
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  const tones = {
    brand: "bg-navy-900 text-white",
    green: "bg-violet-50 text-violet-900",
    slate: "bg-slate-50 text-ink",
  };
  return (
    <div className={cx("flex items-start gap-4 px-5 py-5", tones[tone])}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1">
        <p className="text-lg font-bold">{title}</p>
        <p className={cx("text-sm font-medium", tone === "brand" ? "text-brand-400" : "text-ink-2")}>{text}</p>
        {action && <div className="mt-2 text-sm">{action}</div>}
      </div>
    </div>
  );
}

function LiveBoard({ highlight }: { highlight?: number }) {
  const { data, loading } = usePolling(() => clinicApi.getQueueDisplay(), 15000);

  return (
    <Card>
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="size-4 text-ink-3" />
          الطابور النهارده
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-ink-3">
          <span className="live-dot size-2 rounded-full bg-brand-400" />
          مباشر
        </span>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="p-5">
          <div className="bg-cross-pattern rounded-xl bg-navy-900 px-5 py-5 text-center text-white">
            <p className="text-sm font-bold text-navy-200">داخل الكشف دلوقتي</p>
            <p className="mt-1 text-5xl font-black text-brand-400 tabular-nums">{data?.now_serving ? `#${data.now_serving}` : "—"}</p>
          </div>

          {data && data.waiting.length > 0 ? (
            <>
              <p className="mt-4 mb-2 text-sm text-ink-3">الأدوار الجاية</p>
              <div className="flex flex-wrap gap-2">
                {data.waiting.slice(0, 12).map((w) => (
                  <span
                    key={w.queue_number}
                    className={cx(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ring-1",
                      w.queue_number === highlight
                        ? "bg-accent-400 text-navy-900 ring-accent-500"
                        : w.arrived
                          ? "bg-surface text-ink ring-line-strong"
                          : "bg-slate-50 text-ink-3 ring-line"
                    )}
                    title={w.arrived ? "وصل العيادة" : "لم يصل بعد"}
                  >
                    #{w.queue_number}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-center text-sm text-ink-3">مفيش حد في الانتظار دلوقتي.</p>
          )}
          {data && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-3">
              <Clock className="size-3.5" />
              متوسط مدة الكشف {data.avg_consultation_minutes} دقيقة · خلص النهارده {data.completed_count}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
