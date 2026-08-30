"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Users,
  Stethoscope,
  LayoutDashboard,
  Plus,
  Activity,
  Menu,
  X,
  ShieldCheck,
  Building2,
  ChevronLeft,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    {
      href: "/chat",
      label: "احجز موعدك",
      subtitle: "حجز ذكي بالذكاء الاصطناعي",
      icon: MessageSquare,
    },
    {
      href: "/queue",
      label: "الطابور المباشر",
      subtitle: "تتبع الدور والوقت المتبقي",
      icon: Users,
    },
    {
      href: "/doctor",
      label: "مساعد الطبيب الذكي",
      subtitle: "SOAP Notes & VLM Scanner",
      icon: Stethoscope,
      badge: "Phase 2",
    },
    {
      href: "/clinic",
      label: "لوحة الريسبشن",
      subtitle: "إدارة الدخول والكشوفات",
      icon: LayoutDashboard,
    },
  ];

  return (
    <>
      {/* Mobile Top Bar with Hamburger */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 to-sky-600 flex items-center justify-center text-white shadow-xs">
            <Plus className="w-5 h-5 stroke-[3]" />
          </div>
          <span className="font-black text-lg text-slate-900">عيادتي</span>
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-64 sm:w-72 bg-white border-l border-slate-200/90 flex flex-col justify-between z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } shadow-sm`}
      >
        {/* Top Header & Brand */}
        <div className="p-6">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => setIsOpen(false)}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-sky-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
              <Plus className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xl text-slate-900 tracking-tight">عيادتي</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-bold border border-teal-200">
                  Cloud
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">3eyadaty Smart Healthcare</p>
            </div>
          </Link>

          {/* Navigation Section */}
          <div className="mt-8">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-3 block">
              القائمة الرئيسية
            </span>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                      isActive
                        ? "bg-teal-50 text-teal-900 border border-teal-200/80 shadow-xs font-black"
                        : "text-slate-600 hover:text-teal-800 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          isActive
                            ? "bg-teal-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 group-hover:text-teal-700"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs sm:text-sm block">{item.label}</span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    {item.badge && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-black border border-sky-200">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section: Live Status & Clinic Info */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/60 m-3 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-700 text-[11px]">حالة السيرفر: نشط</span>
            </div>
            <span className="text-[10px] font-bold text-teal-800 bg-teal-100/60 px-2 py-0.5 rounded-md">
              Railway Live
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            <p>العيادة: <strong>د. جوهر هاني</strong></p>
            <p className="text-[10px] text-slate-400 mt-0.5">استشاري الباطنة والقلب</p>
          </div>
        </div>
      </aside>
    </>
  );
}
