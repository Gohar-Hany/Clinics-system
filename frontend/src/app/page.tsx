"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { MessageSquare, Users, Stethoscope, LayoutDashboard, Sparkles, Shield, Zap, ArrowRight, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16 relative overflow-hidden">
        {/* Subtle Ambient Background Highlights */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-teal-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -left-20 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Animated Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs sm:text-sm font-bold mb-6 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>نظام إدارة العيادات الذكي المتكامل بالذكاء الاصطناعي السحابي</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl sm:text-6xl md:text-7xl font-black mb-6 tracking-tight text-slate-900 leading-tight"
          >
            رعاية طبية أذكى مع <span className="text-gradient">عيادتي 3eyadaty</span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-base sm:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed font-normal"
          >
            احجز مواعيدك بالذكاء الاصطناعي في ثوانٍ، تابع دورك لحظياً في الطابور برقم هاتفك، ومساعد سريري ذكي للطبيب لتوليد تقارير SOAP وفحص الأشعة VLM.
          </motion.p>

          {/* Action Navigation Cards */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16"
          >
            {/* Card 1: Chat Booking */}
            <Link
              href="/chat"
              className="group p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-teal-400 transition-all duration-300 hover:scale-[1.02] text-right relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-xs">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 mb-1">احجز موعدك</h3>
              <p className="text-xs text-slate-500 leading-relaxed">حجز ذكي فوري بالعامية المصرية والإنجليزية</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 mt-4 group-hover:translate-x-[-4px] transition-transform">
                ابدأ الحجز الآن <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Card 2: Live Queue */}
            <Link
              href="/queue"
              className="group p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-400 transition-all duration-300 hover:scale-[1.02] text-right relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 mb-1">الطابور المباشر</h3>
              <p className="text-xs text-slate-500 leading-relaxed">تتبع دورك والوقت التقديري برقم هاتفك</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 mt-4 group-hover:translate-x-[-4px] transition-transform">
                متابعة الطابور <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Card 3: Doctor AI Co-Pilot */}
            <Link
              href="/doctor"
              className="group p-6 rounded-3xl bg-white border border-teal-200 shadow-md shadow-teal-600/5 hover:shadow-2xl hover:border-teal-500 transition-all duration-300 hover:scale-[1.02] text-right relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-all shadow-md shadow-teal-600/20">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="font-extrabold text-lg text-slate-900">مساعد الطبيب</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-black">
                  Phase 2
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">تسجيل صوتي، تقرير SOAP، فحص الأشعة VLM</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 mt-4 group-hover:translate-x-[-4px] transition-transform">
                دخول الطبيب <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Card 4: Reception Dashboard */}
            <Link
              href="/clinic"
              className="group p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-emerald-400 transition-all duration-300 hover:scale-[1.02] text-right relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 mb-1">لوحة الريسبشن</h3>
              <p className="text-xs text-slate-500 leading-relaxed">إدارة وصول المرضى وبدء وإنهاء الكشوفات</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mt-4 group-hover:translate-x-[-4px] transition-transform">
                لوحة التحكم <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </motion.div>

          {/* System Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 border-t border-slate-200">
            <div className="flex items-center gap-3.5 text-right p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">سرعة استجابة فائقة</h4>
                <p className="text-xs text-slate-500">استعلامات Redis بأقل من 200ms</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 text-right p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">أمان دوائي مشدد</h4>
                <p className="text-xs text-slate-500">فحص فوري لتداخلات الأدوية الخطيرة</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 text-right p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">استدلال سريري متقدم</h4>
                <p className="text-xs text-slate-500">GPT-4o Multimodal + Whisper</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <p>عيادتي (3eyadaty) — المنصة الذكية لإدارة العيادات الطبية © 2026</p>
      </footer>
    </div>
  );
}
