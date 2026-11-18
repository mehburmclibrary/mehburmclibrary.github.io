import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, type AuthApi, type SessionUser } from "../lib/auth";
import { setLang } from "../lib/i18n";
import { initAccount } from "./account";
import { flush } from "./test-helpers";

const html = readFileSync(resolve(import.meta.dirname, "../../account/index.html"), "utf8");

function mount(search = "") {
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, "");
  history.replaceState(null, "", `/account/${search}`);
}

/** Sahte sunucu: varsayılan olarak oturum yok, her işlem başarılı. */
function fakeApi(overrides: Partial<AuthApi> = {}) {
  let user: SessionUser | null = null;
  const api: AuthApi = {
    currentUser: vi.fn(async () => user),
    signIn: vi.fn(async (email: string) => {
      user = { email };
    }),
    signUp: vi.fn(async () => "code" as const),
    verifySignup: vi.fn(async (email: string) => {
      user = { email };
    }),
    resendSignup: vi.fn(async () => undefined),
    requestReset: vi.fn(async () => undefined),
    resetPassword: vi.fn(async (email: string) => {
      user = { email };
    }),
    google: vi.fn(async () => undefined),
    signOut: vi.fn(async () => {
      user = null;
    }),
    account: vi.fn(async () => ({ rank: 0, ban: null })),
    names: vi.fn(async () => ["Mehbur07"]),
    claimName: vi.fn(async () => undefined),
    ...overrides,
  };
  return { api, signedIn: (email = "ali@example.com") => (user = { email }) };
}

const box = () => document.querySelector<HTMLElement>("[data-account]")!;
const heading = () => box().querySelector("h1")!.textContent;
const alertText = () => box().querySelector('[role="alert"]')?.textContent ?? "";

