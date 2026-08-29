"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { MessageSquare, Users, Stethoscope, LayoutDashboard, Sparkles, Shield, Zap, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          {/* Animated Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs sm:text-sm font-bold mb-6"
          >
            <Sparkles className="w-4 h-4" />
            <span>نظام إدارة العيادات بالذكاء الاصطناعي السحابي المتكامل</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl sm:text-6xl md:text-7xl font-black mb-6 tracking-tight"
          >
            عيادتك أذكى مع <span className="text-gradient">عيادتي 3eyadaty</span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-base sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            احجز مواعيدك بالذكاء الاصطناعي في ثوانٍ، تابع دورك لحظياً في الطابور، ومساعد سريري ذكي للطبيب لتوليد تقارير SOAP وفحص الأشعة VLM.
          </motion.p>

          {/* Action Navigation Cards */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16"
          >
            {/* Card 1: Chat Booking */}
            <Link
              href="/chat"
              className="group p-6 rounded-3xl glass border border-slate-800 hover:border-brand-500/50 transition-all hover:scale-[1.02] text-right relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand-500/20 flex items-center justify-center text-brand-400 mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-1">احجز موعدك</h3>
              <p className="text-xs text-slate-400">حجز ذكي فوري بالعامية المصرية والإنجليزية</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-400 mt-4 group-hover:translate-x-[-4px] transition-transform">
                ابدأ الحجز الآن <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Card 2: Live Queue */}
            <Link
              href="/queue"
              className="group p-6 rounded-3xl glass border border-slate-800 hover:border-cyan-500/50 transition-all hover:scale-[1.02] text-right relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-1">الطابور المباشر</h3>
              <p className="text-xs text-slate-400">تتبع دورك والوقت التقديري برقم هاتفك</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 mt-4 group-hover:translate-x-[-4px] transition-transform">
                متابعة الطابور <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Card 3: Doctor AI Co-Pilot */}
            <Link
              href="/doctor"
              className="group p-6 rounded-3xl glass border border-slate-800 hover:border-accent-500/50 transition-all hover:scale-[1.02] text-right relative overflow-hidden glow-brand"
            >
              <div className="w-12 h-12 rounded-2xl bg-accent-500/20 flex items-center justify-center text-accent-400 mb-4 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="font-bold text-lg text-white">مساعد الطبيب</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-500/20 text-accent-300 font-bold">
                  Phase 2
                </span>
              </div>
              <p className="text-xs text-slate-400">تسجيل صوتي، تقرير SOAP، فحص الأشعة VLM</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-400 mt-4 group-hover:translate-x-[-4px] transition-transform">
                دخول الطبيب <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Card 4: Reception Dashboard */}
            <Link
              href="/clinic"
              className="group p-6 rounded-3xl glass border border-slate-800 hover:border-emerald-500/50 transition-all hover:scale-[1.02] text-right relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-1">لوحة الريسبشن</h3>
              <p className="text-xs text-slate-400">إدارة وصول المرضى وبدء وإنهاء الكشوفات</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 mt-4 group-hover:translate-x-[-4px] transition-transform">
                لوحة التحكم <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </motion.div>

          {/* System Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 border-t border-slate-900">
            <div className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-brand-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">سرعة استجابة فائقة</h4>
                <p className="text-xs text-slate-500">استعلامات Redis بأقل من 200ms</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">أمان دوائي مشدد</h4>
                <p className="text-xs text-slate-500">فحص فوري لتداخلات الأدوية الخطيرة</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-accent-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">نماذج ذكاء اصطناعي رائدة</h4>
                <p className="text-xs text-slate-500">GPT-4o Multimodal + Whisper</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>عيادتي (3eyadaty) — المنصة الذكية لإدارة العيادات الطبية © 2026</p>
      </footer>
    </div>
  );
}
