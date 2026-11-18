// Hesap sayfasının (/account/) davranışı. Görünümler: giriş, kayıt, e-posta kodu, şifremi
// unuttum, yeni şifre ve "Hesabım" (e-posta, ban durumu, hesap adları, çıkış).
// İşlemler parametre olarak verilir (gerçeği auth-api.ts, testlerde sahtesi).
import {
  NAME_RE,
  RESEND_SECONDS,
  authErrorCode,
  cleanCode,
  normalizeEmail,
  passwordProblem,
  type AccountInfo,
  type AuthApi,
  type AuthErrorCode,
  type SessionUser,
} from "../lib/auth";
import { h, icon, type Child } from "../lib/dom";
import { formatDateTime } from "../lib/format";
import { onLangChange, t, tf } from "../lib/i18n";
import type { MessageKey } from "../i18n/tr";

/** Formda yerel olarak yakalanan hatalar da aynı mesaj sisteminden geçer. */
export type FormError =
  AuthErrorCode | "passwordShort" | "passwordLong" | "passwordMismatch" | "codeFormat";

type View =
  | { name: "loading" }
  | { name: "signin" }
  | { name: "signup" }
  | { name: "verify"; email: string }
  | { name: "forgot" }
  | { name: "reset"; email: string }
  | { name: "account" };

export interface AccountOptions {
  /** Oturum değişince (giriş / çıkış) çağrılır; üst menüdeki bağlantı güncellenir. */
  onAuthChange?: () => void;
  now?: () => number;
}

const GOOGLE_ICON = `<svg class="icon google-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" stroke="none" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8.1z"/><path fill="#34A853" stroke="none" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23z"/><path fill="#FBBC05" stroke="none" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.6-2.8z"/><path fill="#EA4335" stroke="none" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z"/></svg>`;

