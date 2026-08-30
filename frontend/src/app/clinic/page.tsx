"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { clinicApi, QueueStateResponse } from "@/services/api";
import {
  UserCheck,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Users,
  Activity,
  Calendar,
  Clock,
  User,
  Phone,
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  phone: string;
  queue_number: number;
  appointment_time: string;
  status: "scheduled" | "checked_in" | "in_progress" | "completed" | "no_show";
}

const INITIAL_PATIENTS: Patient[] = [
  { id: "1418cb92", name: "أحمد محمد حسن", phone: "01284709314", queue_number: 1, appointment_time: "09:30", status: "in_progress" },
  { id: "fcc22546", name: "سارة أحمد عبدالله", phone: "01098765432", queue_number: 2, appointment_time: "10:00", status: "checked_in" },
  { id: "0d0fd8e8", name: "محمد علي إبراهيم", phone: "01122334455", queue_number: 3, appointment_time: "10:30", status: "checked_in" },
  { id: "685c6f41", name: "فاطمة حسن محمود", phone: "01234567890", queue_number: 4, appointment_time: "11:00", status: "scheduled" },
  { id: "f1357499", name: "يوسف إبراهيم أحمد", phone: "01555666777", queue_number: 5, appointment_time: "11:30", status: "scheduled" },
  { id: "c32e9e05", name: "نورا خالد محمد", phone: "01666777888", queue_number: 6, appointment_time: "12:00", status: "scheduled" },
];

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  scheduled: { label: "محجوز مسبقاً", color: "text-slate-700", bg: "bg-slate-100 border-slate-200", dot: "bg-slate-400" },
  checked_in: { label: "حاضر في العيادة", color: "text-teal-900", bg: "bg-teal-50 border-teal-200", dot: "bg-teal-600" },
  in_progress: { label: "داخل الكشف الآن", color: "text-sky-900", bg: "bg-sky-50 border-sky-200", dot: "bg-sky-600 animate-pulse" },
  completed: { label: "انتهى الكشف", color: "text-emerald-900", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-600" },
  no_show: { label: "لم يحضر", color: "text-rose-900", bg: "bg-rose-50 border-rose-200", dot: "bg-rose-600" },
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row font-sans">
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 md:mr-72 flex flex-col min-h-screen">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
          {/* Header Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs">
            <div className="text-right">
              <span className="px-3.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-black inline-block mb-2">
                لوحة إدارة الاستقبال والطابور السريري
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                إدارة كشوفات العيادة وحضور المرضى
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                تسجيل وصول المرضى، بدء الكشف للطبيب، وتحديث شاشات الانتظار لحظياً في السحابة.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                onClick={fetchLiveState}
                className="px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 flex items-center gap-2 transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
                تحديث البيانات
              </button>
            </div>
          </div>

          {/* Stats Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Metric 1 */}
            <div className="bg-white rounded-3xl p-5 border-2 border-teal-500 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  الكشف الجاري الآن
                </span>
                <p className="text-4xl font-black text-teal-700">
                  {currentServing ? `#${currentServing.queue_number}` : "—"}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
                <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">{currentServing?.name || "لا يوجد كشف جاري"}</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  في غرفة الانتظار
                </span>
                <p className="text-4xl font-black text-sky-700">{waitingCount}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>جاهزون للدخول فوراً</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  الحالات المكتملة
                </span>
                <p className="text-4xl font-black text-emerald-700">{completedCount}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>تم إنهاء الكشف بنجاح</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  متوسط مدة الكشف
                </span>
                <p className="text-4xl font-black text-slate-800">
                  {queueState?.avg_consultation_minutes || 20} <span className="text-xl text-slate-500 font-bold">دقيقة</span>
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>حساب سريري متجدد</span>
              </div>
            </div>
          </div>

          {/* Patients Queue Roster Table */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
              <h2 className="font-black text-lg sm:text-xl text-slate-900 flex items-center gap-2.5">
                <Users className="w-5 h-5 text-teal-600" />
                كشف قائمة المرضى لليوم (Live Patient Roster)
              </h2>
              <span className="text-xs font-black text-slate-800 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-300">
                إجمالي المسجلين اليوم: <strong className="text-teal-700 text-sm">{patients.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/80">
                    <th className="py-3.5 px-4 font-black rounded-r-xl">الدور</th>
                    <th className="py-3.5 px-4 font-black">اسم المريض</th>
                    <th className="py-3.5 px-4 font-black">رقم الموبايل</th>
                    <th className="py-3.5 px-4 font-black">موعد الحجز</th>
                    <th className="py-3.5 px-4 font-black">حالة الحضور</th>
                    <th className="py-3.5 px-4 font-black text-center rounded-l-xl">الإجراء الإداري / الطبي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.map((p) => {
                    const status = statusConfig[p.status] || statusConfig.scheduled;
                    const isLoading = actionLoading === p.id;
                    return (
                      <tr key={p.id} className="text-slate-900 hover:bg-teal-50/30 transition-colors">
                        <td className="py-4 px-4">
                          <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-sm text-teal-800">
                            #{p.queue_number}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-black text-slate-900 text-sm">{p.name}</td>
                        <td className="py-4 px-4 font-mono text-slate-600 text-xs font-bold">{p.phone}</td>
                        <td className="py-4 px-4 font-black text-slate-700">{p.appointment_time}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${status.bg} ${status.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {p.status === "scheduled" && (
                              <button
                                onClick={() => handleAction(p.id, "check_in", p.queue_number)}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-900 text-xs font-black flex items-center gap-1.5 transition-colors shadow-2xs"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                تسجيل وصول
                              </button>
                            )}

                            {p.status === "checked_in" && (
                              <button
                                onClick={() => handleAction(p.id, "start", p.queue_number)}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1.5 transition-colors shadow-md shadow-teal-600/20"
                              >
                                <Play className="w-3.5 h-3.5" />
                                نداء للكشف
                              </button>
                            )}

                            {p.status === "in_progress" && (
                              <button
                                onClick={() => handleAction(p.id, "complete", p.queue_number)}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                إنهاء الكشف
                              </button>
                            )}

                            {p.status !== "completed" && (
                              <button
                                onClick={() => handleAction(p.id, "no_show", p.queue_number)}
                                disabled={isLoading}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="لم يحضر المريض"
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
    </div>
  );
}
