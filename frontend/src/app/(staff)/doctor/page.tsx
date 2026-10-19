"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  FlaskConical,
  ImageUp,
  Mic,
  Pill,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  Trash2,
} from "lucide-react";
import {
  clinicApi,
  type ConsultationResponse,
  type GuidelineResult,
  type ImagingAnalysisResponse,
} from "@/services/api";
import { PageHeader } from "@/components/StaffShell";
import { Button, Card, CardHeader, EmptyState, ErrorBanner, Field, cx, inputClass } from "@/components/ui";

type Tab = "consultation" | "imaging" | "guidelines";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "consultation", label: "تقرير الكشف", icon: <FileText className="size-4" /> },
  { key: "imaging", label: "تحليل الأشعة", icon: <ScanLine className="size-4" /> },
  { key: "guidelines", label: "البروتوكولات", icon: <BookOpen className="size-4" /> },
];

const SAMPLE_TRANSCRIPT =
  "المريض: يا دكتور بقالي 4 أيام عندي صداع مستمر في مؤخرة الراس وزغللة ودوخة، وقست الضغط في البيت كان 160 على 100.\nالطبيب: في تاريخ عائلي للضغط أو السكر؟\nالمريض: والدي كان عنده ضغط، وأنا مش باخد علاج غير بنادول وقت اللزوم.\nالطبيب: الضغط 160/100، النبض 78، فحص القلب والصدر طبيعي. هنبدأ Amlodipine 5mg الصبح، ونعمل رسم قلب ووظائف كلى، وتقليل الملح، ونشوفك بعد أسبوعين.";

export default function DoctorPage() {
  const [tab, setTab] = useState<Tab>("consultation");

  return (
    <>
      <PageHeader title="مساعد الطبيب" subtitle="تقرير SOAP وروشتة من تسجيل الكشف، وتحليل الأشعة، والبروتوكولات العلاجية" />

      <div className="no-scrollbar mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-surface text-brand-700 shadow-sm" : "text-ink-2 hover:text-ink"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "consultation" && <ConsultationTab />}
      {tab === "imaging" && <ImagingTab />}
      {tab === "guidelines" && <GuidelinesTab />}

      <p className="mt-8 text-center text-xs text-ink-3">
        مخرجات الذكاء الاصطناعي اقتراحات مساعدة فقط — القرار الطبي النهائي للطبيب المعالج.
      </p>
    </>
  );
}

// ───────────────────────── Consultation ─────────────────────────

