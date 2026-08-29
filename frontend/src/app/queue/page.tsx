"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { clinicApi, QueuePositionResponse, QueueStateResponse } from "@/services/api";
import { Search, Users, Clock, Activity, Ticket, Phone, RefreshCw, CheckCircle2, UserCheck, AlertCircle, ArrowLeft } from "lucide-react";

export default function LiveQueuePage() {
  const [identifier, setIdentifier] = useState("01284709314");
  const [patientPosition, setPatientPosition] = useState<QueuePositionResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Clinic Full State
  const [queueState, setQueueState] = useState<QueueStateResponse | null>(null);

  const fetchQueueState = async () => {
    try {
      const data = await clinicApi.getQueueState();
      setQueueState(data);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchQueueState();
    const interval = setInterval(fetchQueueState, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchPosition = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) return;

    setIsSearching(true);
    try {
      const pos = await clinicApi.getQueuePosition(identifier.trim());
      setPatientPosition(pos);
    } catch (err: any) {
      alert("لم يتم العثور على حجز نشط لهذا الرقم أو الكود.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Universal Search Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md max-w-2xl mx-auto text-center">
          <span className="px-3.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold inline-block mb-3">
            البحث الشامل في الطابور (Universal Queue Tracker)
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
            تابع دورك في الكشف والوقت المتبقي لحظياً
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6">
            ابحث بـ <strong>رقم هاتفك</strong>، أو <strong>كود الحجز (REF-XXXX)</strong> لمعرفة دورك دون حفظ أكواد معقدة.
          </p>

          <form onSubmit={handleSearchPosition} className="flex gap-2.5">
            <div className="relative flex-1">
              <Phone className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="أدخل رقم الموبايل (مثال: 01284709314) أو كود الحجز..."
                className="w-full rounded-2xl bg-slate-50 border border-slate-300 pr-11 pl-4 py-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-7 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/25 transition-all flex items-center gap-2 shrink-0"
            >
              {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              استعلام
            </button>
          </form>
        </div>

        {/* Patient Ticket Result */}
        {patientPosition && patientPosition.status !== "not_found" && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-teal-500 shadow-xl max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <span className="text-xs text-slate-400 font-medium">تاريخ الحجز المقرر</span>
                <p className="font-extrabold text-slate-900 text-base">{patientPosition.scheduled_date || "اليوم"}</p>
              </div>
              <span className="px-3.5 py-1.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-extrabold">
                {patientPosition.reference_code || "REF-ACTIVE"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-center mb-6">
              <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-100">
                <p className="text-xs text-teal-700 font-semibold mb-1">رقم دورك</p>
                <p className="text-3xl font-black text-teal-700">#{patientPosition.queue_number}</p>
              </div>
              <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-100">
                <p className="text-xs text-sky-700 font-semibold mb-1">الكشف الحالي</p>
                <p className="text-3xl font-black text-sky-700">#{patientPosition.current_serving || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-100">
                <p className="text-xs text-amber-700 font-semibold mb-1">مرضى قبلك</p>
                <p className="text-3xl font-black text-amber-600">{patientPosition.patients_ahead}</p>
              </div>
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100">
                <p className="text-xs text-indigo-700 font-semibold mb-1">الوقت المتوقع</p>
                <p className="text-2xl font-black text-indigo-700">~{patientPosition.estimated_wait_minutes}د</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs sm:text-sm text-slate-700">
              {patientPosition.patients_ahead === 0 ? (
                <span className="text-emerald-700 font-extrabold flex items-center justify-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" /> دورك القادم مباشرة! يرجى التوجه لغرفة الكشف.
                </span>
              ) : (
                <span>
                  الوقت التقديري لدخولك الكشف: <strong className="text-teal-700 text-sm">{patientPosition.estimated_turn_time || "قريباً"}</strong>
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Global Clinic Queue Status Roster */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                شاشة الطابور المباشرة للعيادة (Live Clinic Display)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">تحديث متزامن مع قاعدة بيانات Redis السحابية</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200">
                إجمالي الطابور: <strong className="text-slate-900">{queueState?.total ?? 0}</strong>
              </span>
              <button
                onClick={fetchQueueState}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                title="تحديث"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Serving Banner */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-teal-600 to-sky-600 text-white text-center mb-6 shadow-md shadow-teal-600/15">
            <p className="text-xs text-teal-100 font-semibold mb-1 uppercase tracking-wider">جاري الكشف عليه الآن داخل غرفة الطبيب</p>
            <div className="text-6xl font-black">
              {queueState?.current_serving ? `#${queueState.current_serving}` : "في انتظار بدء الكشوفات"}
            </div>
          </div>

          {/* Entries list */}
          {queueState?.entries && queueState.entries.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
              {queueState.entries.map((entry) => {
                const isServing = entry.queue_number === queueState.current_serving;
                return (
                  <div
                    key={entry.appointment_id}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      isServing
                        ? "bg-teal-50 border-teal-500 text-teal-900 shadow-md shadow-teal-500/10"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className="text-xs text-slate-400 block mb-1">تذكرة</span>
                    <p className="text-3xl font-black text-slate-900">#{entry.queue_number}</p>
                    <span
                      className={`text-[11px] font-bold block mt-2 px-2 py-0.5 rounded-full ${
                        isServing ? "bg-teal-200/60 text-teal-800" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isServing ? "🔵 جوا الكشف" : "⏳ في الانتظار"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">لا توجد حالات في الطابور حالياً.</p>
          )}
        </div>
      </main>
    </div>
  );
}
