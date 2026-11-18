// İçerik sayfasındaki "Şikâyet et" bölümü. Giriş yapmamış kullanıcıya giriş bağlantısı
// gösterilir; kendi içeriğini şikâyet etmeye çalışan kullanıcıya sunucu "olmaz" der.
import type { MessageKey } from "../i18n/tr";
import { h, icon } from "../lib/dom";
import { t } from "../lib/i18n";
import {
  MAX_NOTE_CHARS,
  REPORT_REASONS,
  uploadErrorCode,
  type ReportReason,
  type UploadApi,
  type UploadErrorCode,
} from "../lib/upload";

export interface ReportWidget {
  el: HTMLElement;
  render(): void;
}

export function createReportWidget(
  itemId: number,
  api: Pick<UploadApi, "userId" | "report">,
): ReportWidget {
  const el = h("section", {
    class: "card item-section report-box",
    "aria-labelledby": "report-title",
  });
  let open = false;
  let signedIn: boolean | null = null;
  let busy = false;
  let done = false;
  let error: UploadErrorCode | null = null;
  const draft = { reason: "" as ReportReason | "", note: "" };

  async function toggle() {
    open = !open;
    if (open && signedIn === null) signedIn = Boolean(await api.userId().catch(() => null));
    render();
    el.querySelector<HTMLElement>(
      open ? "#r-reason, .report-signin a" : "[data-report-toggle]",
    )?.focus();
  }

  async function send() {
    if (!draft.reason || busy) return;
    busy = true;
    error = null;
    render();
    try {
      await api.report(itemId, draft.reason, draft.note);
      done = true;
    } catch (e) {
      error = uploadErrorCode(e);
    }
    busy = false;
    render();
    el.querySelector<HTMLElement>("[role=status], [role=alert]")?.focus();
  }

  function render() {
    const toggleBtn = h(
      "button",
      {
        type: "button",
        class: "link-btn report-toggle",
        "aria-expanded": String(open),
        "data-report-toggle": true,
      },
      icon("flag", "icon-sm"),
      h("span", {}, t("report.toggle")),
    );
    toggleBtn.addEventListener("click", () => void toggle());
    const children: Node[] = [
      h("h2", { id: "report-title", class: "sr-only" }, t("report.title")),
      toggleBtn,
    ];
    if (open && done) {
      children.push(
        h(
          "p",
          { class: "form-info", role: "status", tabindex: "-1" },
          icon("check", "icon-sm"),
          h("span", {}, t("report.done")),
        ),
      );
    } else if (open && signedIn === false) {
      children.push(
        h(
          "p",
          { class: "report-signin" },
          t("report.signIn"),
          " ",
          h("a", { href: "/account/" }, t("nav.signIn")),
        ),
      );
    } else if (open && signedIn) {
      const reason = h(
        "select",
        { id: "r-reason", required: true },
        h("option", { value: "" }, t("report.choose")),
        ...REPORT_REASONS.map((r) =>
          h("option", { value: r }, t(`report.reason.${r}` as MessageKey)),
        ),
      );
      reason.value = draft.reason;
      reason.addEventListener("change", () => (draft.reason = reason.value as ReportReason | ""));
      const note = h("textarea", { id: "r-note", rows: "3", maxlength: String(MAX_NOTE_CHARS) });
      note.value = draft.note;
      note.addEventListener("input", () => (draft.note = note.value));
      const submit = h(
        "button",
        { type: "submit", class: "btn btn-ghost btn-sm" },
        busy ? t("auth.working") : t("report.send"),
      );
      submit.disabled = busy;
      const form = h(
        "form",
        { class: "report-form", novalidate: true },
        h(
          "div",
          { class: "field" },
          h("label", { for: "r-reason" }, t("report.reasonLabel")),
          reason,
        ),
        h("div", { class: "field" }, h("label", { for: "r-note" }, t("report.note")), note),
        error
          ? h(
              "p",
              { class: "form-error", role: "alert", tabindex: "-1" },
              t(`upload.error.${error}` as MessageKey),
            )
          : null,
        submit,
      );
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!draft.reason) {
          error = null;
          reason.focus();
          return;
        }
        void send();
      });
      children.push(form);
    }
    el.replaceChildren(...children);
  }

  render();
  return { el, render };
}