function type(label: string, value: string) {
  const input = [...box().querySelectorAll<HTMLInputElement>("input")].find(
    (i) => box().querySelector(`label[for="${i.id}"]`)?.textContent === label,
  )!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function click(text: string) {
  const btn = [...box().querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!btn) throw new Error(`no button "${text}"`);
  btn.click();
}

function submit() {
  box().querySelector<HTMLFormElement>("form")!.requestSubmit();
}

describe("hesap sayfası", () => {
  beforeEach(() => {
    mount();
    setLang("en", false);
  });

  it("oturum yoksa giriş formunu gösterir; ?mode=signup kayıt formunu açar", async () => {
    initAccount(document, fakeApi().api);
    await flush();
    expect(heading()).toBe("Sign in");
    expect(document.title).toBe("Sign in · MehburMC Library");

    mount("?mode=signup");
    initAccount(document, fakeApi().api);
    await flush();
    expect(heading()).toBe("Sign up");
  });

  it("giriş yapınca hesabı, hesap adlarını gösterir ve menüyü günceller", async () => {
    const { api } = fakeApi();
    const onAuthChange = vi.fn();
    initAccount(document, api, { onAuthChange });
    await flush();
    type("Email", "  Ali@Example.com ");
    type("Password", "hunter2hunter2");
    submit();
    await flush();
    expect(api.signIn).toHaveBeenCalledWith("ali@example.com", "hunter2hunter2");
    expect(heading()).toBe("My account");
    expect(box().textContent).toContain("ali@example.com");
    expect(box().querySelector(".name-list")!.textContent).toBe("Mehbur07");
    expect(onAuthChange).toHaveBeenCalled();
  });

  it("yanlış şifrede hata gösterir, yazılan e-posta kaybolmaz", async () => {
    const { api } = fakeApi({
      signIn: vi.fn(async () => Promise.reject(new AuthError("invalidCredentials"))),
    });
    initAccount(document, api);
    await flush();
    type("Email", "ali@example.com");
    type("Password", "yanlis-sifre");
    submit();
    await flush();
    expect(alertText()).toContain("Wrong email or password");
    expect(box().querySelector<HTMLInputElement>("#a-email")!.value).toBe("ali@example.com");
    expect(heading()).toBe("Sign in");
  });

  it("form, sunucuya gitmeden önce hatalı girişleri yakalar", async () => {
    const { api } = fakeApi();
    initAccount(document, api);
    await flush();
    click("Sign up");
    await flush();
    type("Email", "ali@");
    submit();
    expect(alertText()).toContain("valid email");
    type("Email", "ali@example.com");
    type("Password", "kısa");
    submit();
    expect(alertText()).toContain("at least 8");
    type("Password", "uzunbirsifre1");
    type("Password (again)", "baskabirsifre");
    submit();
    expect(alertText()).toContain("don't match");
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it("kayıt → e-posta kodu → hesap", async () => {
    const { api } = fakeApi();
    initAccount(document, api);
    await flush();
    click("Sign up");
    await flush();
    type("Email", "yeni@example.com");
    type("Password", "uzunbirsifre1");
    type("Password (again)", "uzunbirsifre1");
    submit();
    await flush();
    expect(api.signUp).toHaveBeenCalledWith("yeni@example.com", "uzunbirsifre1");
    expect(heading()).toBe("Confirm your email");
    expect(box().textContent).toContain("yeni@example.com");
    expect(box().querySelector('[role="status"]')!.textContent).toContain("code was sent");
    // Tekrar gönder düğmesi bekleme süresinde kapalı
    expect(box().querySelector<HTMLButtonElement>("[data-resend]")!.disabled).toBe(true);
    type("Code", "12345");
    submit();
    expect(alertText()).toContain("6-digit code");
    type("Code", "123 456");
    submit();
    await flush();
    expect(api.verifySignup).toHaveBeenCalledWith("yeni@example.com", "123456");
    expect(heading()).toBe("My account");
  });

  it("onaylanmamış hesapla girişte yeni kod gönderip kod ekranına geçer", async () => {
    const { api } = fakeApi({
      signIn: vi.fn(async () => Promise.reject(new AuthError("emailNotConfirmed"))),
    });
    initAccount(document, api);
    await flush();
    type("Email", "ali@example.com");
    type("Password", "uzunbirsifre1");
    submit();
    await flush();
    expect(api.resendSignup).toHaveBeenCalledWith("ali@example.com");
    expect(heading()).toBe("Confirm your email");
  });

  it("şifremi unuttum → kod + yeni şifre → hesap", async () => {
    const { api } = fakeApi();
    initAccount(document, api);
    await flush();
    click("Forgot password");
    await flush();
    type("Email", "ali@example.com");
    submit();
    await flush();
    expect(api.requestReset).toHaveBeenCalledWith("ali@example.com");
    expect(heading()).toBe("New password");
    type("Code", "654321");
    type("New password", "yenisifre123");
    type("Password (again)", "yenisifre123");
    submit();
    await flush();
    expect(api.resetPassword).toHaveBeenCalledWith("ali@example.com", "654321", "yenisifre123");
    expect(heading()).toBe("My account");
  });

  it("Google düğmesi Google'a yönlendirmeyi başlatır; dönüşte hata varsa söyler", async () => {
    const { api } = fakeApi();
    initAccount(document, api);
    await flush();
    click("Continue with Google");
    await flush();
    expect(api.google).toHaveBeenCalled();

    mount("?error=access_denied&error_description=cancelled");
    initAccount(document, fakeApi().api);
    await flush();
    expect(alertText()).toContain("Google didn't finish");
  });

  it("banlı hesaba ban bilgisini gösterir", async () => {
    const { api, signedIn } = fakeApi({
      account: vi.fn(async () => ({ rank: 0, ban: { until: null, reason: "hile" } })),
    });
    signedIn();
    initAccount(document, api);
    await flush();
    const ban = box().querySelector(".notice-ban")!;
    expect(ban.textContent).toContain("Your account is banned");
    expect(ban.textContent).toContain("permanent");
    expect(ban.textContent).toContain("Reason: hile");
  });

  it("yönetici rozetini gösterir", async () => {
    const { api, signedIn } = fakeApi({ account: vi.fn(async () => ({ rank: 1, ban: null })) });
    signedIn();
    initAccount(document, api);
    await flush();
    expect(box().querySelector(".rank-badge")!.textContent).toBe("Founder");
  });

  it("hesap adı ekler; geçersiz ya da alınmış adda hata verir", async () => {
    let names = ["Mehbur07"];
    const { api, signedIn } = fakeApi({
      names: vi.fn(async () => names),
      claimName: vi.fn(async (name: string) => {
        if (name === "Notch") throw new AuthError("nameTaken");
        names = [...names, name];
      }),
    });
    signedIn();
    initAccount(document, api);
    await flush();
    type("New account name", "a b");
    box().querySelector<HTMLFormElement>(".name-form")!.requestSubmit();
    expect(alertText()).toContain("3–16 characters");
    expect(api.claimName).not.toHaveBeenCalled();

    type("New account name", "Notch");
    box().querySelector<HTMLFormElement>(".name-form")!.requestSubmit();
    await flush();
    expect(alertText()).toContain("belongs to someone else");

    type("New account name", "Yeni_Ad");
    box().querySelector<HTMLFormElement>(".name-form")!.requestSubmit();
    await flush();
    expect(box().querySelector(".name-list")!.textContent).toBe("Mehbur07Yeni_Ad");
    expect(box().querySelector<HTMLInputElement>("#a-name")!.value).toBe("");
  });

  it("sunucuda ad listesi fonksiyonu yoksa bunu söyler, ekleme formunu gizler", async () => {
    const { api, signedIn } = fakeApi({
      names: vi.fn(async () => Promise.reject(new AuthError("serverNotReady"))),
    });
    signedIn();
    initAccount(document, api);
    await flush();
    expect(box().textContent).toContain("can't be shown on this site yet");
    expect(box().querySelector(".name-form")).toBeNull();
  });

  it("çıkış yapınca giriş formuna döner", async () => {
    const { api, signedIn } = fakeApi();
    signedIn();
    const onAuthChange = vi.fn();
    initAccount(document, api, { onAuthChange });
    await flush();
    click("Sign out");
    await flush();
    expect(api.signOut).toHaveBeenCalled();
    expect(heading()).toBe("Sign in");
    expect(onAuthChange).toHaveBeenCalledTimes(2);
  });

  it("kullanıcı metinleri HTML olarak çalışmaz", async () => {
    const evil = '<img src=x onerror="window.hacked=1">';
    const { api, signedIn } = fakeApi({
      names: vi.fn(async () => [evil]),
      account: vi.fn(async () => ({ rank: 0, ban: { until: null, reason: evil } })),
    });
    signedIn(evil);
    initAccount(document, api);
    await flush();
    expect(box().querySelector("img")).toBeNull();
    expect(box().textContent).toContain(evil);
  });
});
