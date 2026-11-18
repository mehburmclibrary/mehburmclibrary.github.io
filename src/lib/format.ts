// Ekranda gösterilen boyut ve tarih biçimleri (seçili dile göre).
import { locale } from "./i18n";

/** 24035 → "23,5 KB" (Türkçe) / "23.5 KB" (İngilizce). 1 KB = 1024 bayt, launcher ile aynı. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  const n = new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value);
  return `${n} ${units[unit]}`;
}

/** "2026-11-03T10:00:00Z" → "3 Kas 2026" / "3 Nov 2026". Geçersizse boş metin. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale(), { dateStyle: "medium" }).format(d);
}

/** Tarih + saat (ör. ban bitişi): "3 Kas 2026 14:30" / "3 Nov 2026, 14:30". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(d);
}
