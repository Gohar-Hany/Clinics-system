const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** Local YYYY-MM-DD (not UTC — toISOString would shift the day near midnight). */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-10-20" → "الثلاثاء 20 أكتوبر" */
export function formatDayLong(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "2026-10-20" → "20/10" */
export function formatDayShort(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function weekdayOf(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()];
}

/** "14:30" → "2:30 م" */
export function formatTime(hhmm: string, long = false): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h < 12 ? (long ? "صباحاً" : "ص") : long ? "مساءً" : "م";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatWait(minutes: number): string {
  if (minutes <= 0) return "دلوقتي";
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} س ${m} د` : `${h} ساعة`;
}

/** Minutes elapsed since an ISO timestamp (clinic-local, naive). */
export function minutesSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

export function timeAgo(iso: string): string {
  const mins = minutesSince(iso);
  if (mins === null) return "";
  if (mins < 1) return "دلوقتي";
  if (mins < 60) return `من ${mins} د`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `من ${hours} س`;
  return `من ${Math.round(hours / 24)} يوم`;
}

export function isValidEgyptianMobile(phone: string): boolean {
  return /^01[0125]\d{8}$/.test(phone.trim());
}

/** Convert Arabic-Indic digits so "٠١٠..." works in phone inputs. */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
