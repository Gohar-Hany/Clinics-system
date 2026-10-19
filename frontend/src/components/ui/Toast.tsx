"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Toast = { id: number; tone: "success" | "error"; message: string };

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-[var(--shadow-pop)]"
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-400" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
            )}
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="إغلاق" className="text-white/60 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
