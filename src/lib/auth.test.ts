import { describe, expect, it } from "vitest";
import { AuthError, authErrorCode, cleanCode, normalizeEmail, passwordProblem } from "./auth";
import { hasStoredSession, sessionStorageKey } from "./session-hint";

describe("authErrorCode", () => {
  it("Supabase hata kodlarını launcher ile aynı şekilde çevirir", () => {
    expect(authErrorCode({ code: "invalid_credentials" })).toBe("invalidCredentials");
    expect(authErrorCode({ code: "user_already_exists" })).toBe("emailTaken");
    expect(authErrorCode({ code: "otp_expired" })).toBe("codeInvalid");
    expect(authErrorCode({ code: "over_email_send_rate_limit" })).toBe("rateLimited");
    expect(authErrorCode({ code: "email_not_confirmed" })).toBe("emailNotConfirmed");
    expect(authErrorCode({ code: "same_password" })).toBe("samePassword");
    expect(authErrorCode({ code: "PGRST202" })).toBe("serverNotReady");
  });

  it("mesajdan anlaşılan durumları da tanır", () => {
    expect(authErrorCode({ message: "account.nameTaken" })).toBe("nameTaken");
    expect(authErrorCode({ message: "Token has expired or is invalid" })).toBe("codeInvalid");
    expect(authErrorCode({ message: "Error sending confirmation email" })).toBe("emailSendFailed");
    expect(authErrorCode(new TypeError("Failed to fetch"))).toBe("network");
    expect(authErrorCode(new AuthError("nameLimit"))).toBe("nameLimit");
    expect(authErrorCode("tuhaf")).toBe("unknown");
  });
});

describe("form kontrolleri", () => {
  it("e-postayı kırpar ve küçültür", () => {
    expect(normalizeEmail("  Ali@Example.COM ")).toBe("ali@example.com");
    expect(normalizeEmail("ali@")).toBeNull();
    expect(normalizeEmail("ali example.com")).toBeNull();
  });

  it("şifre en az 8 karakter, en fazla 72 bayt", () => {
    expect(passwordProblem("1234567")).toBe("short");
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("ş".repeat(36))).toBeNull(); // 72 bayt
    expect(passwordProblem("ş".repeat(37))).toBe("long"); // 74 bayt
  });

  it("kodu temizler", () => {
    expect(cleanCode(" 123 456 ")).toBe("123456");
    expect(cleanCode("123-456")).toBe("123456");
    expect(cleanCode("12345")).toBeNull();
    expect(cleanCode("12a456")).toBeNull();
  });
});

describe("oturum ipucu", () => {
  const key = sessionStorageKey("https://abcdef.supabase.co")!;
  const storage = (value: string | null) => ({
    getItem: (k: string) => (k === sessionStorageKey() ? value : null),
  });

  it("Supabase'in anahtar adını kurar", () => {
    expect(key).toBe("sb-abcdef-auth-token");
    expect(sessionStorageKey("https://example.com")).toBeNull();
  });

  it("anonim olmayan oturumu tanır, bozuk veriyi yok sayar", () => {
    // Testlerde .env yoksa anahtar kurulamaz ve her zaman false döner
    const ready = sessionStorageKey() !== null;
    expect(hasStoredSession(storage(JSON.stringify({ user: { id: "x" } })))).toBe(ready);
    expect(hasStoredSession(storage(JSON.stringify({ user: { is_anonymous: true } })))).toBe(false);
    expect(hasStoredSession(storage("{bozuk"))).toBe(false);
    expect(hasStoredSession(storage(null))).toBe(false);
    expect(hasStoredSession(null)).toBe(false);
  });
});
