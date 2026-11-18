// Tarayıcı hafızası (localStorage) için güvenli okuma/yazma.
// Gizli sekmede ya da site verileri engellendiğinde localStorage hata fırlatabilir;
// bu durumda site yine çalışmalı, sadece tercih hatırlanmaz.

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Kaydedilemedi: tercih sadece bu sayfa açıkken geçerli olur.
  }
}
