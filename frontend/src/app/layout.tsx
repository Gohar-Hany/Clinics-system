import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "عيادتي — احجز موعدك وتابع دورك",
    template: "%s — عيادتي",
  },
  description: "احجز موعدك في ثواني مع المساعد الذكي، وتابع دورك في العيادة لحظة بلحظة.",
};

export const viewport: Viewport = {
  themeColor: "#162937",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
