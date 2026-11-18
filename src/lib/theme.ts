// Açık/koyu tema.
// İlk açılışta bilgisayarın teması kullanılır; kullanıcı düğmeye basınca seçimi hatırlanır.
// Not: Sayfa ilk çizilmeden önce temayı ayarlayan küçük bir betik her HTML dosyasının
// <head> kısmında da var (beyaz/siyah "parlama" olmasın diye). Anahtar adı aynı olmalı.
import { readPref, writePref } from "./storage";

export type Theme = "light" | "dark";

export const THEME_KEY = "mmclib.theme";

/** Kayıtlı tercih geçerliyse onu, değilse sistemin temasını döndürür. */
export function resolveTheme(stored: string | null, systemPrefersLight: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersLight ? "light" : "dark";
}

function systemPrefersLight(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const listeners = new Set<(theme: Theme) => void>();

/** Tema değişince haber almak için (ör. düğmenin ikonunu güncellemek). */
export function onThemeChange(fn: (theme: Theme) => void): void {
  listeners.add(fn);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  // Mobil tarayıcıların adres çubuğu rengi de temaya uysun
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "light" ? "#f4f8fa" : "#05070a";
  listeners.forEach((fn) => fn(theme));
}

/** Kullanıcı düğmeye bastığında: temayı değiştirir ve seçimi kaydeder. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "light" ? "dark" : "light";
  writePref(THEME_KEY, next);
  applyTheme(next);
  return next;
}

export function initTheme(): void {
  applyTheme(resolveTheme(readPref(THEME_KEY), systemPrefersLight()));
  // Kullanıcı henüz seçim yapmadıysa bilgisayarın teması değiştiğinde site de değişir
  window.matchMedia?.("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    if (readPref(THEME_KEY) === null) applyTheme(e.matches ? "light" : "dark");
  });
}
