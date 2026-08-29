"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { clinicApi, QueuePositionResponse, QueueStateResponse } from "@/services/api";
import { Search, Users, Clock, Activity, Ticket, Phone, RefreshCw, CheckCircle2, UserCheck, AlertCircle } from "lucide-react";

export default function LiveQueuePage() {
  const [identifier, setIdentifier] = useState("01284709314");
  const [searchDate, setSearchDate] = useState("");
  const [patientPosition, setPatientPosition] = useState<QueuePositionResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Clinic Full State
  const [queueState, setQueueState] = useState<QueueStateResponse | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // Poll clinic queue state on mount and every 10 seconds
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Universal Search Box */}
        <div className="glass rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl max-w-2xl mx-auto text-center glow-brand">
          <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-bold inline-block mb-3">
            البحث الشامل في الطابور (Universal Queue Tracker)
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
            تابع دورك في الكشف والوقت المتبقي لحظياً
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-6">
            ابحث بـ <strong>رقم هاتفك</strong>، أو <strong>كود الحجز (REF-XXXX)</strong>، أو كود الموعد مباشرة.
          </p>

          <form onSubmit={handleSearchPosition} className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="أدخل رقم الموبايل (مثال: 01284709314) أو كود الحجز..."
                className="w-full rounded-2xl bg-slate-900 border border-slate-800 pr-10 pl-4 py-3.5 text-xs sm:text-sm text-white focus:outline-none focus:border-brand-500 shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 shrink-0"
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
            className="glass rounded-3xl p-6 sm:p-8 border border-brand-500/40 shadow-2xl max-w-2xl mx-auto glow-brand"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <span className="text-xs text-slate-400">تاريخ الحجز</span>
                <p className="font-bold text-white text-sm">{patientPosition.scheduled_date || "اليوم"}</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold">
                {patientPosition.reference_code || "REF-ACTIVE"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-6">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400 mb-1">رقم دورك</p>
                <p className="text-3xl font-black text-brand-400">#{patientPosition.queue_number}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400 mb-1">الكشف الحالي</p>
                <p className="text-3xl font-black text-cyan-400">#{patientPosition.current_serving || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400 mb-1">مرضى قبلك</p>
                <p className="text-3xl font-black text-warning-400">{patientPosition.patients_ahead}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400 mb-1">الوقت المتوقع</p>
                <p className="text-2xl font-black text-accent-400">~{patientPosition.estimated_wait_minutes}د</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center text-xs text-slate-300">
              {patientPosition.patients_ahead === 0 ? (
                <span className="text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> دورك القادم مباشرة! يرجى التوجه لغرفة الكشف.
                </span>
              ) : (
                <span>
                  الوقت التقديري لدخولك الكشف: <strong>{patientPosition.estimated_turn_time || "قريباً"}</strong>
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Global Clinic Queue Status Roster */}
        <div className="glass rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-400" />
                حالة الطابور العام بالعيادة الآن (Live Redis SSOT)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">يتم التحديث تلقائياً في الوقت الفعلي</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                إجمالي الطابور: <strong>{queueState?.total ?? 0}</strong>
              </span>
              <button
                onClick={fetchQueueState}
                className="p-2 rounded-xl glass-light border border-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Serving Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-brand-900/40 via-slate-900 to-accent-900/30 border border-brand-500/20 text-center mb-6">
            <p className="text-xs text-slate-400 mb-1">جاري الكشف عليه الآن داخل العيادة</p>
            <div className="text-5xl font-black text-gradient">
              {queueState?.current_serving ? `#${queueState.current_serving}` : "في انتظار بدء الكشوفات"}
            </div>
          </div>

          {/* Entries list */}
          {queueState?.entries && queueState.entries.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {queueState.entries.map((entry) => {
                const isServing = entry.queue_number === queueState.current_serving;
                return (
                  <div
                    key={entry.appointment_id}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      isServing
                        ? "bg-brand-500/20 border-brand-500 glow-brand text-white"
                        : "bg-slate-900/60 border-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="text-xs text-slate-400 block mb-1">تذكرة</span>
                    <p className="text-2xl font-black">#{entry.queue_number}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      {isServing ? "🔵 جوا الكشف" : "⏳ في الانتظار"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">لا توجد حالات في الطابور حالياً.</p>
          )}
        </div>
      </main>
    </div>
  );
}
