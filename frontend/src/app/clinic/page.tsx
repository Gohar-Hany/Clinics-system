"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Patient {
  id: string;
  name: string;
  phone: string;
  queue_number: number;
  appointment_time: string;
  status: "scheduled" | "checked_in" | "in_progress" | "completed" | "no_show";
  started_at?: string;
  duration?: number;
}

const MOCK_PATIENTS: Patient[] = [
  { id: "1", name: "أحمد محمد حسن", phone: "01012345678", queue_number: 1, appointment_time: "09:00", status: "completed", duration: 18 },
  { id: "2", name: "سارة أحمد عبدالله", phone: "01098765432", queue_number: 2, appointment_time: "09:30", status: "completed", duration: 22 },
  { id: "3", name: "محمد علي إبراهيم", phone: "01122334455", queue_number: 3, appointment_time: "10:00", status: "in_progress", started_at: "10:05" },
  { id: "4", name: "فاطمة حسن محمود", phone: "01234567890", queue_number: 4, appointment_time: "10:30", status: "checked_in" },
  { id: "5", name: "يوسف إبراهيم أحمد", phone: "01555666777", queue_number: 5, appointment_time: "11:00", status: "checked_in" },
  { id: "6", name: "نورا خالد محمد", phone: "01666777888", queue_number: 6, appointment_time: "11:30", status: "scheduled" },
  { id: "7", name: "عمر حسين سعيد", phone: "01777888999", queue_number: 7, appointment_time: "12:00", status: "scheduled" },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "محجوز", color: "text-slate-400", bg: "bg-slate-700/50" },
  checked_in: { label: "وصل ✅", color: "text-brand-400", bg: "bg-brand-500/10" },
  in_progress: { label: "جوا الكشف 🔵", color: "text-success-400", bg: "bg-success-500/10" },
  completed: { label: "خلص", color: "text-slate-500", bg: "bg-slate-800/30" },
  no_show: { label: "لم يحضر", color: "text-error-400", bg: "bg-error-500/10" },
};

export default function ClinicDashboard() {
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const currentServing = patients.find((p) => p.status === "in_progress");
  const waitingCount = patients.filter((p) => p.status === "checked_in").length;
  const completedCount = patients.filter((p) => p.status === "completed").length;

  const handleAction = (patientId: string, action: string) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          switch (action) {
            case "check_in":
              return { ...p, status: "checked_in" as const };
            case "start":
              return { ...p, status: "in_progress" as const, started_at: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) };
            case "complete":
              return { ...p, status: "completed" as const, duration: 20 };
            case "no_show":
              return { ...p, status: "no_show" as const };
            default:
              return p;
          }
        }
        return p;
      })
    );
  };

  return (
    <div className="min-h-screen bg-gradient-animate flex flex-col">
      {/* Header */}
      <header className="glass border-b border-slate-800/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-brand-500 flex items-center justify-center text-xl shrink-0">
          🏥
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-lg text-white">لوحة تحكم العيادة</h1>
          <p className="text-xs text-slate-400">ريسبشن — إدارة الطابور</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="px-3 py-2 glass-light rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← الرئيسية
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "جوا الكشف",
              value: currentServing?.queue_number ?? "—",
              sub: currentServing?.name ?? "لا يوجد",
              icon: "🔵",
              glow: "glow-brand",
            },
            {
              label: "في الانتظار",
              value: waitingCount,
              sub: "مريض وصلوا",
              icon: "⏳",
              glow: "",
            },
            {
              label: "خلصوا",
              value: completedCount,
              sub: `من ${patients.length} إجمالي`,
              icon: "✅",
              glow: "",
            },
            {
              label: "متوسط الكشف",
              value: "20د",
              sub: "آخر 20 مريض",
              icon: "⏱️",
              glow: "",
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 * i }}
              className={`glass rounded-2xl p-5 ${stat.glow}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">{stat.label}</span>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Patients Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/50">
            <h2 className="font-semibold text-white">مواعيد اليوم</h2>
          </div>
          <div className="divide-y divide-slate-800/30">
            <AnimatePresence>
              {patients.map((patient, i) => {
                const config = statusConfig[patient.status];
                const isActive = patient.status === "in_progress";

                return (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.03 * i }}
                    className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                      isActive ? "bg-success-500/5" : "hover:bg-slate-800/30"
                    }`}
                  >
                    {/* Queue Number */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                        isActive
                          ? "bg-success-500/20 text-success-400"
                          : patient.status === "completed"
                          ? "bg-slate-800/50 text-slate-600"
                          : "bg-brand-500/10 text-brand-400"
                      }`}
                    >
                      {patient.queue_number}
                    </div>

                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${patient.status === "completed" ? "text-slate-500" : "text-white"}`}>
                        {patient.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {patient.phone} • الموعد: {patient.appointment_time}
                        {patient.duration ? ` • المدة: ${patient.duration}د` : ""}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${config.color} ${config.bg}`}
                    >
                      {isActive && (
                        <span className="inline-block w-2 h-2 rounded-full bg-success-400 pulse-dot ml-1.5" />
                      )}
                      {config.label}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      {patient.status === "scheduled" && (
                        <button
                          onClick={() => handleAction(patient.id, "check_in")}
                          className="px-3 py-1.5 bg-brand-600/80 hover:bg-brand-600 rounded-lg text-xs font-medium transition-colors"
                        >
                          تسجيل وصول
                        </button>
                      )}
                      {patient.status === "checked_in" && (
                        <button
                          onClick={() => handleAction(patient.id, "start")}
                          className="px-3 py-1.5 bg-success-500/80 hover:bg-success-500 rounded-lg text-xs font-medium transition-colors"
                        >
                          ابدأ الكشف
                        </button>
                      )}
                      {patient.status === "in_progress" && (
                        <button
                          onClick={() => handleAction(patient.id, "complete")}
                          className="px-3 py-1.5 bg-accent-600/80 hover:bg-accent-600 rounded-lg text-xs font-medium transition-colors"
                        >
                          خلّص الكشف
                        </button>
                      )}
                      {(patient.status === "scheduled" || patient.status === "checked_in") && (
                        <button
                          onClick={() => handleAction(patient.id, "no_show")}
                          className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-400 transition-colors"
                        >
                          لم يحضر
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