export function initAccount(root: ParentNode, api: AuthApi, opts: AccountOptions = {}): void {
  const box = root.querySelector<HTMLElement>("[data-account]");
  if (!box) return;
  const now = opts.now ?? (() => Date.now());

  let view: View = { name: "loading" };
  let error: FormError | null = null;
  let info: MessageKey | null = null;
  let busy = false;
  let user: SessionUser | null = null;
  let account: AccountInfo | null = null;
  let names: string[] | null = null;
  let namesError: FormError | null = null;
  let nameError: FormError | null = null;
  let resendAt = 0; // bu zamandan önce kod tekrar gönderilemez
  let resendTimer: ReturnType<typeof setInterval> | undefined;
  /** Görünüm değişince başlığa, aynı görünümde yeniden çizimde aynı alana odaklanılır. */
  let focusHeading = false;
  // Yazılanlar yeniden çizimde kaybolmasın
  const draft = { email: "", password: "", password2: "", code: "", name: "" };

  // ---------------------------------------------------------------- yardımcılar

  function go(next: View, keepError = false) {
    view = next;
    if (!keepError) error = null;
    info = null;
    focusHeading = true;
    draft.password = "";
    draft.password2 = "";
    draft.code = "";
    render();
  }

  async function run(work: () => Promise<void>) {
    if (busy) return;
    busy = true;
    error = null;
    info = null;
    render();
    try {
      await work();
    } catch (e) {
      error = authErrorCode(e);
    }
    busy = false;
    render();
  }

  function startCooldown() {
    resendAt = now() + RESEND_SECONDS * 1000;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      const btn = box!.querySelector<HTMLButtonElement>("[data-resend]");
      if (btn) updateResend(btn);
      if (now() >= resendAt) clearInterval(resendTimer);
    }, 1000);
  }

  function updateResend(btn: HTMLButtonElement) {
    const left = Math.ceil((resendAt - now()) / 1000);
    btn.disabled = busy || left > 0;
    btn.textContent = left > 0 ? tf("auth.resendIn", { s: left }) : t("auth.resend");
  }

  async function enterAccount() {
    user = await api.currentUser();
    if (!user) {
      go({ name: "signin" });
      return;
    }
    opts.onAuthChange?.();
    // Hesap adresinde kalan ?mode= ya da Google dönüş kodu temizlensin
    history.replaceState(null, "", location.pathname);
    account = null;
    names = null;
    namesError = null;
    go({ name: "account" });
    const [acc, list] = await Promise.allSettled([api.account(), api.names()]);
    account = acc.status === "fulfilled" ? acc.value : { rank: 0, ban: null };
    if (list.status === "fulfilled") names = list.value;
    else namesError = authErrorCode(list.reason);
    render();
  }

  // ---------------------------------------------------------------- form parçaları

  function field(opts: {
    id: string;
    label: MessageKey;
    type: string;
    key: keyof typeof draft;
    autocomplete: string;
    hint?: string;
    extra?: Record<string, string>;
  }): HTMLDivElement {
    const input = h("input", {
      id: opts.id,
      name: opts.key,
      type: opts.type,
      autocomplete: opts.autocomplete,
      required: true,
      "data-focus": opts.id,
      "aria-describedby": opts.hint ? `${opts.id}-hint` : null,
      ...opts.extra,
    });
    input.value = draft[opts.key];
    input.addEventListener("input", () => (draft[opts.key] = input.value));
    const wrap = h(
      "div",
      { class: "field" },
      h("label", { for: opts.id }, t(opts.label)),
      input,
      opts.hint ? h("p", { class: "field-hint", id: `${opts.id}-hint` }, opts.hint) : null,
    );
    if (opts.type === "password") {
      const toggle = h(
        "button",
        { type: "button", class: "link-btn show-password", "aria-pressed": "false" },
        t("auth.showPassword"),
      );
      toggle.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        toggle.setAttribute("aria-pressed", String(show));
        toggle.textContent = show ? t("auth.hidePassword") : t("auth.showPassword");
      });
      wrap.append(toggle);
    }
    return wrap;
  }

  function messages(): Child[] {
    return [
      error
        ? h(
            "p",
            { class: "form-error", role: "alert" },
            icon("alert", "icon-sm"),
            h("span", {}, t(`auth.error.${error}` as MessageKey)),
          )
        : null,
      info
        ? h(
            "p",
            { class: "form-info", role: "status" },
            icon("check", "icon-sm"),
            h("span", {}, t(info)),
          )
        : null,
    ];
  }

  function submit(label: MessageKey, busyLabel: MessageKey = "auth.working"): HTMLButtonElement {
    const btn = h(
      "button",
      { type: "submit", class: "btn btn-primary btn-block", "data-focus": "submit" },
      busy ? t(busyLabel) : t(label),
    );
    btn.disabled = busy;
    return btn;
  }

  function linkBtn(label: MessageKey, onClick: () => void): HTMLButtonElement {
    const btn = h("button", { type: "button", class: "link-btn", "data-focus": label }, t(label));
    btn.addEventListener("click", onClick);
    return btn;
  }

  function form(onSubmit: () => void, ...children: Child[]): HTMLFormElement {
    const f = h("form", { class: "auth-form", novalidate: true }, ...children);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      onSubmit();
    });
    return f;
  }

  function googleButton(): HTMLElement {
    const btn = h("button", {
      type: "button",
      class: "btn btn-ghost btn-block google-btn",
      "data-focus": "google",
    });
    btn.insertAdjacentHTML("afterbegin", GOOGLE_ICON); // sabit SVG, kullanıcı verisi değil
    btn.append(h("span", {}, t("auth.google")));
    btn.disabled = busy;
    btn.addEventListener("click", () => void run(() => api.google()));
    return h(
      "div",
      { class: "auth-alt" },
      btn,
      h("p", { class: "auth-divider" }, h("span", {}, t("auth.or"))),
    );
  }

  function card(title: MessageKey, lead: string | null, ...children: Child[]): HTMLElement {
    return h(
      "div",
      { class: "card auth-card" },
      h("h1", { class: "page-title auth-title", tabindex: "-1" }, t(title)),
      lead ? h("p", { class: "auth-lead" }, lead) : null,
      ...children,
    );
  }

  // ---------------------------------------------------------------- görünümler

  function signinView(): HTMLElement {
    return card(
      "auth.signinTitle",
      t("auth.signinLead"),
      googleButton(),
      form(
        () => {
          const email = normalizeEmail(draft.email);
          if (!email) return fieldError("emailInvalid");
          if (!draft.password) return fieldError("invalidCredentials");
          void run(async () => {
            try {
              await api.signIn(email, draft.password);
            } catch (e) {
              // Onaylanmamış hesap: yeni kod gönderip kod ekranına geç
              if (authErrorCode(e) === "emailNotConfirmed") {
                await api.resendSignup(email).catch(() => undefined);
                startCooldown();
                go({ name: "verify", email }, false);
                info = "auth.codeSent";
                return;
              }
              throw e;
            }
            await enterAccount();
          });
        },
        ...messages(),
        field({
          id: "a-email",
          label: "auth.email",
          type: "email",
          key: "email",
          autocomplete: "email",
        }),
        field({
          id: "a-password",
          label: "auth.password",
          type: "password",
          key: "password",
          autocomplete: "current-password",
        }),
        submit("auth.signinSubmit"),
      ),
      h(
        "div",
        { class: "auth-links" },
        linkBtn("auth.forgot", () => go({ name: "forgot" })),
        h(
          "p",
          {},
          t("auth.noAccount"),
          " ",
          linkBtn("auth.signupLink", () => go({ name: "signup" })),
        ),
      ),
    );
  }

  function signupView(): HTMLElement {
    return card(
      "auth.signupTitle",
      t("auth.signupLead"),
      googleButton(),
      form(
        () => {
          const email = normalizeEmail(draft.email);
          if (!email) return fieldError("emailInvalid");
          const problem = passwordProblem(draft.password);
          if (problem) return fieldError(problem === "short" ? "passwordShort" : "passwordLong");
          if (draft.password !== draft.password2) return fieldError("passwordMismatch");
          void run(async () => {
            const result = await api.signUp(email, draft.password);
            if (result === "signedIn") return enterAccount();
            startCooldown();
            go({ name: "verify", email });
            info = "auth.codeSent";
          });
        },
        ...messages(),
        field({
          id: "a-email",
          label: "auth.email",
          type: "email",
          key: "email",
          autocomplete: "email",
        }),
        field({
          id: "a-password",
          label: "auth.password",
          type: "password",
          key: "password",
          autocomplete: "new-password",
          hint: t("auth.passwordHint"),
        }),
        field({
          id: "a-password2",
          label: "auth.password2",
          type: "password",
          key: "password2",
          autocomplete: "new-password",
        }),
        submit("auth.signupSubmit"),
      ),
      h(
        "div",
        { class: "auth-links" },
        h(
          "p",
          {},
          t("auth.haveAccount"),
          " ",
          linkBtn("auth.signinLink", () => go({ name: "signin" })),
        ),
      ),
    );
  }

  function codeField(): HTMLDivElement {
    return field({
      id: "a-code",
      label: "auth.code",
      type: "text",
      key: "code",
      autocomplete: "one-time-code",
      extra: { inputmode: "numeric", maxlength: "12", pattern: "[0-9 -]*", spellcheck: "false" },
    });
  }

  function resendButton(send: () => Promise<void>): HTMLButtonElement {
    const btn = h("button", {
      type: "button",
      class: "link-btn",
      "data-resend": true,
      "data-focus": "resend",
    });
    updateResend(btn);
    btn.addEventListener(
      "click",
      () =>
        void run(async () => {
          await send();
          startCooldown();
          info = "auth.codeSent";
        }),
    );
    return btn;
  }

  function verifyView(email: string): HTMLElement {
    return card(
      "auth.verifyTitle",
      tf("auth.verifyLead", { email }),
      form(
        () => {
          const code = cleanCode(draft.code);
          if (!code) return fieldError("codeFormat");
          void run(async () => {
            await api.verifySignup(email, code);
            await enterAccount();
          });
        },
        ...messages(),
        codeField(),
        submit("auth.verifySubmit"),
      ),
      h(
        "div",
        { class: "auth-links" },
        resendButton(() => api.resendSignup(email)),
        linkBtn("auth.otherEmail", () => go({ name: "signup" })),
      ),
    );
  }

  function forgotView(): HTMLElement {
    return card(
      "auth.forgotTitle",
      t("auth.forgotLead"),
      form(
        () => {
          const email = normalizeEmail(draft.email);
          if (!email) return fieldError("emailInvalid");
          void run(async () => {
            await api.requestReset(email);
            startCooldown();
            go({ name: "reset", email });
            info = "auth.codeSent";
          });
        },
        ...messages(),
        field({
          id: "a-email",
          label: "auth.email",
          type: "email",
          key: "email",
          autocomplete: "email",
        }),
        submit("auth.forgotSubmit"),
      ),
      h(
        "div",
        { class: "auth-links" },
        linkBtn("auth.backToSignin", () => go({ name: "signin" })),
      ),
    );
  }

  function resetView(email: string): HTMLElement {
    return card(
      "auth.resetTitle",
      tf("auth.resetLead", { email }),
      form(
        () => {
          const code = cleanCode(draft.code);
          if (!code) return fieldError("codeFormat");
          const problem = passwordProblem(draft.password);
          if (problem) return fieldError(problem === "short" ? "passwordShort" : "passwordLong");
          if (draft.password !== draft.password2) return fieldError("passwordMismatch");
          void run(async () => {
            await api.resetPassword(email, code, draft.password);
            await enterAccount();
          });
        },
        ...messages(),
        codeField(),
        field({
          id: "a-password",
          label: "auth.newPassword",
          type: "password",
          key: "password",
          autocomplete: "new-password",
          hint: t("auth.passwordHint"),
        }),
        field({
          id: "a-password2",
          label: "auth.password2",
          type: "password",
          key: "password2",
          autocomplete: "new-password",
        }),
        submit("auth.resetSubmit"),
      ),
      h(
        "div",
        { class: "auth-links" },
        resendButton(() => api.requestReset(email)),
        linkBtn("auth.backToSignin", () => go({ name: "signin" })),
      ),
    );
  }

  function banBox(): HTMLElement | null {
    const ban = account?.ban;
    if (!ban) return null;
    return h(
      "div",
      { class: "notice-ban", role: "alert" },
      h("h2", {}, icon("alert", "icon-sm"), h("span", {}, t("auth.bannedTitle"))),
      h(
        "p",
        {},
        ban.until
          ? tf("auth.bannedUntil", { date: formatDateTime(ban.until) })
          : t("auth.bannedForever"),
      ),
      ban.reason ? h("p", {}, tf("auth.bannedReason", { reason: ban.reason })) : null,
      h("p", { class: "muted" }, t("auth.bannedHelp")),
    );
  }

  function namesSection(): HTMLElement {
    let body: Child;
    if (namesError)
      body = h(
        "p",
        { class: "muted" },
        t(namesError === "serverNotReady" ? "auth.namesNotReady" : "auth.namesError"),
      );
    else if (names === null) body = h("p", { class: "muted" }, t("library.loading"));
    else if (names.length === 0) body = h("p", { class: "muted" }, t("auth.namesEmpty"));
    else
      body = h(
        "ul",
        { class: "tags name-list" },
        ...names.map((n) => h("li", { class: "tag" }, n)),
      );

    const input = h("input", {
      id: "a-name",
      name: "name",
      type: "text",
      autocomplete: "off",
      spellcheck: "false",
      maxlength: "16",
      required: true,
      "data-focus": "a-name",
      "aria-describedby": "a-name-hint",
    });
    input.value = draft.name;
    input.addEventListener("input", () => (draft.name = input.value));
    const add = h(
      "button",
      { type: "submit", class: "btn btn-ghost btn-sm", "data-focus": "add-name" },
      t("auth.addName"),
    );
    add.disabled = busy;
    const f = h(
      "form",
      { class: "name-form", novalidate: true },
      h("label", { for: "a-name" }, t("auth.newName")),
      h("div", { class: "name-row" }, input, add),
      h("p", { class: "field-hint", id: "a-name-hint" }, t("auth.nameHint")),
      nameError
        ? h("p", { class: "form-error", role: "alert" }, t(`auth.error.${nameError}` as MessageKey))
        : null,
    );
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = draft.name.trim();
      if (!NAME_RE.test(name)) {
        nameError = "nameInvalid";
        render();
        return;
      }
      void (async () => {
        if (busy) return;
        busy = true;
        nameError = null;
        render();
        try {
          await api.claimName(name);
          names = await api.names();
          namesError = null;
          draft.name = "";
        } catch (err) {
          nameError = authErrorCode(err);
        }
        busy = false;
        render();
      })();
    });

    return h(
      "section",
      { class: "account-section", "aria-labelledby": "names-title" },
      h("h2", { id: "names-title" }, t("auth.namesTitle")),
      h("p", { class: "muted" }, t("auth.namesLead")),
      body,
      namesError === "serverNotReady" ? null : f,
    );
  }

  function accountView(): HTMLElement {
    const rank = account?.rank ?? 0;
    const signOut = h(
      "button",
      { type: "button", class: "btn btn-ghost", "data-focus": "signout" },
      t("auth.signOut"),
    );
    signOut.disabled = busy;
    signOut.addEventListener(
      "click",
      () =>
        void run(async () => {
          await api.signOut();
          user = null;
          account = null;
          names = null;
          opts.onAuthChange?.();
          go({ name: "signin" });
        }),
    );
    return card(
      "auth.accountTitle",
      null,
      h(
        "p",
        { class: "account-email" },
        h("span", { class: "muted" }, t("auth.signedInAs"), " "),
        h("strong", { class: "break" }, user?.email ?? ""),
        rank > 0
          ? h(
              "span",
              { class: "kind-badge rank-badge" },
              t(rank === 1 ? "auth.rankFounder" : "auth.rankAdmin"),
            )
          : null,
      ),
      ...messages(),
      banBox(),
      namesSection(),
      h("p", { class: "muted small" }, t("auth.launcherNote")),
      h("div", { class: "account-actions" }, signOut),
    );
  }

  function fieldError(code: FormError) {
    error = code;
    info = null;
    render();
  }

  // ---------------------------------------------------------------- çizim

  function render() {
    box!.setAttribute("aria-busy", String(view.name === "loading"));
    if (view.name === "loading") return;
    const focusKey = document.activeElement?.closest<HTMLElement>("[data-focus]")?.dataset.focus;
    let content: HTMLElement;
    switch (view.name) {
      case "signin":
        content = signinView();
        break;
      case "signup":
        content = signupView();
        break;
      case "verify":
        content = verifyView(view.email);
        break;
      case "forgot":
        content = forgotView();
        break;
      case "reset":
        content = resetView(view.email);
        break;
      case "account":
        content = accountView();
        break;
    }
    box!.replaceChildren(content);
    document.title = tf("meta.accountTitle", { page: t(titleKey()) });
    if (focusHeading) {
      focusHeading = false;
      box!.querySelector<HTMLElement>(".auth-title")?.focus();
    } else if (error) {
      // Hata olan alana odaklan; yoksa hatanın kendisi role=alert ile okunur
      const target =
        error === "codeFormat" || error === "codeInvalid"
          ? "a-code"
          : error.startsWith("password") || error === "weakPassword"
            ? "a-password"
            : error === "emailInvalid" || error === "emailTaken"
              ? "a-email"
              : focusKey;
      if (target) box!.querySelector<HTMLElement>(`[data-focus="${target}"]`)?.focus();
    } else if (focusKey) {
      box!.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus();
    }
  }

  function titleKey(): MessageKey {
    switch (view.name) {
      case "signup":
        return "auth.signupTitle";
      case "verify":
        return "auth.verifyTitle";
      case "forgot":
        return "auth.forgotTitle";
      case "reset":
        return "auth.resetTitle";
      case "account":
        return "auth.accountTitle";
      default:
        return "auth.signinTitle";
    }
  }

  onLangChange(() => render());

  // ---------------------------------------------------------------- başlangıç

  const params = new URLSearchParams(location.search);
  const oauthError = params.get("error_description") ?? params.get("error");
  void (async () => {
    try {
      await enterAccount();
    } catch (e) {
      error = authErrorCode(e);
      go({ name: "signin" }, true);
      return;
    }
    if (!user) {
      if (oauthError) error = "googleFailed";
      go({ name: params.get("mode") === "signup" ? "signup" : "signin" }, Boolean(oauthError));
    }
  })();
}
