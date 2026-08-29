"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { clinicApi } from "@/services/api";
import { Send, Bot, User, Ticket, Calendar, Clock, Phone, Sparkles, RefreshCw, ArrowRight } from "lucide-react";

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
        "أهلاً بيك في عيادتي! 👋 أنا المساعد الذكي للحجز والاستعلام.\n\nتقدر تطلب مني:\n• حجز موعد جديد في أي وقت 📅\n• معرفة رقمك في الطابور والوقت المتبقي 📊\n• تعديل أو الاستفسار عن حجزك ✏️",
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
        content: "عفواً، حصلت مشكلة في الاتصال بالخدمة السحابية. يرجى المحاولة مرة أخرى. 🙏",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col">
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
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-brand-500/20">
                    <Bot className="w-5 h-5" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                  <div
                    className={`rounded-3xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-brand-500 text-white rounded-br-none shadow-lg shadow-brand-500/25"
                        : "glass border border-slate-800 text-slate-200 rounded-bl-none shadow-md"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.content}</p>
                  </div>

                  {/* Smart Booking Card Badge */}
                  {msg.data?.queue_number && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="glass rounded-2xl p-3.5 border border-brand-500/30 glow-brand flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-sm">
                          #{msg.data.queue_number}
                        </div>
                        <div>
                          <p className="font-bold text-white">تذكرة الحجز في الطابور</p>
                          <p className="text-[11px] text-slate-400">
                            كود الحجز: <strong>REF-{msg.data.appointment_id?.slice(0, 4)?.toUpperCase() || "CONFIRMED"}</strong>
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/queue`}
                        className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-xs flex items-center gap-1 transition-colors"
                      >
                        <span>متابعة دوري</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </motion.div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-9 h-9 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 border border-slate-700">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <div className="flex gap-3 items-center">
              <div className="w-9 h-9 rounded-2xl bg-brand-600/50 flex items-center justify-center text-white shrink-0 animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="glass rounded-2xl px-4 py-3 border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />
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
              className="px-3.5 py-1.5 rounded-xl glass-light border border-slate-800 text-[11px] text-slate-300 hover:text-white hover:border-brand-500/50 whitespace-nowrap transition-all"
            >
              {action}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="glass rounded-3xl p-2 sm:p-2.5 border border-slate-800/80 shadow-2xl flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="اكتب رسالتك هنا (مثال: احجزلي يوم الثلاثاء الجاي الساعة 11 صباحاً)..."
            className="flex-1 bg-transparent px-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-2xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md shadow-brand-500/25 shrink-0"
          >
            <Send className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </main>
    </div>
  );
}
