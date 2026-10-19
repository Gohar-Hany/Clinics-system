"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, CalendarCheck2, CalendarX2, ClipboardCheck, RotateCcw, Ticket } from "lucide-react";
import { clinicApi, type BookingProposal, type BookingSummary, type ChatResponse } from "@/services/api";
import { Markdown } from "@/components/chat/Markdown";
import { BrandMark } from "@/components/Brand";
import { useClinicInfo } from "@/lib/hooks";
import { normalizeDigits } from "@/lib/format";
import { cx } from "@/components/ui";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: ChatResponse["data"];
  failed?: boolean;
}

const STORAGE_KEY = "clinic-chat-v2";

const SUGGESTIONS = [
  "عايز أحجز بكره",
  "إيه أقرب ميعاد فاضي؟",
  "عايز أعرف دوري",
  "عايز أغير ميعادي",
];

function loadSaved(): { threadId: string | null; phone: string | null; messages: Message[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const info = useClinicInfo();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore the conversation so a refresh doesn't lose the booking context
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setMessages(saved.messages);
      setThreadId(saved.threadId);
      setPhone(saved.phone);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ threadId, phone, messages: messages.slice(-60) }));
    } catch {}
  }, [messages, threadId, phone, restored]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const send = async (text: string) => {
    const content = normalizeDigits(text).trim();
    if (!content || sending) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);
    setInput("");
    setSending(true);

    try {
      const res = await clinicApi.sendMessage({ message: content, threadId, patientPhone: phone });
      setThreadId(res.thread_id);
      if (res.data?.patient_phone) setPhone(res.data.patient_phone);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: res.response, data: res.data, failed: res.intent === "error" },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: e instanceof Error ? e.message : "حصلت مشكلة في الاتصال. جرّب تاني.",
          failed: true,
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    setMessages([]);
    setThreadId(null);
    setPhone(null);
    setInput("");
    inputRef.current?.focus();
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const empty = messages.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
      {/* Conversation */}
      <div className="flex-1 py-6">
        {empty ? (
          <div className="animate-rise flex flex-col items-center pt-6 text-center sm:pt-14">
            <span className="mb-4">
              <BrandMark size="lg" />
            </span>
            <h1 className="text-2xl font-bold">أهلاً بحضرتك 👋</h1>
            <p className="mt-2 max-w-md text-ink-2">
              أنا مساعد الحجز في {info?.clinic_name ?? "العيادة"}. قولي اليوم اللي يناسبك وأنا أشوفلك المواعيد الفاضية وأحجزلك.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink ring-1 ring-line-strong transition hover:bg-brand-50 hover:ring-brand-500"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-ink-3 hover:bg-slate-100 hover:text-ink">
                <RotateCcw className="size-3.5" />
                محادثة جديدة
              </button>
            </div>

            {messages.map((m) => (
              <div key={m.id} className={cx("animate-rise flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[88%] space-y-2 sm:max-w-[80%]")}>
                  <div
                    className={cx(
                      "rounded-2xl px-4 py-3 text-[15px]",
                      m.role === "user"
                        ? "rounded-tl-md bg-navy-900 text-white"
                        : m.failed
                          ? "rounded-tr-md bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                          : "rounded-tr-md bg-surface text-ink ring-1 ring-line"
                    )}
                  >
                    {m.role === "assistant" ? <Markdown text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                  </div>

                  {m.data?.booking && <BookingCard booking={m.data.booking} />}
                  {m.data?.cancelled && (
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-ink-2 ring-1 ring-line">
                      <CalendarX2 className="size-4 text-rose-500" />
                      تم إلغاء الحجز والميعاد بقى متاح لغيرك.
                    </div>
                  )}

                  {m.id === lastAssistantId && !sending && m.data?.slots && m.data.slots.options.length > 0 && !m.data.proposal && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold text-ink-3">
                        كل المواعيد الفاضية {m.data.slots.day_label} ({m.data.slots.options.length}) — اختار واحد
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.data.slots.options.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => send(`عايز الساعة ${slot.label} يوم ${m.data!.slots!.day_label}`)}
                            className="rounded-lg bg-surface px-3 py-1.5 text-sm font-bold text-brand-800 ring-1 ring-brand-300 transition hover:bg-brand-400 hover:text-navy-900 hover:ring-brand-400"
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {m.data?.proposal && (
                    <ProposalCard
                      proposal={m.data.proposal}
                      active={m.id === lastAssistantId && !sending}
                      onConfirm={() => send("أيوه، أكد الحجز")}
                      onChange={() => send("لا، عايز أغيّر الميعاد")}
                    />
                  )}

                  {m.id === lastAssistantId && !sending && !m.data?.booking && !m.data?.proposal && quickReplies(m.content) && (
                    <div className="flex flex-wrap gap-2">
                      {quickReplies(m.content)!.map((reply, i) => (
                        <button
                          key={reply}
                          onClick={() => send(reply)}
                          className={cx(
                            "rounded-xl px-4 py-2 text-sm font-bold transition",
                            i === 0
                              ? "bg-brand-400 text-navy-900 hover:bg-brand-300"
                              : "bg-surface text-ink ring-1 ring-line-strong hover:bg-slate-50"
                          )}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-tr-md bg-surface px-4 py-3.5 ring-1 ring-line" aria-label="المساعد بيكتب">
                  <span className="typing-dot size-1.5 rounded-full bg-ink-3" />
                  <span className="typing-dot size-1.5 rounded-full bg-ink-3" />
                  <span className="typing-dot size-1.5 rounded-full bg-ink-3" />
                </div>
              </div>
            )}
            <div ref={endRef} className="h-2 scroll-mb-36" />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 bg-gradient-to-t from-canvas via-canvas to-canvas/0 pt-2 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-2xl bg-surface p-2 shadow-sm ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-brand-600"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="اكتب رسالتك…"
            aria-label="اكتب رسالتك"
            className="max-h-36 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="إرسال"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            <ArrowUp className="size-5" />
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-ink-3">
          للحالات الطارئة اتصل بالإسعاف على <strong className="text-ink-2">123</strong>
        </p>
      </div>
    </main>
  );
}

/**
 * One-tap answers for the cancel question only. Booking confirmation buttons come
 * from the backend's validated proposal (see ProposalCard), never from wording.
 */
function quickReplies(text: string): string[] | null {
  const ask = text.trim();
  if (/متأكد.*(تلغي|إلغاء)|تحب.*تلغي|sure.*cancel/i.test(ask)) return ["أيوه، ألغي الحجز", "لا، سيبه زي ما هو"];
  return null;
}

function ProposalCard({
  proposal: p,
  active,
  onConfirm,
  onChange,
}: {
  proposal: BookingProposal;
  active: boolean;
  onConfirm: () => void;
  onChange: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex items-center gap-2 bg-accent-50 px-4 py-2.5 text-sm font-bold text-accent-900">
        <ClipboardCheck className="size-4" />
        راجع بيانات الحجز
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
        <dt className="text-ink-3">الاسم</dt>
        <dd className="font-bold">{p.patient_name}</dd>
        <dt className="text-ink-3">الموبايل</dt>
        <dd className="font-bold" dir="ltr">{p.patient_phone}</dd>
        <dt className="text-ink-3">اليوم</dt>
        <dd className="font-bold">{p.day_label}</dd>
        <dt className="text-ink-3">الساعة</dt>
        <dd className="font-bold">{p.time_label} · دور #{p.queue_number}</dd>
      </dl>
      {active ? (
        <div className="flex gap-2 border-t border-line p-3">
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-brand-400 py-2.5 text-sm font-bold text-navy-900 hover:bg-brand-300">
            أكد الحجز
          </button>
          <button onClick={onChange} className="rounded-xl px-4 py-2.5 text-sm font-bold text-ink ring-1 ring-line-strong hover:bg-slate-50">
            عايز أغيّر
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BookingCard({ booking }: { booking: BookingSummary }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex items-center gap-2 bg-navy-900 px-4 py-2.5 text-sm font-bold text-white">
        <CalendarCheck2 className="size-4 text-brand-400" />
        {booking.rescheduled ? "تم تعديل الحجز" : "تم تأكيد الحجز"}
      </div>
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="text-center">
          <p className="text-xs text-ink-3">رقم الدور</p>
          <p className="text-4xl font-black text-ink tabular-nums">#{booking.queue_number}</p>
        </div>
        <div className="h-12 w-px bg-line" />
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-3">اليوم</dt>
          <dd className="font-medium">{booking.day_label}</dd>
          <dt className="text-ink-3">الساعة</dt>
          <dd className="font-medium">{booking.time_label}</dd>
          <dt className="text-ink-3">كود الحجز</dt>
          <dd className="font-medium" dir="ltr">{booking.reference_code}</dd>
        </dl>
      </div>
      <Link
        href={`/queue?q=${encodeURIComponent(booking.reference_code)}`}
        className="flex items-center justify-center gap-2 bg-brand-400 py-3 text-sm font-bold text-navy-900 hover:bg-brand-300"
      >
        <Ticket className="size-4" />
        تابع دورك يوم الكشف
      </Link>
    </div>
  );
}
