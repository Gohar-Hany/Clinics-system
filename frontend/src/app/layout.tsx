import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "عيادتي — نظام إدارة العيادات الذكي بالذكاء الاصطناعي",
  description: "نظام AI متكامل لحجز المواعيد، متابعة الطابور لحظياً، ومساعد الطبيب السريري",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-900 font-[family-name:var(--font-cairo)] selection:bg-teal-100 selection:text-teal-900">
        {children}
      </body>
    </html>
  );
}
