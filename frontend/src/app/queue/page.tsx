"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface QueueEntry {
  appointment_id: string;
  queue_number: number;
  patient_name?: string;
  status?: string;
}

interface QueueState {
  entries: QueueEntry[];
  current_serving: number;
  total: number;
  avg_consultation_minutes: number;
}

export default function QueuePage() {
  const [queueState, setQueueState] = useState<QueueState>({
    entries: [
      { appointment_id: "1", queue_number: 1, patient_name: "أحمد محمد", status: "completed" },
      { appointment_id: "2", queue_number: 2, patient_name: "سارة أحمد", status: "completed" },
      { appointment_id: "3", queue_number: 3, patient_name: "محمد علي", status: "in_progress" },
      { appointment_id: "4", queue_number: 4, patient_name: "فاطمة حسن", status: "waiting" },
      { appointment_id: "5", queue_number: 5, patient_name: "يوسف إبراهيم", status: "waiting" },
      { appointment_id: "6", queue_number: 6, patient_name: "نورا خالد", status: "waiting" },
    ],
    current_serving: 3,
    total: 6,
    avg_consultation_minutes: 20,
  });

  const waitingCount = queueState.entries.filter(
    (e) => e.status === "waiting"
  ).length;

  return (
    <div className="min-h-screen bg-gradient-animate flex flex-col">
      {/* Header */}
      <header className="glass border-b border-slate-800/50 px-4 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href="/"
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-xl shrink-0"
        >
          🏥
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-white">الطابور المباشر</h1>
          <p className="text-xs text-slate-400">تحديث لحظي</p>
        </div>
        <Link
          href="/chat"
          className="px-4 py-2 bg-brand-600 rounded-xl text-sm font-medium text-white hover:bg-brand-500 transition-colors"
        >
          💬 احجز موعد
        </Link>
      </header>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Current Serving Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass rounded-3xl p-8 mb-8 text-center glow-brand"
        >
          <p className="text-sm text-slate-400 mb-2">دلوقتي جوا الكشف</p>
          <div className="text-7xl font-bold text-gradient mb-3">
            {queueState.current_serving}
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success-400 pulse-dot" />
            <span className="text-success-400 text-sm font-medium">
              الكشف جاري
            </span>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            {
              label: "في الانتظار",
              value: waitingCount,
              icon: "⏳",
              color: "text-warning-400",
            },
            {
              label: "إجمالي اليوم",
              value: queueState.total,
              icon: "📋",
              color: "text-brand-400",
            },
            {
              label: "متوسط الكشف",
              value: `${queueState.avg_consultation_minutes}د`,
              icon: "⏱️",
              color: "text-accent-400",
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 * i }}
              className="glass-light rounded-2xl p-4 text-center"
            >
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Queue List */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-400 mb-3 px-1">
            قائمة الانتظار
          </h2>
          {queueState.entries.map((entry, i) => {
            const isActive = entry.status === "in_progress";
            const isDone = entry.status === "completed";

            return (
              <motion.div
                key={entry.appointment_id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.05 * i }}
                className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all ${
                  isActive
                    ? "glass glow-success border-success-500/20"
                    : isDone
                    ? "bg-slate-800/30 opacity-50"
                    : "glass-light"
                }`}
              >
                {/* Queue Number */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                    isActive
                      ? "bg-success-500/20 text-success-400"
                      : isDone
                      ? "bg-slate-700/50 text-slate-500 line-through"
                      : "bg-brand-500/10 text-brand-400"
                  }`}
                >
                  {entry.queue_number}
                </div>

                {/* Patient Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      isDone ? "text-slate-500" : "text-white"
                    }`}
                  >
                    {entry.patient_name || "مريض"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isActive
                      ? "جوا الكشف الآن"
                      : isDone
                      ? "خلص ✅"
                      : `الانتظار المتوقع: ${
                          (entry.queue_number - queueState.current_serving) *
                          queueState.avg_consultation_minutes
                        } دقيقة`}
                  </p>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0">
                  {isActive && (
                    <span className="w-3 h-3 rounded-full bg-success-400 pulse-dot inline-block" />
                  )}
                  {isDone && (
                    <span className="text-slate-500">✅</span>
                  )}
                  {!isActive && !isDone && (
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">
                      ⏳ منتظر
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
