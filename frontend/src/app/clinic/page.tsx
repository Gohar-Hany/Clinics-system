"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { clinicApi, QueueStateResponse } from "@/services/api";
import {
  LayoutDashboard,
  UserCheck,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Users,
  Activity,
  Calendar,
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  phone: string;
  queue_number: number;
  appointment_time: string;
  status: "scheduled" | "checked_in" | "in_progress" | "completed" | "no_show";
  duration?: number;
}

const INITIAL_PATIENTS: Patient[] = [
  { id: "1418cb92", name: "أحمد محمد حسن", phone: "01284709314", queue_number: 1, appointment_time: "09:30", status: "in_progress" },
  { id: "fcc22546", name: "سارة أحمد عبدالله", phone: "01098765432", queue_number: 2, appointment_time: "10:00", status: "checked_in" },
  { id: "0d0fd8e8", name: "محمد علي إبراهيم", phone: "01122334455", queue_number: 3, appointment_time: "10:30", status: "checked_in" },
  { id: "685c6f41", name: "فاطمة حسن محمود", phone: "01234567890", queue_number: 4, appointment_time: "11:00", status: "scheduled" },
  { id: "f1357499", name: "يوسف إبراهيم أحمد", phone: "01555666777", queue_number: 5, appointment_time: "11:30", status: "scheduled" },
  { id: "c32e9e05", name: "نورا خالد محمد", phone: "01666777888", queue_number: 6, appointment_time: "12:00", status: "scheduled" },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "محجوز", color: "text-slate-600", bg: "bg-slate-100 border border-slate-200" },
  checked_in: { label: "وصل العيادة ✅", color: "text-teal-800", bg: "bg-teal-50 border border-teal-200" },
  in_progress: { label: "جوا الكشف 🔵", color: "text-sky-800", bg: "bg-sky-50 border border-sky-200" },
  completed: { label: "انتهى الكشف", color: "text-emerald-800", bg: "bg-emerald-50 border border-emerald-200" },
  no_show: { label: "لم يحضر", color: "text-rose-800", bg: "bg-rose-50 border border-rose-200" },
};

export default function ClinicDashboard() {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [queueState, setQueueState] = useState<QueueStateResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchLiveState = async () => {
    try {
      const state = await clinicApi.getQueueState();
      setQueueState(state);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchLiveState();
    const interval = setInterval(fetchLiveState, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (patientId: string, action: string, queueNum: number) => {
    setActionLoading(patientId);
    try {
      if (action === "check_in") {
        await clinicApi.checkIn(patientId);
      } else if (action === "start") {
        await clinicApi.startConsultation(patientId, queueNum);
      } else if (action === "complete") {
        await clinicApi.completeConsultation(patientId, 20);
      }

      setPatients((prev) =>
        prev.map((p) => {
          if (p.id === patientId) {
            switch (action) {
              case "check_in":
                return { ...p, status: "checked_in" as const };
              case "start":
                return { ...p, status: "in_progress" as const };
              case "complete":
                return { ...p, status: "completed" as const };
              case "no_show":
                return { ...p, status: "no_show" as const };
              default:
                return p;
            }
          }
          return p;
        })
      );
      await fetchLiveState();
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const currentServing = patients.find((p) => p.status === "in_progress");
  const waitingCount = patients.filter((p) => p.status === "checked_in").length;
  const completedCount = patients.filter((p) => p.status === "completed").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Title & Live Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">لوحة تحكم الريسبشن وإدارة الطابور</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              متابعة وصول المرضى، بدء الكشوفات، وتحديث شاشات الانتظار لحظياً في السحابة.
            </p>
          </div>
          <button
            onClick={fetchLiveState}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-2 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث البيانات
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-5 border-2 border-teal-500 shadow-md">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">جوا الكشف الآن</span>
            <p className="text-4xl font-black text-teal-700">
              {currentServing ? `#${currentServing.queue_number}` : "—"}
            </p>
            <span className="text-xs text-slate-800 font-bold truncate block mt-1.5">
              {currentServing?.name || "لا يوجد كشف جاري"}
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">في غرفة الانتظار</span>
            <p className="text-4xl font-black text-sky-700">{waitingCount}</p>
            <span className="text-xs text-slate-500 font-medium block mt-1.5">مرضى جاهزون للدخول</span>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">تم الكشف عليهم</span>
            <p className="text-4xl font-black text-emerald-700">{completedCount}</p>
            <span className="text-xs text-slate-500 font-medium block mt-1.5">حالات مكتملة اليوم</span>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">متوسط مدة الكشف</span>
            <p className="text-4xl font-black text-indigo-700">
              {queueState?.avg_consultation_minutes || 20} <span className="text-xl">د</span>
            </p>
            <span className="text-xs text-slate-500 font-medium block mt-1.5">حساب ديناميكي متجدد</span>
          </div>
        </div>

        {/* Patients Queue Roster Table */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              كشف قائمة المرضى اليوم (Live Patient Roster)
            </h3>
            <span className="text-xs font-semibold text-slate-600 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200">
              إجمالي المسجلين: <strong className="text-slate-900">{patients.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-bold rounded-r-xl">الدور</th>
                  <th className="py-3 px-3 font-bold">اسم المريض</th>
                  <th className="py-3 px-3 font-bold">رقم الموبايل</th>
                  <th className="py-3 px-3 font-bold">الموعد</th>
                  <th className="py-3 px-3 font-bold">الحالة</th>
                  <th className="py-3 px-4 font-bold text-center rounded-l-xl">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => {
                  const status = statusConfig[p.status] || statusConfig.scheduled;
                  const isLoading = actionLoading === p.id;
                  return (
                    <tr key={p.id} className="text-slate-800 hover:bg-teal-50/20 transition-colors">
                      <td className="py-4 px-4">
                        <span className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-teal-800">
                          #{p.queue_number}
                        </span>
                      </td>
                      <td className="py-4 px-3 font-bold text-slate-900">{p.name}</td>
                      <td className="py-4 px-3 font-mono text-slate-500 text-xs">{p.phone}</td>
                      <td className="py-4 px-3 font-semibold text-slate-700">{p.appointment_time}</td>
                      <td className="py-4 px-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {p.status === "scheduled" && (
                            <button
                              onClick={() => handleAction(p.id, "check_in", p.queue_number)}
                              disabled={isLoading}
                              className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-800 text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              تسجيل وصول
                            </button>
                          )}

                          {p.status === "checked_in" && (
                            <button
                              onClick={() => handleAction(p.id, "start", p.queue_number)}
                              disabled={isLoading}
                              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-md shadow-teal-600/20"
                            >
                              <Play className="w-3.5 h-3.5" />
                              نداء للكشف
                            </button>
                          )}

                          {p.status === "in_progress" && (
                            <button
                              onClick={() => handleAction(p.id, "complete", p.queue_number)}
                              disabled={isLoading}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-md shadow-emerald-600/20"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              إنهاء الكشف
                            </button>
                          )}

                          {p.status !== "completed" && (
                            <button
                              onClick={() => handleAction(p.id, "no_show", p.queue_number)}
                              disabled={isLoading}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="لم يحضر"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
