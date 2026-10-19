"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, Ticket } from "lucide-react";
import { BrandLink } from "@/components/Brand";
import { useClinicInfo } from "@/lib/hooks";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/chat", label: "احجز موعد", icon: CalendarPlus },
  { href: "/queue", label: "تابع دورك", icon: Ticket },
];

export function PatientHeader() {
  const pathname = usePathname();
  const info = useClinicInfo();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <BrandLink subtitle={info?.clinic_name} />
        <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 ring-1 ring-inset ring-slate-200">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
                  active ? "bg-navy-900 text-white shadow-sm" : "text-ink-2 hover:bg-white hover:text-ink"
                )}
              >
                <Icon className={cx("size-4", active && "text-brand-400")} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
