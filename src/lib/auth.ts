// Hesap sistemi: tipler ve sunucuya bağlı olmayan (saf) yardımcılar.
// Kurallar MehburMC Launcher ile aynıdır (crates/launcher-core/src/friends/account.rs):
// şifre en az 8 karakter / en fazla 72 bayt, e-posta onayı 6 haneli kodla.

export const MIN_PASSWORD = 8;
/** Supabase şifreleri bcrypt ile saklar; bcrypt yalnızca ilk 72 baytı kullanır. */
export const MAX_PASSWORD_BYTES = 72;
/** Hesap (oyuncu) adı: launcher'daki claim_name kuralı. */
export const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
/** Kodu tekrar göndermeden önce beklenecek süre (saniye). */
export const RESEND_SECONDS = 60;

export type AuthErrorCode =
  | "invalidCredentials"
  | "emailTaken"
  | "codeInvalid"
  | "weakPassword"
  | "emailInvalid"
  | "rateLimited"
  | "emailNotConfirmed"
  | "signupDisabled"
  | "samePassword"
  | "sessionExpired"
  | "emailSendFailed"
  | "googleFailed"
  | "nameInvalid"
  | "nameTaken"
  | "nameLimit"
  | "serverNotReady"
  | "network"
  | "unknown";

/** Arayüzde gösterilecek hata kodunu taşıyan hata. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  name?: unknown;
}

/** Supabase Auth / PostgREST hatasını arayüz koduna çevirir (launcher'daki eşlemeyle aynı). */
export function authErrorCode(e: unknown): AuthErrorCode {
  if (e instanceof AuthError) return e.code;
  const err = (typeof e === "object" && e !== null ? e : {}) as ErrorLike;
  const code = typeof err.code === "string" ? err.code : "";
  const message = typeof err.message === "string" ? err.message : String(e ?? "");
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_exists":
    case "user_already_exists":
    case "identity_already_exists":
      return "emailTaken";
    case "otp_expired":
    case "otp_disabled":
    case "bad_code_verifier":
    case "flow_state_expired":
    case "flow_state_not_found":
      return "codeInvalid";
    case "weak_password":
      return "weakPassword";
    case "email_address_invalid":
    case "email_address_not_authorized":
    case "validation_failed":
      return "emailInvalid";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signupDisabled";
    case "same_password":
      return "samePassword";
    case "refresh_token_not_found":
    case "refresh_token_already_used":
    case "session_not_found":
    case "user_not_found":
      return "sessionExpired";
    case "PGRST202": // sunucuda fonksiyon yok: SQL dosyası henüz çalıştırılmamış
      return "serverNotReady";
  }
  if (message === "account.nameInvalid") return "nameInvalid";
  if (message === "account.nameTaken") return "nameTaken";
  if (message === "account.nameLimit") return "nameLimit";
  if (message.includes("Invalid Refresh Token")) return "sessionExpired";
  if (message.includes("Token has expired or is invalid")) return "codeInvalid";
  if (message.startsWith("Error sending")) return "emailSendFailed";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "network";
  }
  return "unknown";
}

/** Kırpılmış, küçük harfli e-posta; biçimi bozuksa null. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

/** Şifre kurala uymuyorsa sorunun adı, uyuyorsa null. */
export function passwordProblem(password: string): "short" | "long" | null {
  if ([...password].length < MIN_PASSWORD) return "short";
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "long";
  return null;
}

/** E-postadaki kod: boşluk ve tireler atılır, 6–10 rakam olmalı. */
export function cleanCode(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, "");
  return /^\d{6,10}$/.test(code) ? code : null;
}

export interface BanInfo {
  /** null = süresiz */
  until: string | null;
  reason: string;
}

export interface AccountInfo {
  /** 0 = yok, 1 = kurucu, 2 = yönetici */
  rank: number;
  ban: BanInfo | null;
}

export interface SessionUser {
  email: string;
}

/** Hesap sayfasının kullandığı işlemler (gerçeği auth-api.ts'de, testlerde sahtesi). */
export interface AuthApi {
  /** Geçerli oturum (Google'dan dönüşte adresteki kod burada oturuma çevrilir). */
  currentUser(): Promise<SessionUser | null>;
  signIn(email: string, password: string): Promise<void>;
  /** "code": e-postaya kod gitti; "signedIn": onay gerekmedi, oturum açıldı. */
  signUp(email: string, password: string): Promise<"code" | "signedIn">;
  verifySignup(email: string, code: string): Promise<void>;
  resendSignup(email: string): Promise<void>;
  requestReset(email: string): Promise<void>;
  /** Şifre sıfırlama kodunu doğrular ve yeni şifreyi kaydeder. */
  resetPassword(email: string, code: string, password: string): Promise<void>;
  /** Google'a yönlendirir (sayfa değişir). */
  google(): Promise<void>;
  signOut(): Promise<void>;
  account(): Promise<AccountInfo>;
  names(): Promise<string[]>;
  claimName(name: string): Promise<void>;
}
