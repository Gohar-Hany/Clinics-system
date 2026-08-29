"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-animate flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* Animated Logo */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center glow-brand">
              <span className="text-5xl">🏥</span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl md:text-6xl font-bold mb-4"
          >
            <span className="text-gradient">عيادتي</span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-xl text-slate-400 mb-12 leading-relaxed"
          >
            نظام إدارة العيادات الذكي
            <br />
            احجز موعدك في ثواني وتابع دورك لحظياً
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/chat"
              className="group relative px-8 py-4 bg-gradient-to-r from-brand-600 to-brand-500 rounded-2xl font-semibold text-lg transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-3">
                💬 احجز موعدك
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </Link>

            <Link
              href="/queue"
              className="px-8 py-4 glass rounded-2xl font-semibold text-lg text-slate-300 transition-all duration-300 hover:bg-slate-800/80 hover:text-white hover:scale-[1.02] active:scale-[0.98]"
            >
              📊 تابع الطابور
            </Link>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {[
              { icon: "🤖", title: "حجز ذكي", desc: "كلم الـ AI واحجز في ثواني" },
              { icon: "⚡", title: "طابور لحظي", desc: "تابع دورك في الوقت الفعلي" },
              { icon: "🔒", title: "بدون تسجيل", desc: "ادخل وابدأ فوراً" },
            ].map((feature, i) => (
              <div
                key={i}
                className="glass-light rounded-2xl p-6 text-center transition-all duration-300 hover:bg-slate-800/60"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-slate-600">
        <p>عيادتي — نظام إدارة العيادات بالذكاء الاصطناعي © 2026</p>
      </footer>
    </div>
  );
}
