"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CLINIC_ID = "default-clinic";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "أهلاً بيك! 👋 أنا مساعدك الذكي لحجز المواعيد.\n\nإزاي أقدر أساعدك؟\n\n• احجزلي موعد 📅\n• عايز أعرف مكاني في الطابور 📊\n• عايز ألغي أو أغير موعدي ✏️",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Detect phone number in user message
    const phoneMatch = trimmed.match(/(01[0125]\d{8}|\+?201[0125]\d{8})/);
    const activePhone = phoneMatch ? phoneMatch[1] : patientPhone;
    if (phoneMatch && phoneMatch[1] !== patientPhone) {
      setPatientPhone(phoneMatch[1]);
    }

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          clinic_id: CLINIC_ID,
          thread_id: threadId,
          patient_phone: activePhone || undefined,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();

      setThreadId(data.thread_id);
      if (data.patient_phone && data.patient_phone !== patientPhone) {
        setPatientPhone(data.patient_phone);
      }

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
        content: "عفواً، حصلت مشكلة تقنية. حاول تاني بعد شوية. 🙏",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
          <h1 className="font-bold text-lg text-white">عيادتي</h1>
          <p className="text-xs text-slate-400">مساعد الحجز الذكي</p>
        </div>
        <Link
          href="/queue"
          className="px-4 py-2 glass-light rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          📊 الطابور
        </Link>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`mb-4 flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white rounded-br-md"
                    : "glass-light text-slate-200 rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {msg.content}
                </p>

                {/* Queue data display */}
                {msg.data?.queue_number != null && (
                  <div className="mt-3 p-3 rounded-xl bg-success-500/10 border border-success-500/20">
                    <p className="text-success-400 font-bold text-lg">
                      🎫 رقمك: {`${msg.data.queue_number}`}
                    </p>
                  </div>
                )}

                <p className="text-[10px] mt-1.5 opacity-40">
                  {msg.timestamp.toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end mb-4"
          >
            <div className="glass-light rounded-2xl rounded-bl-md px-5 py-4">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" />
                <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" />
                <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <div className="glass border-t border-slate-800/50 px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
            disabled={isLoading}
            className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            ارسل
          </button>
        </div>
      </div>
    </div>
  );
}
