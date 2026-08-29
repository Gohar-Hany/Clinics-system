"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Users, Stethoscope, LayoutDashboard, Sparkles, Activity } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/chat", label: "احجز موعدك", icon: MessageSquare },
    { href: "/queue", label: "الطابور المباشر", icon: Users },
    { href: "/doctor", label: "مساعد الطبيب الذكي", icon: Stethoscope, badge: "Phase 2" },
    { href: "/clinic", label: "لوحة الريسبشن", icon: LayoutDashboard },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-sky-600 flex items-center justify-center text-xl shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform text-white">
            🏥
          </div>
          <div>
            <span className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-1.5">
              عيادتي
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200">
                AI Cloud
              </span>
            </span>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">3eyadaty Smart Healthcare System</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/25"
                    : "text-slate-600 hover:text-teal-700 hover:bg-teal-50/70"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? "bg-white/20 text-white border border-white/30"
                        : "bg-sky-100 text-sky-800 border border-sky-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live Server Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] text-emerald-800 font-semibold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>سيرفر السحابة لايف</span>
        </div>
      </div>
    </header>
  );
}
