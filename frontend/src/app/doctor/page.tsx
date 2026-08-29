"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import {
  clinicApi,
  ConsultationResponse,
  ImagingAnalysisResponse,
} from "@/services/api";
import {
  Mic,
  MicOff,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Stethoscope,
  Activity,
  Pill,
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
  Send,
} from "lucide-react";

export default function DoctorCoPilotPage() {
  const [activeTab, setActiveTab] = useState<"consultation" | "imaging" | "guidelines">("consultation");

  // === Consultation State ===
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcriptInput, setTranscriptInput] = useState(
    "المريض: يا دكتور بقالي 4 أيام بشتكي من صداع مستمر في الجبهة وزغللة في العين ودوخة، ولما قست الضغط في البيت كان 160 على 100. كمان بحس بنغزات خفيفة في الصدر مع المجهود.\nالطبيب: تمام، هل عندك تاريخ مرضي للضغط أو السكر في العائلة؟\nالمريض: والدي كان مريض ضغط، وأنا مش باخد أي علاج منتظم غير مسكنات بنادول أو بروفين وقت اللزوم.\nالطبيب: الفحص السريري: ضغط الدم 160/100 mmHg، النبض 78 bpm، فحص الصدر والقلب طبيعي. التشخيص: ارتفاع ضغط الدم الأولي Stage 2 Essential Hypertension. الخطة: هنبدأ علاج Amlodipine 5mg قرص صباحاً مع Concor 2.5mg، ونطلب رسم قلب ECG وتحليل وظائف كلى ومتابعة دورية مع تقليل الملح تماماً، ونشوفك بعد أسبوعين."
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [consultationResult, setConsultationResult] = useState<ConsultationResponse | null>(null);

  // === MediaRecorder Refs ===
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // === Imaging State ===
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>("xray");
  const [clinicalContext, setClinicalContext] = useState(
    "Chest X-Ray PA View: Patient presents with persistent cough, fever 38.5C, and localized crackles."
  );
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imagingResult, setImagingResult] = useState<ImagingAnalysisResponse | null>(null);

  // === Guidelines State ===
  const [guidelineSearch, setGuidelineSearch] = useState("Hypertension");
  const [guidelineResult, setGuidelineResult] = useState<any>(null);
  const [isLoadingGuideline, setIsLoadingGuideline] = useState(false);

  // --- Voice Recording Handlers ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("يرجى إعطاء صلاحية الميكروفون للمتصفح لتسجيل الكشف الصوتي.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // --- Analyze Consultation ---
  const handleAnalyzeConsultation = async () => {
    setIsAnalyzing(true);
    try {
      let res: ConsultationResponse;
      if (audioBlob) {
        res = await clinicApi.analyzeAudioConsultation(audioBlob, "recording.webm");
      } else {
        res = await clinicApi.analyzeTextConsultation(transcriptInput);
      }
      setConsultationResult(res);
    } catch (err: any) {
      alert(`خطأ في معالجة الاستشارة: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Analyze Medical Image ---
  const handleAnalyzeImage = async () => {
    if (!imageFile && !imagePreview) {
      alert("يرجى اختيار صورة الأشعة أو التحليل أولاً.");
      return;
    }
    setIsAnalyzingImage(true);
    try {
      const res = await clinicApi.analyzeMedicalImaging({
        imageFile: imageFile || undefined,
        imageUrl: !imageFile && imagePreview ? imagePreview : undefined,
        imageType,
        clinicalContext,
      });
      setImagingResult(res);
    } catch (err: any) {
      alert(`خطأ في فحص الأشعة: ${err.message}`);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // --- Search Guidelines ---
  const handleSearchGuidelines = async () => {
    if (!guidelineSearch.trim()) return;
    setIsLoadingGuideline(true);
    try {
      const res = await clinicApi.getClinicalGuidelines(guidelineSearch);
      setGuidelineResult(res);
    } catch (err: any) {
      alert(`خطأ في استرجاع البروتوكول: ${err.message}`);
    } finally {
      setIsLoadingGuideline(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Phase 2 — Doctor AI Co-Pilot
              </span>
              <span className="text-xs text-slate-400">GPT-4o Multimodal + Whisper</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              مساعد الطبيب الذكي والاستشارات السريرية
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              تفريغ فوري للمحادثات، توليد تقارير SOAP، روشتات ذكية مع فحص التعارض، وفحص الأشعة بالرؤية الحاسوبية.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-2xl glass border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setActiveTab("consultation")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "consultation"
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              الاستشارة و SOAP
            </button>
            <button
              onClick={() => setActiveTab("imaging")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "imaging"
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-4 h-4" />
              فحص الأشعة VLM
            </button>
            <button
              onClick={() => setActiveTab("guidelines")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "guidelines"
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-4 h-4" />
              البروتوكولات الطبية
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: CONSULTATION & SOAP NOTE GENERATOR */}
        {/* ======================================================== */}
        {activeTab === "consultation" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Input Studio (Audio / Transcript) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Voice Recording Card */}
              <div className="glass rounded-3xl p-6 border border-slate-800/80 shadow-xl relative overflow-hidden">
                <h3 className="font-bold text-base text-white mb-3 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-brand-400" />
                  تسجيل جلسة الكشف المباشرة
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  سجل حديث الكشف بينك وبين المريض مباشرة وسيقوم الذكاء الاصطناعي بتفريغه وترجمته لتقرير طبي فوري.
                </p>

                {/* Mic Visualizer & Button */}
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/60 border border-slate-800 mb-4">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 shadow-2xl ${
                      isRecording
                        ? "bg-rose-500 hover:bg-rose-600 animate-pulse shadow-rose-500/40"
                        : "bg-gradient-to-tr from-brand-600 to-accent-500 shadow-brand-500/30"
                    }`}
                  >
                    {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  </button>

                  <div className="mt-4 text-center">
                    {isRecording ? (
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                        <span className="font-mono text-lg font-bold text-rose-400">
                          {formatTimer(recordingDuration)}
                        </span>
                        <span className="text-xs text-slate-400">(جاري التسجيل...)</span>
                      </div>
                    ) : audioBlob ? (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> تم تسجيل مقطع صوتي جاهز للتحليل
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">اضغط على الميكروفون لبدء التسجيل</span>
                    )}
                  </div>

                  {audioUrl && (
                    <audio controls src={audioUrl} className="w-full mt-4 h-10 rounded-lg" />
                  )}
                </div>

                {/* Upload Audio File Alternative */}
                <div className="relative border border-dashed border-slate-700 hover:border-brand-500 rounded-2xl p-4 text-center cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAudioBlob(file);
                        setAudioUrl(URL.createObjectURL(file));
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Upload className="w-4 h-4 text-brand-400" />
                    <span>أو ارفع ملف تسجيل صوتي (MP3, WAV, M4A, WEBM)</span>
                  </div>
                </div>
              </div>

              {/* Transcript Text Input Card */}
              <div className="glass rounded-3xl p-6 border border-slate-800/80 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-accent-400" />
                    نص الحوار السريري / ملاحظات الطبيب
                  </h3>
                  <button
                    onClick={() =>
                      setTranscriptInput(
                        "المريض يشتكي من ارتفاع في السكر التراكمي HbA1c 9.2% مع كثرة التبول والعطش الشديد. الفحص: الوزن 92 كجم، الضغط 130/80. الخطة: بدء Metformin 1000mg مرتين يومياً مع Jardiance 10mg ومتابعة سكر صائم وفاطر يومياً."
                      )
                    }
                    className="text-[11px] text-brand-400 hover:underline"
                  >
                    نموذج سكري 🧪
                  </button>
                </div>

                <textarea
                  value={transcriptInput}
                  onChange={(e) => setTranscriptInput(e.target.value)}
                  rows={7}
                  placeholder="اكتب أو الصق نص محادثة الكشف أو ملاحظاتك السريرية هنا..."
                  className="w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-4 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-brand-500 leading-relaxed resize-none"
                />

                <button
                  onClick={handleAnalyzeConsultation}
                  disabled={isAnalyzing}
                  className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري المعالجة والتحليل السريري الذكي...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      توليد تقرير SOAP والروشتة فوراً
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Structured Clinical Output (SOAP + Rx + Interactions) */}
            <div className="lg:col-span-7 space-y-6">
              {consultationResult ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Diagnosis & Summary Banner */}
                  <div className="glass rounded-3xl p-6 border border-slate-800 glow-brand">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <span className="text-xs text-slate-400 font-medium">التشخيص الأولي (Primary Diagnosis)</span>
                        <h2 className="text-xl sm:text-2xl font-black text-gradient">
                          {consultationResult.primary_diagnosis}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                          Consultation Completed ✅
                        </span>
                      </div>
                    </div>

                    {/* Differential Diagnoses */}
                    {consultationResult.differential_diagnoses?.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                        <span className="text-xs text-slate-400 self-center">التشخيصات التفريقية:</span>
                        {consultationResult.differential_diagnoses.map((d, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs border border-slate-700"
                          >
                            {d.diagnosis} ({d.probability})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SOAP Note Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Subjective (S) */}
                    <div className="glass rounded-2xl p-5 border border-slate-800">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-400 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-brand-500/20 flex items-center justify-center text-[11px]">
                          S
                        </span>
                        Subjective (شكوى المريض والأعراض)
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {consultationResult.soap_notes?.subjective}
                      </p>
                    </div>

                    {/* Objective (O) */}
                    <div className="glass rounded-2xl p-5 border border-slate-800">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-cyan-500/20 flex items-center justify-center text-[11px]">
                          O
                        </span>
                        Objective (الفحص والمؤشرات)
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-2">
                        {consultationResult.soap_notes?.objective}
                      </p>
                      {consultationResult.vital_signs && Object.keys(consultationResult.vital_signs).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {Object.entries(consultationResult.vital_signs).map(([k, v]) => (
                            <span key={k} className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-900 text-cyan-300 border border-slate-800">
                              {k}: <strong>{v}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assessment (A) */}
                    <div className="glass rounded-2xl p-5 border border-slate-800">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-accent-400 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-accent-500/20 flex items-center justify-center text-[11px]">
                          A
                        </span>
                        Assessment (التقييم السريري)
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {consultationResult.soap_notes?.assessment}
                      </p>
                    </div>

                    {/* Plan (P) */}
                    <div className="glass rounded-2xl p-5 border border-slate-800">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-[11px]">
                          P
                        </span>
                        Plan (الخطة العلاجية والتعليمات)
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {consultationResult.soap_notes?.plan}
                      </p>
                    </div>
                  </div>

                  {/* Drug-Drug Interaction Safety Alert Box */}
                  {consultationResult.drug_interactions && (
                    <div
                      className={`rounded-2xl p-4 border ${
                        consultationResult.drug_interactions.safe_to_prescribe
                          ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                          : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {consultationResult.drug_interactions.safe_to_prescribe ? (
                          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className="font-bold text-sm">
                            {consultationResult.drug_interactions.safe_to_prescribe
                              ? "فحص أمان الأدوية: الروشتة آمنة تماماً ولا يوجد تعارض دوائي ✅"
                              : "⚠️ تنبيه طبي خطير: تم رصد تعارض بين الأدوية الموصوفة!"}
                          </h4>
                          {!consultationResult.drug_interactions.safe_to_prescribe && (
                            <div className="mt-2 space-y-1.5 text-xs text-rose-300">
                              {consultationResult.drug_interactions.interactions.map((item, idx) => (
                                <div key={idx} className="p-2 rounded-xl bg-rose-900/30 border border-rose-800/40">
                                  <p>
                                    <strong>الأدوية:</strong> {item.drugs?.join(" + ")} (
                                    <span className="text-rose-400 font-bold">{item.severity}</span>)
                                  </p>
                                  <p>
                                    <strong>التأثير:</strong> {item.clinical_effect}
                                  </p>
                                  <p className="text-rose-200 font-medium">
                                    💡 <strong>التوصية:</strong> {item.recommendation}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Smart Prescription (Rx) Table */}
                  <div className="glass rounded-3xl p-6 border border-slate-800">
                    <h3 className="font-bold text-base text-white mb-4 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-accent-400" />
                      الروشتة الطبية الذكية (Prescription Rx)
                    </h3>

                    {consultationResult.prescription?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-3 font-semibold">الدواء</th>
                              <th className="pb-3 font-semibold">الجرعة</th>
                              <th className="pb-3 font-semibold">التكرار</th>
                              <th className="pb-3 font-semibold">المدة</th>
                              <th className="pb-3 font-semibold">التعليمات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {consultationResult.prescription.map((rx, idx) => (
                              <tr key={idx} className="text-slate-200">
                                <td className="py-3 font-bold text-brand-400">{rx.name}</td>
                                <td className="py-3">{rx.dosage}</td>
                                <td className="py-3">{rx.frequency}</td>
                                <td className="py-3">{rx.duration}</td>
                                <td className="py-3 text-slate-400 text-xs">{rx.instructions}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">لا توجد أدوية مضافة في هذه الاستشارة.</p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 glass rounded-3xl border border-dashed border-slate-800 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-3xl mb-4">
                    🩺
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1">مساحة عمل المساعد السريري الذكي</h3>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                    سجل صوتاً أو اضغط على &quot;توليد تقرير SOAP والروشتة فوراً&quot; لعرض التحليل الطبي والاستدلال السريري هنا.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MEDICAL IMAGING & LAB VLM SCANNER */}
        {/* ======================================================== */}
        {activeTab === "imaging" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Image Upload Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass rounded-3xl p-6 border border-slate-800 shadow-xl">
                <h3 className="font-bold text-base text-white mb-3 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-brand-400" />
                  رفع وفحص الأشعة أو صورة التحاليل
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  ارفع صورة أشعة سينية (X-Ray)، رنين (MRI)، مقطعية (CT)، أو صورة تقرير معملي لتحليلها لحظياً عبر GPT-4o Multimodal.
                </p>

                {/* Modality Selector */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { id: "xray", label: "X-Ray" },
                    { id: "mri", label: "MRI" },
                    { id: "ct", label: "CT Scan" },
                    { id: "lab_report", label: "تحليل دم" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setImageType(m.id)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        imageType === m.id
                          ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                          : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Dropzone / Preview */}
                <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-3xl p-6 text-center cursor-pointer transition-colors mb-4 overflow-hidden min-h-[220px] flex flex-col items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setImageFile(f);
                        setImagePreview(URL.createObjectURL(f));
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="Medical Scan"
                      className="max-h-52 w-auto object-contain rounded-xl shadow-lg"
                    />
                  ) : (
                    <div>
                      <Upload className="w-10 h-10 text-brand-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-white">اضغط لاختيار صورة الأشعة أو اسحبها هنا</p>
                      <p className="text-[11px] text-slate-500 mt-1">JPEG, PNG, DICOM</p>
                    </div>
                  )}
                </div>

                {/* Quick Sample Button */}
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg/600px-Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg"
                    );
                    setClinicalContext("Chest X-Ray PA View: Patient presents with cough and fever 38.5C.");
                  }}
                  className="text-xs text-brand-400 hover:underline mb-4 block"
                >
                  📷 تجربة عينة أشعة سينية حقيقية (Chest X-Ray)
                </button>

                {/* Context Input */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    السياق السريري وشكوى المريض:
                  </label>
                  <input
                    type="text"
                    value={clinicalContext}
                    onChange={(e) => setClinicalContext(e.target.value)}
                    placeholder="مثال: ألم في الصدر مع كحة وارتفاع حرارة..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  onClick={handleAnalyzeImage}
                  disabled={isAnalyzingImage}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzingImage ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري الفحص بالرؤية الحاسوبية VLM...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      فحص الأشعة واستخراج التقرير
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Imaging Results Output */}
            <div className="lg:col-span-7 space-y-6">
              {imagingResult ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <span className="text-xs text-slate-400 font-medium">نوع الفحص والمنطقة التشريحية</span>
                      <h2 className="text-xl font-black text-white">
                        {imagingResult.modality} — {imagingResult.anatomical_region}
                      </h2>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-bold">
                      Quality: {imagingResult.quality_assessment}
                    </span>
                  </div>

                  {/* Impression Box */}
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-brand-500/30 glow-brand">
                    <h4 className="text-xs font-bold text-brand-400 uppercase mb-1">الانطباع التشخيصي (Diagnostic Impression):</h4>
                    <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                      {imagingResult.impression}
                    </p>
                  </div>

                  {/* Structured Findings */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">الملاحظات التشريحية المنظمة (Findings):</h4>
                    <div className="space-y-2">
                      {imagingResult.findings?.map((f, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs"
                        >
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${f.is_abnormal ? "bg-rose-500" : "bg-emerald-400"}`} />
                          <div>
                            <strong className="text-slate-200">{f.structure}:</strong>{" "}
                            <span className="text-slate-400">{f.observation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {imagingResult.recommendations?.length > 0 && (
                    <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200">
                      <h4 className="font-bold mb-1.5 text-cyan-300">التوصيات السريرية والمتابعة:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {imagingResult.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 glass rounded-3xl border border-dashed border-slate-800 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent-500/10 flex items-center justify-center text-3xl mb-4">
                    🔬
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1">محلل الأشعة والتحاليل بالرؤية الحاسوبية</h3>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                    ارفع صورة الفحص من اليسار واضغط على فحص الأشعة لعرض مسودة التقرير الإشعاعي والملاحظات هنا.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: CLINICAL GUIDELINES */}
        {/* ======================================================== */}
        {activeTab === "guidelines" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="glass rounded-3xl p-6 border border-slate-800">
              <h3 className="font-bold text-base text-white mb-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-brand-400" />
                البحث في البروتوكولات العلاجية المبنية على الدليل (Evidence-Based Guidelines)
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                ابحث عن أي تشخيص (مثل: Hypertension, Diabetes, Sinusitis, Asthma) للاطلاع على أدوية الخط الأول والتوصيات.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={guidelineSearch}
                  onChange={(e) => setGuidelineSearch(e.target.value)}
                  placeholder="اكتب اسم المرض أو التشخيص..."
                  className="flex-1 rounded-2xl bg-slate-900 border border-slate-800 p-3.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={handleSearchGuidelines}
                  disabled={isLoadingGuideline}
                  className="px-6 py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-sm shadow-md shadow-brand-500/25 transition-all flex items-center gap-2"
                >
                  {isLoadingGuideline ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  بحث
                </button>
              </div>
            </div>

            {guidelineResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-3xl p-6 border border-slate-800 space-y-4"
              >
                <h2 className="text-xl font-bold text-gradient">{guidelineResult.condition}</h2>

                {guidelineResult.first_line_therapy && (
                  <div>
                    <h4 className="text-xs font-bold text-brand-400 uppercase mb-2">أدوية الخط الأول (First-Line Therapy):</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {guidelineResult.first_line_therapy.map((item: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                          <strong className="text-slate-200 block mb-1">{item.class}</strong>
                          <span className="text-slate-400">{item.examples?.join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guidelineResult.lifestyle_modifications && (
                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-300">
                    <strong className="text-accent-400 block mb-1">تعديل نمط الحياة (Lifestyle Modifications):</strong>
                    {guidelineResult.lifestyle_modifications}
                  </div>
                )}

                {guidelineResult.red_flags && (
                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300">
                    <strong className="text-rose-400 block mb-1">علامات الخطر الحرجة (Red Flags):</strong>
                    {guidelineResult.red_flags}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
