import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "احجز موعدك — عيادتي",
  description: "احجز موعدك مع الدكتور عبر المحادثة الذكية",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
