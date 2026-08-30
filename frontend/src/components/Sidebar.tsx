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
  User,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    {
      href: "/clinic",
      label: "لوحة الريسبشن",
      subtitle: "إدارة الطابور والكشوفات",
      icon: LayoutDashboard,
    },
    {
      href: "/doctor",
      label: "مساعد الطبيب الذكي",
      subtitle: "تقرير SOAP وفحص الأشعة",
      icon: Stethoscope,
    },
    {
      href: "/queue",
      label: "شاشة الطابور المباشر",
      subtitle: "تتبع الدور والوقت المتبقي",
      icon: Users,
    },
    {
      href: "/chat",
      label: "حجز موعد بالذكاء الاصطناعي",
      subtitle: "المساعد الآلي للمرضى",
      icon: MessageSquare,
    },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
            <Plus className="w-5 h-5 stroke-[3]" />
          </div>
          <span className="font-black text-lg text-slate-900">عيادتي</span>
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          aria-label="القائمة"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Main Enterprise Sidebar */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-72 bg-white border-l border-slate-200/90 flex flex-col justify-between z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } shadow-xs`}
      >
        {/* Top Section */}
        <div className="p-5">
          {/* Clinic Brand Header */}
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors group"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-sky-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform shrink-0">
              <Plus className="w-6 h-6 stroke-[3]" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-slate-900 tracking-tight">عيادتي</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-extrabold border border-teal-200">
                  نظام طبي
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">3eyadaty Clinical Management</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="mt-6">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-3 mb-2.5 block text-right">
              الخدمات والأنظمة
            </span>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-right ${
                      isActive
                        ? "bg-teal-50 text-teal-950 border border-teal-200/90 shadow-xs"
                        : "text-slate-700 hover:text-teal-900 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? "bg-teal-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 group-hover:text-teal-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs sm:text-sm block truncate ${isActive ? "font-black" : "font-bold"}`}>
                        {item.label}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block truncate">
                        {item.subtitle}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section: Doctor Profile & Cloud Server Status */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs mb-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-black text-slate-900 truncate">د. جوهر هاني</p>
              <p className="text-[10px] text-slate-500 font-bold truncate">استشاري الباطنة والقلب</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] px-1 text-slate-600 font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>السيرفر السحابي متصل</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">v2.4 Live</span>
          </div>
        </div>
      </aside>
    </>
  );
}