function ConsultationTab() {
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConsultationResponse | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudio({ blob, url: URL.createObjectURL(blob) });
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("محتاجين إذن الميكروفون من المتصفح عشان نسجل الكشف.");
    }
  };

  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
    if (timer.current) clearInterval(timer.current);
  };

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(audio ? await clinicApi.analyzeAudioConsultation(audio.blob) : await clinicApi.analyzeTextConsultation(transcript));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التحليل");
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = !recording && (audio || transcript.trim().length > 20);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="h-fit lg:col-span-2">
        <CardHeader title="الكشف" subtitle="سجّل الكشف صوتياً أو الصق نص المحادثة" icon={<Stethoscope className="size-4" />} />
        <div className="space-y-4 px-5 pb-5">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            {recording ? (
              <>
                <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-rose-600">
                  <span className="size-2 animate-pulse rounded-full bg-rose-500" />
                  جاري التسجيل {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                </p>
                <Button variant="danger" onClick={stop}><Square className="size-4" />إيقاف</Button>
              </>
            ) : audio ? (
              <div className="space-y-3">
                <audio src={audio.url} controls className="w-full" />
                <Button variant="ghost" size="sm" onClick={() => setAudio(null)}><Trash2 className="size-4" />حذف التسجيل</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={start}><Mic className="size-4" />ابدأ تسجيل الكشف</Button>
            )}
          </div>

          {!audio && !recording && (
            <Field label="أو نص الكشف" hint="بالعربي أو الإنجليزي، كلام المريض والطبيب والفحص.">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={8}
                className={cx(inputClass, "h-auto py-3 leading-relaxed")}
                placeholder="المريض: … الطبيب: …"
              />
              {!transcript && (
                <button type="button" onClick={() => setTranscript(SAMPLE_TRANSCRIPT)} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
                  جرّب بمثال جاهز
                </button>
              )}
            </Field>
          )}

          {error && <ErrorBanner message={error} />}
          <Button className="w-full" size="lg" onClick={analyze} loading={loading} disabled={!canAnalyze}>
            {!loading && <Sparkles className="size-4" />}
            {loading ? "جاري التحليل…" : "حلّل واعمل التقرير"}
          </Button>
        </div>
      </Card>

      <div className="lg:col-span-3">
        {result ? (
          <ConsultationResult r={result} />
        ) : (
          <Card>
            <EmptyState
              icon={<FileText className="size-5" />}
              title="التقرير هيظهر هنا"
              hint="تقرير SOAP، التشخيص، الروشتة، وفحص التداخلات الدوائية."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function ConsultationResult({ r }: { r: ConsultationResponse }) {
  const interactions = r.drug_interactions?.interactions ?? [];
  const safe = r.drug_interactions?.safe_to_prescribe !== false && interactions.length === 0;

  return (
    <div className="animate-rise space-y-4">
      <Card className="p-5">
        <p className="text-xs text-ink-3">التشخيص المبدئي</p>
        <p className="mt-1 text-lg font-bold text-ink" dir="auto">{r.primary_diagnosis}</p>
        {r.differential_diagnoses?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.differential_diagnoses.map((d) => (
              <span key={d.diagnosis} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-ink-2" title={d.rationale} dir="auto">
                {d.diagnosis} · {d.probability}
              </span>
            ))}
          </div>
        )}
        {r.vital_signs && Object.keys(r.vital_signs).length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(r.vital_signs).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-[11px] uppercase text-ink-3">{k.replace(/_/g, " ")}</dt>
                <dd className="text-sm font-semibold" dir="ltr">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader title="تقرير SOAP" icon={<FileText className="size-4" />} />
        <dl className="divide-y divide-line px-5 pb-2" dir="auto">
          {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
            <div key={k} className="py-3">
              <dt className="text-xs font-semibold tracking-wide text-brand-700 uppercase">{k}</dt>
              <dd className="mt-1 text-sm whitespace-pre-line text-ink-2">{r.soap_notes?.[k]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="الروشتة"
          icon={<Pill className="size-4" />}
          action={
            <span className={cx("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", safe ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700")}>
              {safe ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              {safe ? "مفيش تداخلات" : `${interactions.length} تداخل دوائي`}
            </span>
          }
        />
        <div className="space-y-2 px-5 pb-5">
          {interactions.map((it, i) => (
            <div key={i} className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200" dir="auto">
              <p className="font-semibold">{it.severity} · {it.drugs.join(" + ")}</p>
              <p className="mt-0.5">{it.clinical_effect}</p>
              <p className="mt-0.5 text-rose-800/80">{it.recommendation}</p>
            </div>
          ))}
          {r.prescription?.length ? (
            r.prescription.map((m, i) => (
              <div key={i} className="rounded-xl px-4 py-3 ring-1 ring-line" dir="ltr">
                <p className="font-semibold">{m.name} <span className="font-normal text-ink-2">{m.dosage}</span></p>
                <p className="text-sm text-ink-2">{m.frequency} · {m.duration}</p>
                {m.instructions && <p className="mt-0.5 text-xs text-ink-3" dir="auto">{m.instructions}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-3">مفيش أدوية في الكشف ده.</p>
          )}
        </div>
      </Card>

      {(r.lab_requests?.length > 0 || r.follow_up_recommendation || r.lifestyle_advice?.length > 0) && (
        <Card>
          <CardHeader title="المتابعة" icon={<FlaskConical className="size-4" />} />
          <div className="space-y-3 px-5 pb-5 text-sm" dir="auto">
            {r.lab_requests?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.lab_requests.map((l) => <span key={l} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs">{l}</span>)}
              </div>
            )}
            {r.follow_up_recommendation && <p className="text-ink-2">{r.follow_up_recommendation}</p>}
            {r.lifestyle_advice?.length > 0 && (
              <ul className="list-disc space-y-1 ps-5 text-ink-2">
                {r.lifestyle_advice.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── Imaging ─────────────────────────

const MODALITIES = [
  { value: "xray", label: "أشعة X" },
  { value: "ct", label: "مقطعية CT" },
  { value: "mri", label: "رنين MRI" },
  { value: "ultrasound", label: "سونار" },
  { value: "lab_report", label: "تحليل معمل" },
];

function ImagingTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState("xray");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImagingAnalysisResponse | null>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await clinicApi.analyzeMedicalImaging({ imageFile: file, imageType: type, clinicalContext: context || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التحليل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="h-fit lg:col-span-2">
        <CardHeader title="الصورة" subtitle="JPG أو PNG" icon={<ImageUp className="size-4" />} />
        <div className="space-y-4 px-5 pb-5">
          <label
            className="flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-slate-50 text-center transition hover:border-brand-300"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files[0]);
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="الصورة المرفوعة" className="max-h-64 w-full object-contain" />
            ) : (
              <span className="px-4 py-10 text-sm text-ink-3">
                <ImageUp className="mx-auto mb-2 size-7" />
                اسحب الصورة هنا أو اضغط للاختيار
              </span>
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>

          <Field label="نوع الفحص">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {MODALITIES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="معلومات سريرية (اختياري)">
            <input value={context} onChange={(e) => setContext(e.target.value)} className={inputClass} placeholder="مثلاً: كحة وحرارة من 5 أيام" />
          </Field>

          {error && <ErrorBanner message={error} />}
          <Button className="w-full" size="lg" onClick={analyze} loading={loading} disabled={!file}>
            {!loading && <Sparkles className="size-4" />}
            {loading ? "جاري التحليل…" : "حلّل الصورة"}
          </Button>
        </div>
      </Card>

      <div className="lg:col-span-3">
        {result ? (
          <div className="animate-rise space-y-4" dir="auto">
            {result.critical_alert && (
              <div className="flex gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <p><strong>تنبيه حرج:</strong> {result.critical_alert}</p>
              </div>
            )}
            <Card className="p-5">
              <p className="text-xs text-ink-3">{result.modality} · {result.anatomical_region} · ثقة {result.confidence_level}</p>
              <p className="mt-1 text-lg font-bold">{result.impression}</p>
              {result.quality_assessment && <p className="mt-1 text-sm text-ink-3">{result.quality_assessment}</p>}
            </Card>
            <Card>
              <CardHeader title="الملاحظات" icon={<ScanLine className="size-4" />} />
              <ul className="divide-y divide-line px-5 pb-2">
                {result.findings.map((f, i) => (
                  <li key={i} className="flex gap-3 py-3 text-sm">
                    {f.is_abnormal ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
                    <span><strong className="font-semibold">{f.structure}:</strong> <span className="text-ink-2">{f.observation}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
            {result.recommendations.length > 0 && (
              <Card className="p-5">
                <p className="mb-2 font-semibold">التوصيات</p>
                <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">
                  {result.recommendations.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<ScanLine className="size-5" />} title="نتيجة التحليل هتظهر هنا" hint="الملاحظات، الانطباع العام، والتوصيات." />
          </Card>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Guidelines ─────────────────────────

const QUICK_CONDITIONS = ["Hypertension", "Diabetes", "Sinusitis"];

function GuidelinesTab() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuidelineResult | null>(null);

  const search = async (condition: string) => {
    if (!condition.trim()) return;
    setQuery(condition);
    setLoading(true);
    setError(null);
    try {
      setResult(await clinicApi.getClinicalGuidelines(condition.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر البحث");
    } finally {
      setLoading(false);
    }
  };

  const therapy = (result?.first_line_therapy as { class: string; examples: string[] }[] | undefined) ?? [];
  const textFields = (["lifestyle_modifications", "red_flags", "notes", "guideline_summary", "follow_up"] as const).filter(
    (k) => typeof result?.[k] === "string"
  );
  const fieldLabel: Record<(typeof textFields)[number], string> = {
    lifestyle_modifications: "نمط الحياة",
    red_flags: "علامات الخطر",
    notes: "ملاحظات",
    guideline_summary: "الملخص",
    follow_up: "المتابعة",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex gap-2"
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass} placeholder="اسم الحالة بالإنجليزي، مثلاً Hypertension" dir="auto" />
        <Button type="submit" loading={loading}>{!loading && <Search className="size-4" />}بحث</Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_CONDITIONS.map((c) => (
          <button key={c} onClick={() => search(c)} className="rounded-full bg-surface px-3 py-1 text-sm text-ink-2 ring-1 ring-line hover:text-brand-700">
            {c}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card className="animate-rise p-5" dir="ltr">
          <h2 className="text-lg font-bold">{result.condition}</h2>
          {therapy.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">First-line therapy</p>
              {therapy.map((t) => (
                <div key={t.class} className="rounded-xl px-4 py-3 ring-1 ring-line">
                  <p className="font-semibold">{t.class}</p>
                  <p className="text-sm text-ink-2">{t.examples.join(" · ")}</p>
                </div>
              ))}
            </div>
          )}
          {textFields.map((k) => (
            <div key={k} className={cx("mt-4 rounded-xl px-4 py-3 text-sm", k === "red_flags" ? "bg-rose-50 text-rose-900" : "bg-slate-50 text-ink-2")} dir="auto">
              <p className="mb-0.5 text-xs font-semibold">{fieldLabel[k]}</p>
              {String(result[k])}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
