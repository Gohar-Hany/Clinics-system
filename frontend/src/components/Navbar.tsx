"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Users, Stethoscope, LayoutDashboard, Activity } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/chat", label: "احجز موعدك", icon: MessageSquare },
    { href: "/queue", label: "الطابور المباشر", icon: Users },
    { href: "/doctor", label: "مساعد الطبيب الذكي", icon: Stethoscope, badge: "Phase 2" },
    { href: "/clinic", label: "لوحة الريسبشن", icon: LayoutDashboard },
  ];

  return (
    <header className="glass border-b border-slate-800/80 px-4 sm:px-6 py-3.5 sticky top-0 z-50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-accent-500 flex items-center justify-center text-xl shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            🏥
          </div>
          <div>
            <span className="font-extrabold text-xl text-white tracking-tight flex items-center gap-1.5">
              عيادتي
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-medium border border-brand-500/30">
                AI Cloud
              </span>
            </span>
            <p className="text-[10px] text-slate-400 hidden sm:block">3eyadaty Smart Clinic Platform</p>
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
                className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full bg-accent-500/20 text-accent-300 border border-accent-500/30 font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live Server Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full glass-light border border-slate-700/50 text-[11px] text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Railway Live Cloud</span>
        </div>
      </div>
    </header>
  );
}
