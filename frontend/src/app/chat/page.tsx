"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { clinicApi } from "@/services/api";
import { Send, Bot, User, Phone, RefreshCw, ArrowRight, Users } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  data?: any;
}

const QUICK_ACTIONS = [
  "احجزلي موعد يوم 2026-09-15 الساعة 10:00 صباحاً",
  "عايز أعرف رقمي في الطابور",
  "مواعيد العمل في العيادة إيه؟",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "أهلاً بك في نظام عيادتي. أنا المساعد الذكي لحجز المواعيد والاستعلامات السريرية.\n\nكيف يمكنني خدمتك اليوم؟\n• حجز موعد جديد في العيادة\n• متابعة رقم دورك في الطابور والوقت المتبقي\n• الاستفسار عن تفاصيل الحجز أو مواعيد الأطباء",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || isLoading) return;

    // Detect phone number in user message
    const phoneMatch = textToSend.match(/(01[0125]\d{8}|\+?201[0125]\d{8})/);
    const activePhone = phoneMatch ? phoneMatch[1] : patientPhone;
    if (phoneMatch && phoneMatch[1] !== patientPhone) {
      setPatientPhone(phoneMatch[1]);
    }

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const data = await clinicApi.sendMessage({
        message: textToSend,
        threadId,
        patientPhone: activePhone || undefined,
      });

      if (data.thread_id) setThreadId(data.thread_id);
      if (data.data?.patient_phone) setPatientPhone(data.data.patient_phone);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        data: data.data,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "عفواً، حدثت مشكلة في الاتصال بالخدمة السحابية. يرجى المحاولة مرة أخرى.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row font-sans">
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 md:mr-72 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col h-full">
          {/* Chat Header Info */}
          <div className="flex items-center justify-between p-4 mb-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-600/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-slate-900">مساعد حجز المواعيد الآلي</h2>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  متصل بالسحابة (3eyadaty AI Agent)
                </p>
              </div>
            </div>
            <Link
              href="/queue"
              className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 transition-colors flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-teal-700" />
              <span>عرض الطابور المباشر</span>
            </Link>
          </div>

          {/* Chat Messages Container */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-teal-600/20">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                    <div
                      className={`rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-teal-600 text-white rounded-br-none shadow-md shadow-teal-600/20"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs"
                      }`}
                    >
                      <p className="whitespace-pre-line font-medium">{msg.content}</p>
                    </div>

                    {/* Smart Booking Card Badge */}
                    {msg.data?.queue_number && (
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-teal-50 rounded-2xl p-4 border border-teal-200 shadow-sm flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-base shadow-xs">
                            #{msg.data.queue_number}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">تأكيد تذكرة الحجز</p>
                            <p className="text-xs text-teal-800 font-semibold mt-0.5">
                              كود الحجز: <strong>REF-{msg.data.appointment_id?.slice(0, 4)?.toUpperCase() || "CONFIRMED"}</strong>
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/queue`}
                          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-600/20"
                        >
                          <span>متابعة دوري</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </motion.div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 border border-slate-300">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 rounded-xl bg-teal-600/40 text-white flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 flex items-center gap-2 text-xs text-slate-600 shadow-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  <span>الذكاء الاصطناعي يكتب الرد...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div className="flex items-center gap-2 overflow-x-auto py-2 mb-2 no-scrollbar">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => sendMessage(action)}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50 text-[11px] font-semibold whitespace-nowrap transition-all shadow-2xs"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="bg-white rounded-2xl p-2 border border-slate-300 shadow-sm flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder="اكتب رسالتك هنا (مثال: احجزلي موعد يوم الثلاثاء القادم الساعة 10:00 صباحاً)..."
              className="flex-1 bg-transparent px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md shadow-teal-600/20 shrink-0"
            >
              <Send className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
