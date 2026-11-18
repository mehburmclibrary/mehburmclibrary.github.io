// Türkçe / İngilizce dil desteği.
// HTML'de çevrilecek yazılar data-i18n="anahtar" ile işaretlenir; özellikler (ör. aria-label)
// için data-i18n-attr="özellik:anahtar;özellik2:anahtar2" kullanılır.
// Çeviriler textContent ile yazılır (HTML olarak değil), böylece metne kod sızamaz.
import { en } from "../i18n/en";
import { tr, type MessageKey } from "../i18n/tr";
import { readPref, writePref } from "./storage";

export type Lang = "tr" | "en";

export const LANG_KEY = "mmclib.lang";

const dictionaries: Record<Lang, Record<MessageKey, string>> = { tr, en };

let current: Lang = "tr";

/** Kayıtlı tercih → tarayıcı dilleri arasında Türkçe varsa "tr" → yoksa "en". */
export function detectLang(stored: string | null, browserLangs: readonly string[]): Lang {
  if (stored === "tr" || stored === "en") return stored;
  return browserLangs.some((l) => l.toLowerCase().startsWith("tr")) ? "tr" : "en";
}

export function currentLang(): Lang {
  return current;
}

export function t(key: MessageKey): string {
  return dictionaries[current][key];
}

/** Değişkenli metin: "{n} içerik" gibi metinlerde {ad} yerine verilen değer yazılır. */
export function tf(key: MessageKey, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Tarih/sayı biçimleri için dilin bölge kodu. */
export function locale(): string {
  return current === "tr" ? "tr-TR" : "en-GB";
}

function isKey(key: string): key is MessageKey {
  return key in tr;
}

/** Verilen alandaki (varsayılan: tüm sayfa) işaretli yazıları seçili dile çevirir. */
export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n ?? "";
    if (isKey(key)) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-attr]").forEach((el) => {
    for (const pair of (el.dataset.i18nAttr ?? "").split(";")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key && isKey(key)) el.setAttribute(attr, t(key));
    }
  });
}

const listeners = new Set<(lang: Lang) => void>();

/** Dil değişince haber almak için (ör. JavaScript ile çizilen içerikleri yenilemek). */
export function onLangChange(fn: (lang: Lang) => void): void {
  listeners.add(fn);
}

export function setLang(lang: Lang, remember = true): void {
  current = lang;
  if (remember) writePref(LANG_KEY, lang);
  document.documentElement.lang = lang;
  applyTranslations();
  listeners.forEach((fn) => fn(lang));
}

export function initI18n(): void {
  const browserLangs = navigator.languages?.length ? navigator.languages : [navigator.language];
  setLang(detectLang(readPref(LANG_KEY), browserLangs), false);
}
