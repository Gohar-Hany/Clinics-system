"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Stethoscope, Menu, X, ExternalLink, MessageSquareText, Ticket } from "lucide-react";
import { BrandLink } from "@/components/Brand";
import { useClinicInfo } from "@/lib/hooks";
import { cx } from "@/components/ui";
import { API_BASE_URL } from "@/services/api";

const NAV = [
  { href: "/dashboard", label: "لوحة التحكم", hint: "نظرة عامة على اليوم", icon: LayoutDashboard },
  { href: "/reception", label: "الاستقبال", hint: "الوصول والكشوفات", icon: ClipboardList },
  { href: "/doctor", label: "مساعد الطبيب", hint: "التقارير والأشعة", icon: Stethoscope },
];

const PATIENT_LINKS = [
  { href: "/chat", label: "صفحة الحجز", icon: MessageSquareText },
  { href: "/queue", label: "شاشة الطابور", icon: Ticket },
];

function ServerStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch(`${API_BASE_URL}/health`, { cache: "no-store" })
        .then((r) => alive && setOnline(r.ok))
        .catch(() => alive && setOnline(false));
    check();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-navy-200">
      <span className={cx("size-2 rounded-full", online === null ? "bg-navy-300" : online ? "live-dot bg-brand-400" : "bg-rose-400")} />
      {online === null ? "جاري الاتصال…" : online ? "النظام متصل" : "السيرفر غير متاح"}
    </div>
  );
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const info = useClinicInfo();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="bg-cross-pattern flex h-full flex-col bg-navy-900 text-white">
      <div className="flex h-[72px] items-center px-5">
        <BrandLink tone="light" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3" aria-label="القائمة الرئيسية">
        {NAV.map(({ href, label, hint, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                active ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white"
              )}
            >
              {active && <span className="absolute inset-y-2 right-0 w-1 rounded-full bg-brand-400" />}
              <span
                className={cx(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-brand-400 text-navy-900" : "bg-white/5 text-navy-200 group-hover:text-white"
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold">{label}</span>
                <span className={cx("block text-xs", active ? "text-navy-200" : "text-navy-300")}>{hint}</span>
              </span>
            </Link>
          );
        })}

        <div className="px-3 pt-6 pb-2 text-xs font-bold text-navy-300">صفحات المرضى</div>
        {PATIENT_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            target="_blank"
            className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-navy-200 hover:bg-white/5 hover:text-white"
          >
            <span className="flex items-center gap-3">
              <Icon className="size-[18px]" />
              {label}
            </span>
            <ExternalLink className="size-3.5 opacity-70" />
          </Link>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-4">
        {info && (
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent-400 text-navy-900">
              <Stethoscope className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-white">{info.doctor_name}</p>
              <p className="truncate text-xs text-navy-200">{info.doctor_specialty}</p>
            </div>
          </div>
        )}
        <ServerStatus />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pr-[17rem]">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-[17rem] lg:block">{sidebar}</aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy-900 px-4 lg:hidden">
        <BrandLink tone="light" />
        <button onClick={() => setOpen(true)} aria-label="فتح القائمة" className="rounded-lg p-2 text-white hover:bg-white/10">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <aside className="animate-rise absolute inset-y-0 right-0 w-72 max-w-[85vw] shadow-[var(--shadow-pop)]">
            <button onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="absolute top-5 left-4 z-10 rounded-lg p-1.5 text-navy-200 hover:bg-white/10">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm font-medium text-ink-3">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
