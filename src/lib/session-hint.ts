// Üst menüdeki "Giriş yap / Hesabım" bağlantısı için oturum ipucu. Supabase kütüphanesini her
// sayfada yüklememek için oturumun tarayıcıda kayıtlı olup olmadığına doğrudan bakılır.
// Bu yalnızca bir görünüm ipucudur; asıl kontrolü hesap sayfası sunucuya sorarak yapar.

/** Oturum değişince (giriş / çıkış) sayfa içinde yayılan olay. */
export const AUTH_EVENT = "mmclib:auth";

export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** Supabase'in oturumu sakladığı anahtar: sb-<proje>-auth-token */
export function sessionStorageKey(url = import.meta.env.VITE_SUPABASE_URL ?? ""): string | null {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1];
  return ref ? `sb-${ref}-auth-token` : null;
}

/** Tarayıcıda (anonim olmayan) bir oturum kayıtlı mı? */
export function hasStoredSession(
  storage: Pick<Storage, "getItem"> | null = safeLocalStorage(),
): boolean {
  const key = sessionStorageKey();
  if (!key || !storage) return false;
  try {
    const raw = storage.getItem(key);
    if (!raw) return false;
    const session = JSON.parse(raw) as { user?: { is_anonymous?: boolean } } | null;
    return Boolean(session?.user) && session?.user?.is_anonymous !== true;
  } catch {
    return false;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
