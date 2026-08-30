"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
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
  Pill,
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
} from "lucide-react";

export default function DoctorCoPilotPage() {
  const [activeTab, setActiveTab] = useState<"consultation" | "imaging" | "guidelines">("consultation");

  // === Consultation State ===
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcriptInput, setTranscriptInput] = useState(
    "المريض: يا دكتور بقالي 4 أيام بشتكي من صداع مستمر في مؤخرة الرأس وزغللة في العين مع دوخة، ولما قست الضغط في البيت كان 160 على 100. كمان بحس بنغزات خفيفة في الصدر مع المجهود.\nالطبيب: تمام، هل عندك تاريخ مرضي للضغط أو السكر في العائلة؟\nالمريض: والدي كان مريض ضغط، وأنا مش باخد أي علاج منتظم غير مسكنات بنادول أو بروفين وقت اللزوم.\nالطبيب: الفحص السريري: ضغط الدم 160/100 mmHg، النبض 78 bpm، فحص الصدر والقلب طبيعي. التشخيص: ارتفاع ضغط الدم الأولي Stage 2 Essential Hypertension. الخطة: هنبدأ علاج Amlodipine 5mg قرص صباحاً مع Concor 2.5mg، ونطلب رسم قلب ECG وتحليل وظائف كلى ومتابعة دورية مع تقليل الملح تماماً، ونشوفك بعد أسبوعين."
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row font-sans">
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 md:mr-72 flex flex-col min-h-screen">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
          {/* Header Title Card */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-md">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Phase 2 — Doctor AI Co-Pilot
                </span>
                <span className="text-xs text-slate-500 font-bold">GPT-4o Multimodal + Whisper</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                مساعد الطبيب والاستشارات السريرية الذكية
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                تفريغ فوري للمحادثات، توليد تقارير SOAP، روشتات ذكية مع فحص التعارض، وفحص الأشعة بالرؤية الحاسوبية.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center p-1.5 rounded-2xl bg-slate-100 border border-slate-200 self-start md:self-auto shadow-inner">
              <button
                onClick={() => setActiveTab("consultation")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  activeTab === "consultation"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                الاستشارة و SOAP
              </button>
              <button
                onClick={() => setActiveTab("imaging")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  activeTab === "imaging"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye className="w-4 h-4" />
                فحص الأشعة VLM
              </button>
              <button
                onClick={() => setActiveTab("guidelines")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  activeTab === "guidelines"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Search className="w-4 h-4" />
                البروتوكولات الطبية
              </button>
            </div>
          </div>

          {/* TAB 1: CONSULTATION & SOAP */}
          {activeTab === "consultation" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-5 space-y-6">
                {/* Voice Recording Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md">
                  <h3 className="font-black text-base text-slate-900 mb-1.5 flex items-center gap-2">
                    <Mic className="w-5 h-5 text-teal-600" />
                    تسجيل جلسة الكشف المباشرة
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mb-6">
                    سجل حديث الكشف بينك وبين المريض مباشرة وسيقوم الذكاء الاصطناعي بتفريغه وترجمته لتقرير طبي فوري.
                  </p>

                  <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-teal-50/70 border border-teal-200 mb-4">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 shadow-xl ${
                        isRecording
                          ? "bg-rose-600 hover:bg-rose-700 animate-pulse shadow-rose-600/40"
                          : "bg-gradient-to-tr from-teal-600 to-sky-600 shadow-teal-600/30"
                      }`}
                    >
                      {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                    </button>

                    <div className="mt-4 text-center">
                      {isRecording ? (
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                          <span className="font-mono text-lg font-black text-rose-700">
                            {formatTimer(recordingDuration)}
                          </span>
                          <span className="text-xs text-slate-600 font-bold">(جاري التسجيل...)</span>
                        </div>
                      ) : audioBlob ? (
                        <span className="text-xs text-emerald-800 font-black flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> تم تسجيل مقطع صوتي جاهز للتحليل
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600 font-semibold">اضغط على الميكروفون لبدء التسجيل الصوتي</span>
                      )}
                    </div>

                    {audioUrl && (
                      <audio controls src={audioUrl} className="w-full mt-4 h-10 rounded-lg" />
                    )}
                  </div>

                  <div className="relative border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/30 rounded-2xl p-4 text-center cursor-pointer transition-colors">
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
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-700 font-bold">
                      <Upload className="w-4 h-4 text-teal-600" />
                      <span>أو ارفع ملف تسجيل صوتي (MP3, WAV, M4A, WEBM)</span>
                    </div>
                  </div>
                </div>

                {/* Transcript Input Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-sky-600" />
                      نص الحوار السريري / ملاحظات الطبيب
                    </h3>
                    <button
                      onClick={() =>
                        setTranscriptInput(
                          "المريض يشتكي من ارتفاع في السكر التراكمي HbA1c 9.2% مع كثرة التبول والعطش الشديد. الفحص: الوزن 92 كجم، الضغط 130/80. الخطة: بدء Metformin 1000mg مرتين يومياً مع Jardiance 10mg ومتابعة سكر صائم وفاطر يومياً."
                        )
                      }
                      className="text-xs text-teal-700 font-black hover:underline"
                    >
                      نموذج حالة سكري
                    </button>
                  </div>

                  <textarea
                    value={transcriptInput}
                    onChange={(e) => setTranscriptInput(e.target.value)}
                    rows={7}
                    placeholder="اكتب أو الصق نص محادثة الكشف أو ملاحظاتك السريرية هنا..."
                    className="w-full rounded-2xl bg-slate-50 border-2 border-slate-300 p-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white leading-relaxed resize-none transition-all shadow-inner"
                  />

                  <button
                    onClick={handleAnalyzeConsultation}
                    disabled={isAnalyzing}
                    className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white font-black text-sm shadow-md shadow-teal-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري التحليل السريري وتوليد SOAP Note...
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

              {/* Right Column: Output */}
              <div className="lg:col-span-7 space-y-6">
                {consultationResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Diagnosis Banner */}
                    <div className="bg-white rounded-3xl p-6 border-2 border-teal-500 shadow-md">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">التشخيص الأولي (Primary Diagnosis)</span>
                          <h2 className="text-xl sm:text-2xl font-black text-teal-800">
                            {consultationResult.primary_diagnosis}
                          </h2>
                        </div>
                        <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          اكتمل التحليل السريري
                        </span>
                      </div>

                      {consultationResult.differential_diagnoses?.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                          <span className="text-xs text-slate-500 font-bold self-center">التشخيصات التفريقية:</span>
                          {consultationResult.differential_diagnoses.map((d, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200"
                            >
                              {d.diagnosis} ({d.probability})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SOAP Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* S */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-black uppercase tracking-wider text-teal-800 mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center text-xs font-black">
                            S
                          </span>
                          Subjective (شكوى المريض والأعراض)
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                          {consultationResult.soap_notes?.subjective}
                        </p>
                      </div>

                      {/* O */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-black uppercase tracking-wider text-sky-800 mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-900 flex items-center justify-center text-xs font-black">
                            O
                          </span>
                          Objective (الفحص والمؤشرات)
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed mb-3">
                          {consultationResult.soap_notes?.objective}
                        </p>
                        {consultationResult.vital_signs && Object.keys(consultationResult.vital_signs).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            {Object.entries(consultationResult.vital_signs).map(([k, v]) => (
                              <span key={k} className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 font-bold">
                                {k}: <strong>{v}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* A */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800 mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-900 flex items-center justify-center text-xs font-black">
                            A
                          </span>
                          Assessment (التقييم السريري)
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                          {consultationResult.soap_notes?.assessment}
                        </p>
                      </div>

                      {/* P */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center text-xs font-black">
                            P
                          </span>
                          Plan (الخطة العلاجية والتعليمات)
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                          {consultationResult.soap_notes?.plan}
                        </p>
                      </div>
                    </div>

                    {/* Drug Interactions */}
                    {consultationResult.drug_interactions && (
                      <div
                        className={`rounded-2xl p-5 border shadow-sm ${
                          consultationResult.drug_interactions.safe_to_prescribe
                            ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                            : "bg-rose-50 border-2 border-rose-400 text-rose-950"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          {consultationResult.drug_interactions.safe_to_prescribe ? (
                            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <h4 className="font-black text-sm">
                              {consultationResult.drug_interactions.safe_to_prescribe
                                ? "فحص أمان الأدوية: الروشتة آمنة تماماً ولا يوجد أي تعارض دوائي"
                                : "تحذير طبي: تم رصد تداخل وتعارض بين الأدوية الموصوفة"}
                            </h4>
                            {!consultationResult.drug_interactions.safe_to_prescribe && (
                              <div className="mt-3 space-y-2 text-xs">
                                {consultationResult.drug_interactions.interactions.map((item, idx) => (
                                  <div key={idx} className="p-3 rounded-xl bg-white border border-rose-300 text-rose-950 shadow-2xs">
                                    <p>
                                      <strong>الأدوية المتعارضة:</strong> {item.drugs?.join(" + ")} (
                                      <span className="text-rose-700 font-bold">{item.severity}</span>)
                                    </p>
                                    <p className="mt-1">
                                      <strong>التأثير السريري:</strong> {item.clinical_effect}
                                    </p>
                                    <p className="text-rose-800 font-bold mt-1">
                                      <strong>التوصية السريرية البديلة:</strong> {item.recommendation}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Prescription */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                      <h3 className="font-black text-base text-slate-900 mb-4 flex items-center gap-2">
                        <Pill className="w-5 h-5 text-teal-600" />
                        الروشتة الطبية الذكية (Prescription Rx)
                      </h3>

                      {consultationResult.prescription?.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                                <th className="py-3 px-4 font-black rounded-r-xl">اسم الدواء</th>
                                <th className="py-3 px-3 font-black">الجرعة</th>
                                <th className="py-3 px-3 font-black">التكرار</th>
                                <th className="py-3 px-3 font-black">المدة</th>
                                <th className="py-3 px-4 font-black rounded-l-xl">تعليمات الاستخدام</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {consultationResult.prescription.map((rx, idx) => (
                                <tr key={idx} className="text-slate-800 hover:bg-teal-50/30 transition-colors">
                                  <td className="py-3.5 px-4 font-black text-teal-800">{rx.name}</td>
                                  <td className="py-3.5 px-3 font-bold">{rx.dosage}</td>
                                  <td className="py-3.5 px-3 font-semibold">{rx.frequency}</td>
                                  <td className="py-3.5 px-3 font-semibold">{rx.duration}</td>
                                  <td className="py-3.5 px-4 text-slate-600 text-xs font-bold">{rx.instructions}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 font-bold">لا توجد أدوية مسجلة في هذه الجلسة.</p>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-300 text-center shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4 text-teal-600 shadow-xs">
                      <Stethoscope className="w-8 h-8" />
                    </div>
                    <h3 className="font-black text-lg text-slate-900 mb-1">مساحة عمل المساعد السريري الذكي</h3>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md leading-relaxed">
                      سجل صوتاً أو اضغط على &quot;توليد تقرير SOAP والروشتة فوراً&quot; لعرض التشخيص والاستدلال السريري والروشتة هنا.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMAGING */}
          {activeTab === "imaging" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md">
                  <h3 className="font-black text-base text-slate-900 mb-2 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-teal-600" />
                    رفع وفحص الأشعة أو صورة التحاليل
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mb-6">
                    ارفع صورة أشعة سينية (X-Ray)، رنين (MRI)، مقطعية (CT)، أو صورة تقرير معملي لتحليلها لحظياً عبر GPT-4o Multimodal.
                  </p>

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
                        className={`py-2 rounded-xl text-xs font-black transition-all ${
                          imageType === m.id
                            ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                            : "bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/20 rounded-3xl p-6 text-center cursor-pointer transition-colors mb-4 overflow-hidden min-h-[220px] flex flex-col items-center justify-center">
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
                        className="max-h-52 w-auto object-contain rounded-xl shadow-md border border-slate-200"
                      />
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 text-teal-600 mx-auto mb-2" />
                        <p className="text-xs font-black text-slate-800">اضغط لاختيار صورة الأشعة أو اسحبها هنا</p>
                        <p className="text-[11px] text-slate-400 font-bold mt-1">JPEG, PNG, DICOM</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(
                        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg/600px-Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg"
                      );
                      setClinicalContext("Chest X-Ray PA View: Patient presents with cough and fever 38.5C.");
                    }}
                    className="text-xs font-black text-teal-700 hover:underline mb-4 block"
                  >
                    تحميل عينة أشعة سينية تجريبية (Chest X-Ray)
                  </button>

                  <div className="mb-4">
                    <label className="block text-xs font-black text-slate-800 mb-1.5">
                      السياق السريري وشكوى المريض:
                    </label>
                    <input
                      type="text"
                      value={clinicalContext}
                      onChange={(e) => setClinicalContext(e.target.value)}
                      placeholder="مثال: ألم في الصدر مع كحة وارتفاع حرارة..."
                      className="w-full rounded-xl bg-slate-50 border-2 border-slate-300 p-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white transition-all shadow-inner"
                    />
                  </div>

                  <button
                    onClick={handleAnalyzeImage}
                    disabled={isAnalyzingImage}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white font-black text-sm shadow-md shadow-teal-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

              {/* Imaging Result */}
              <div className="lg:col-span-7 space-y-6">
                {imagingResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">نوع الفحص والمنطقة التشريحية</span>
                        <h2 className="text-xl font-black text-slate-900">
                          {imagingResult.modality} — {imagingResult.anatomical_region}
                        </h2>
                      </div>
                      <span className="px-3.5 py-1.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-black">
                        Quality: {imagingResult.quality_assessment}
                      </span>
                    </div>

                    <div className="p-5 rounded-2xl bg-teal-50/80 border border-teal-200">
                      <h4 className="text-xs font-black text-teal-800 uppercase mb-1.5">الانطباع التشخيصي (Diagnostic Impression):</h4>
                      <p className="text-sm font-black text-slate-900 leading-relaxed">
                        {imagingResult.impression}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-slate-500 uppercase mb-3">الملاحظات التشريحية المنظمة (Findings):</h4>
                      <div className="space-y-2.5">
                        {imagingResult.findings?.map((f, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${f.is_abnormal ? "bg-rose-500" : "bg-emerald-500"}`} />
                            <div>
                              <strong className="text-slate-900 font-black">{f.structure}:</strong>{" "}
                              <span className="text-slate-700 font-medium">{f.observation}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {imagingResult.recommendations?.length > 0 && (
                      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 font-bold">
                        <h4 className="font-black mb-1.5 text-sky-900">التوصيات السريرية والمتابعة:</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {imagingResult.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-300 text-center shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4 text-teal-600">
                      <Eye className="w-8 h-8" />
                    </div>
                    <h3 className="font-black text-lg text-slate-900 mb-1">محلل الأشعة والتحاليل بالرؤية الحاسوبية</h3>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md leading-relaxed">
                      ارفع صورة الفحص من اليسار واضغط على فحص الأشعة لعرض مسودة التقرير الإشعاعي والملاحظات هنا.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GUIDELINES */}
          {activeTab === "guidelines" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md">
                <h3 className="font-black text-base text-slate-900 mb-2 flex items-center gap-2">
                  <Search className="w-5 h-5 text-teal-600" />
                  البحث في البروتوكولات العلاجية المبنية على الدليل (Evidence-Based Guidelines)
                </h3>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  ابحث عن أي تشخيص (مثل: Hypertension, Diabetes, Sinusitis, Asthma) للاطلاع على أدوية الخط الأول والتوصيات.
                </p>

                <div className="flex gap-2.5">
                  <input
                    type="text"
                    value={guidelineSearch}
                    onChange={(e) => setGuidelineSearch(e.target.value)}
                    placeholder="اكتب اسم المرض أو التشخيص..."
                    className="flex-1 rounded-2xl bg-slate-50 border-2 border-slate-300 p-3.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white shadow-inner transition-all"
                  />
                  <button
                    onClick={handleSearchGuidelines}
                    disabled={isLoadingGuideline}
                    className="px-7 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md shadow-teal-600/25 transition-all flex items-center gap-2"
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
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4"
                >
                  <h2 className="text-xl font-black text-teal-800">{guidelineResult.condition}</h2>

                  {guidelineResult.first_line_therapy && (
                    <div>
                      <h4 className="text-xs font-black text-slate-500 uppercase mb-2.5">أدوية الخط الأول (First-Line Therapy):</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {guidelineResult.first_line_therapy.map((item: any, i: number) => (
                          <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                            <strong className="text-slate-900 block mb-1 font-black text-sm">{item.class}</strong>
                            <span className="text-slate-600 font-bold">{item.examples?.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {guidelineResult.lifestyle_modifications && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-950 font-bold">
                      <strong className="text-teal-800 block mb-1 font-black">تعديل نمط الحياة (Lifestyle Modifications):</strong>
                      {guidelineResult.lifestyle_modifications}
                    </div>
                  )}

                  {guidelineResult.red_flags && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 font-bold">
                      <strong className="text-rose-700 block mb-1 font-black">علامات الخطر الحرجة (Red Flags):</strong>
                      {guidelineResult.red_flags}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
