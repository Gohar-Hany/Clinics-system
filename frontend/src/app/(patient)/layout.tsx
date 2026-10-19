import { PatientHeader } from "@/components/PatientHeader";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PatientHeader />
      {children}
    </div>
  );
}
