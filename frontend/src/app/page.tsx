"use client";

import Link from "next/link";
import { ArrowLeft, CalendarPlus, Clock, HeartPulse, MapPin, MessageCircle, ShieldCheck, Stethoscope, Ticket } from "lucide-react";
import { Logo } from "@/components/Brand";
import { useClinicInfo } from "@/lib/hooks";
import { formatTime } from "@/lib/format";

export default function HomePage() {
  const info = useClinicInfo();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Hero */}
      <section className="bg-cross-pattern relative overflow-hidden bg-navy-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <Logo tone="light" />
          <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-sm font-bold text-navy-200 ring-1 ring-white/15 hover:bg-white/5 hover:text-white">
            دخول فريق العيادة
          </Link>
        </div>

        <div className="mx-auto max-w-5xl px-4 pt-8 pb-28 text-center sm:pt-14 sm:pb-36">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold text-white ring-1 ring-white/15">
            <Stethoscope className="size-4 text-brand-400" />
            {info ? `${info.doctor_name} — ${info.doctor_specialty}` : "أهلاً بحضرتك"}
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{info?.clinic_name ?? "عيادتي"}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg font-medium text-navy-200">
            احجز موعدك في أقل من دقيقة، واعرف دورك وإنت في البيت
            <span className="mt-1 block font-bold text-brand-400">من غير مكالمات ولا انتظار.</span>
          </p>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-20 w-full max-w-5xl flex-1 px-4 pb-12 sm:-mt-24">
        {/* The two things a patient comes for */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/chat"
            className="group rounded-2xl bg-brand-400 p-6 text-navy-900 shadow-[var(--shadow-pop)] ring-1 ring-brand-300 transition hover:bg-brand-300 sm:p-8"
          >
            <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-navy-900 text-brand-400">
              <CalendarPlus className="size-6" />
            </span>
            <h2 className="text-2xl font-black">احجز موعد</h2>
            <p className="mt-1.5 font-medium text-navy-800">قول اليوم اللي يناسبك، والمساعد يحجزلك ويأكدلك فوراً.</p>
            <span className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 font-bold text-white">
              ابدأ الحجز
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            </span>
          </Link>

          <Link
            href="/queue"
            className="group rounded-2xl bg-surface p-6 shadow-[var(--shadow-pop)] ring-1 ring-line transition hover:ring-brand-400 sm:p-8"
          >
            <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-accent-400 text-navy-900">
              <Ticket className="size-6" />
            </span>
            <h2 className="text-2xl font-black text-ink">تابع دورك</h2>
            <p className="mt-1.5 font-medium text-ink-2">برقم موبايلك أو كود الحجز: اعرف فاضل قدامك كام واحد ووقت دخولك.</p>
            <span className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold text-brand-700 ring-1 ring-inset ring-brand-300">
              اعرف دورك
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            </span>
          </Link>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <InfoTile icon={<Clock className="size-5" />} title="مواعيد العمل">
            {info
              ? `يومياً ${formatTime(info.hours.open, true)} – ${formatTime(info.hours.close, true)}، و${info.hours.off_days.join("، ")} إجازة`
              : "…"}
          </InfoTile>
          <InfoTile icon={<MessageCircle className="size-5" />} title="احجز بكلامك">
            اكتب زي ما بتتكلم: «عايز أحجز بكره الساعة 11» — بالعربي أو الإنجليزي.
          </InfoTile>
          <InfoTile icon={info?.address ? <MapPin className="size-5" /> : <ShieldCheck className="size-5" />} title={info?.address ? "العنوان" : "تأكيد فوري"}>
            {info?.address || "بتاخد رقم دور وكود حجز فوراً، وتقدر تعدّل أو تلغي في أي وقت."}
          </InfoTile>
        </section>

        <p className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-ink-2">
          <HeartPulse className="size-4 text-rose-600" />
          للحالات الطارئة اتصل بالإسعاف فوراً على <strong className="text-ink">123</strong>
        </p>
      </main>

      <footer className="border-t border-line bg-surface py-5 text-center text-sm text-ink-3">
        © {new Date().getFullYear()} {info?.clinic_name ?? "عيادتي"}
      </footer>
    </div>
  );
}

function InfoTile({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
        <h3 className="font-bold text-ink">{title}</h3>
      </div>
      <p className="text-sm font-medium text-ink-2">{children}</p>
    </div>
  );
}
