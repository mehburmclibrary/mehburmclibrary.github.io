// Yükleme sayfasının (/upload/) davranışı: tür seçimi → dosya (sürükle-bırak) → otomatik
// kontrol raporu → bilgiler → gönderme. Yükleme admin onayına "siteden" işaretiyle düşer.
// İşlemler parametre olarak verilir (gerçekleri auth-api / upload-api / scan, testlerde sahteleri).
import { kindBadge } from "../components/item-card";
import type { MessageKey } from "../i18n/tr";
import { authErrorCode, type AccountInfo } from "../lib/auth";
import { h, icon, type Child } from "../lib/dom";
import { formatBytes } from "../lib/format";
import { hasMessage, onLangChange, t, tf } from "../lib/i18n";
import { loaderName } from "../lib/library";
import {
  kindExt,
  maxBytes,
  type Finding,
  type LibraryKind,
  type ScanReport,
} from "../lib/scan/scan";
import {
  MAX_DESCRIPTION_CHARS,
  MAX_NAME_CHARS,
  prepareSubmission,
  uploadErrorCode,
  type UploadApi,
  type UploadErrorCode,
} from "../lib/upload";

export interface UploadDeps {
  uploads: Pick<UploadApi, "userId" | "submit">;
  account(): Promise<AccountInfo>;
  names(): Promise<string[]>;
  scan(bytes: Uint8Array, kind: LibraryKind): Promise<ScanReport>;
}

const KINDS: LibraryKind[] = ["mod", "modpack", "resourcepack", "shader"];
const LOADER_IDS: Record<string, string> = { neoForge: "neoforge" };

type Gate = "loading" | "signedOut" | "banned" | "noNames" | "namesNotReady" | "error" | "ready";

/** Bulgunun açıklaması: önce türe özel metin, yoksa genel metin. */
export function findingText(kind: LibraryKind, code: string): string {
  const specific = `finding.${kind}.${code}`;
  if (hasMessage(specific)) return t(specific);
  const general = `finding.${code}`;
  return hasMessage(general) ? t(general) : code;
}

export function initUpload(root: ParentNode, deps: UploadDeps): void {
  const box = root.querySelector<HTMLElement>("[data-upload]");
  if (!box) return;

  const params = new URLSearchParams(location.search);
  let gate: Gate = "loading";
  let userId: string | null = null;
  let account: AccountInfo | null = null;
  let names: string[] = [];
  let kind: LibraryKind = KINDS.includes(params.get("kind") as LibraryKind)
    ? (params.get("kind") as LibraryKind)
    : "mod";
  let file: { name: string; bytes: Uint8Array } | null = null;
  let tooLargeSize: number | null = null;
  let scanning = false;
  let scanFailed = false;
  let report: ScanReport | null = null;
  let dragging = false;
  let submitting = false;
  let submitError: UploadErrorCode | "ackRequired" | "authorRequired" | null = null;
  let doneId: number | null = null;
  const draft = { name: "", description: "", author: "", ack: false };
  let scanRequest = 0;

  // ---------------------------------------------------------------- işlemler

  async function load() {
    gate = "loading";
    render();
    try {
      userId = await deps.uploads.userId();
      if (!userId) {
        gate = "signedOut";
        return render();
      }
      account = await deps.account();
      if (account.ban) {
        gate = "banned";
        return render();
      }
      try {
        names = await deps.names();
      } catch (e) {
        gate = authErrorCode(e) === "serverNotReady" ? "namesNotReady" : "error";
        return render();
      }
      gate = names.length ? "ready" : "noNames";
      draft.author = names[0] ?? "";
    } catch {
      gate = "error";
    }
    render();
  }

  async function runScan() {
    if (!file) return;
    const id = ++scanRequest;
    report = null;
    scanFailed = false;
    scanning = true;
    submitError = null;
    render();
    try {
      const r = await deps.scan(file.bytes, kind);
      if (id !== scanRequest) return;
      report = r;
      draft.name = r.descriptor?.name ?? "";
      draft.ack = false;
    } catch {
      if (id !== scanRequest) return;
      scanFailed = true;
    }
    scanning = false;
    render();
    box!.querySelector<HTMLElement>("[data-report]")?.focus();
  }

  async function chooseFile(f: File) {
    doneId = null;
    report = null;
    tooLargeSize = null;
    // Sınırı aşan dosya belleğe hiç okunmaz
    if (f.size > maxBytes(kind)) {
      file = null;
      tooLargeSize = f.size;
      render();
      return;
    }
    file = { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
    await runScan();
  }

  async function submit() {
    if (!file || !report || !userId || submitting) return;
    if (!draft.author) {
      submitError = "authorRequired";
      return render();
    }
    if (report.verdict === "warn" && !draft.ack) {
      submitError = "ackRequired";
      return render();
    }
    submitting = true;
    submitError = null;
    render();
    try {
      const submission = prepareSubmission({
        report,
        kind,
        fileName: file.name,
        name: draft.name,
        description: draft.description,
        author: draft.author,
      });
      doneId = await deps.uploads.submit(userId, file.bytes, submission);
      file = null;
      report = null;
      draft.description = "";
      draft.name = "";
      draft.ack = false;
    } catch (e) {
      submitError = uploadErrorCode(e);
    }
    submitting = false;
    render();
    box!
      .querySelector<HTMLElement>(doneId !== null ? "[data-done]" : "[data-submit-error]")
      ?.focus();
  }

  // ---------------------------------------------------------------- parçalar

  function kindPicker(): HTMLElement {
    const fs = h(
      "fieldset",
      { class: "upload-step" },
      h("legend", {}, h("span", { class: "step-no" }, "1"), t("upload.stepKind")),
    );
    const grid = h("div", { class: "kind-cards" });
    for (const k of KINDS) {
      const input = h("input", {
        type: "radio",
        name: "kind",
        value: k,
        class: "sr-only",
        "data-focus": `kind-${k}`,
      });
      input.checked = k === kind;
      input.disabled = submitting;
      input.addEventListener("change", () => {
        kind = k;
        history.replaceState(null, "", `${location.pathname}?kind=${k}`);
        tooLargeSize = null;
        if (file && file.bytes.length > maxBytes(kind)) {
          tooLargeSize = file.bytes.length;
          file = null;
          report = null;
          render();
        } else if (file) void runScan();
        else render();
      });
      grid.append(
        h(
          "label",
          { class: `kind-card${k === kind ? " is-selected" : ""}` },
          input,
          kindBadge(k),
          h(
            "span",
            { class: "kind-card-hint" },
            tf(`upload.kindHint.${k}` as MessageKey, {
              ext: `.${kindExt(k)}`,
              max: formatBytes(maxBytes(k)),
            }),
          ),
        ),
      );
    }
    fs.append(grid);
    return fs;
  }

  function dropzone(): HTMLElement {
    const input = h("input", {
      id: "u-file",
      type: "file",
      class: "sr-only",
      accept: `.${kindExt(kind)}`,
      "data-focus": "file",
    });
    input.disabled = submitting;
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      if (f) void chooseFile(f);
    });
    const zone = h(
      "div",
      { class: `dropzone${dragging ? " is-dragging" : ""}` },
      input,
      h(
        "label",
        { for: "u-file", class: "dropzone-label" },
        icon("upload", "dropzone-icon"),
        h("strong", {}, t("upload.drop")),
        h("span", {}, t("upload.orChoose")),
        h(
          "span",
          { class: "muted small" },
          tf("upload.dropHint", { ext: `.${kindExt(kind)}`, max: formatBytes(maxBytes(kind)) }),
        ),
      ),
    );
    const setDrag = (on: boolean) => {
      dragging = on;
      zone.classList.toggle("is-dragging", on);
    };
    zone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      setDrag(true);
    });
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget as Node | null)) setDrag(false);
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer?.files[0];
      if (f && !submitting) void chooseFile(f);
    });
    return h(
      "section",
      { class: "upload-step", "aria-labelledby": "step-file" },
      h(
        "h2",
        { id: "step-file", class: "step-title" },
        h("span", { class: "step-no" }, "2"),
        t("upload.stepFile"),
      ),
      zone,
      file
        ? h(
            "p",
            { class: "chosen-file" },
            t("upload.chosen"),
            " ",
            h("strong", { class: "break" }, file.name),
            ` (${formatBytes(file.bytes.length)})`,
          )
        : null,
    );
  }

  function findingItem(f: Finding): HTMLLIElement {
    return h(
      "li",
      { class: `finding finding-${f.severity}` },
      icon(f.severity === "block" ? "alert" : "info", "icon-sm"),
      h(
        "div",
        {},
        h("span", { class: "finding-text" }, findingText(kind, f.code)),
        f.examples.length && f.examples[0] !== "/" && f.examples[0] !== ""
          ? h(
              "details",
              {},
              h("summary", {}, t("upload.where")),
              h(
                "ul",
                { class: "finding-examples" },
                ...f.examples.map((x) => h("li", { class: "mono break" }, x)),
              ),
            )
          : null,
      ),
    );
  }

  function reportSection(): HTMLElement | null {
    if (tooLargeSize !== null) {
      return h(
        "div",
        { class: "scan-report verdict-block", role: "alert", tabindex: "-1", "data-report": true },
        h("h2", {}, icon("alert", "icon-sm"), h("span", {}, t("upload.verdict.block"))),
        h(
          "p",
          {},
          tf("upload.tooLarge", {
            size: formatBytes(tooLargeSize),
            max: formatBytes(maxBytes(kind)),
          }),
        ),
      );
    }
    if (scanning) {
      return h(
        "p",
        { class: "scan-status", role: "status" },
        h("span", { class: "spinner", "aria-hidden": "true" }),
        t("upload.scanning"),
      );
    }
    if (scanFailed) {
      return h(
        "p",
        { class: "form-error", role: "alert", tabindex: "-1", "data-report": true },
        t("upload.scanFailed"),
      );
    }
    if (!report) return null;
    const d = report.descriptor;
    const facts: Child[] = d
      ? [
          h(
            "dl",
            { class: "scan-facts" },
            d.name ? h("div", {}, h("dt", {}, t("upload.factName")), h("dd", {}, d.name)) : null,
            d.version
              ? h("div", {}, h("dt", {}, t("item.versionLabel")), h("dd", {}, d.version))
              : null,
            d.loaders.length
              ? h(
                  "div",
                  {},
                  h("dt", {}, t("item.loaders")),
                  h("dd", {}, d.loaders.map((l) => loaderName(LOADER_IDS[l] ?? l)).join(", ")),
                )
              : null,
            d.gameVersions
              ? h("div", {}, h("dt", {}, t("item.minecraft")), h("dd", {}, d.gameVersions))
              : null,
            report.kind === "mod"
              ? h(
                  "div",
                  {},
                  h("dt", {}, t("upload.factClasses")),
                  h("dd", {}, String(report.classes)),
                )
              : null,
          ),
        ]
      : [];
    return h(
      "div",
      {
        class: `scan-report verdict-${report.verdict}`,
        tabindex: "-1",
        "data-report": true,
        "aria-labelledby": "scan-title",
      },
      h(
        "h2",
        { id: "scan-title" },
        icon(report.verdict === "pass" ? "check" : "alert", "icon-sm"),
        h("span", {}, t(`upload.verdict.${report.verdict}` as MessageKey)),
      ),
      h("p", { class: "muted" }, t(`upload.verdictText.${report.verdict}` as MessageKey)),
      ...facts,
      report.findings.length
        ? h("ul", { class: "findings" }, ...report.findings.map(findingItem))
        : null,
    );
  }

  function detailsForm(): HTMLElement | null {
    if (!report || report.verdict === "block" || !file) return null;
    const nameInput = h("input", {
      id: "u-name",
      type: "text",
      maxlength: String(MAX_NAME_CHARS),
      "data-focus": "u-name",
      "aria-describedby": "u-name-hint",
    });
    nameInput.value = draft.name;
    nameInput.addEventListener("input", () => (draft.name = nameInput.value));
    const desc = h("textarea", {
      id: "u-desc",
      rows: "5",
      maxlength: String(MAX_DESCRIPTION_CHARS),
      "data-focus": "u-desc",
      "aria-describedby": "u-desc-count",
    });
    desc.value = draft.description;
    const count = h(
      "p",
      { class: "field-hint", id: "u-desc-count" },
      tf("upload.descCount", { n: desc.value.length, max: MAX_DESCRIPTION_CHARS }),
    );
    desc.addEventListener("input", () => {
      draft.description = desc.value;
      count.textContent = tf("upload.descCount", {
        n: desc.value.length,
        max: MAX_DESCRIPTION_CHARS,
      });
    });
    const author = h(
      "select",
      { id: "u-author", "data-focus": "u-author", "aria-describedby": "u-author-hint" },
      ...names.map((n) => h("option", { value: n }, n)),
    );
    author.value = draft.author;
    author.addEventListener("change", () => (draft.author = author.value));

    let ack: HTMLElement | null = null;
    if (report.verdict === "warn") {
      const box = h("input", { id: "u-ack", type: "checkbox", "data-focus": "u-ack" });
      box.checked = draft.ack;
      box.addEventListener("change", () => (draft.ack = box.checked));
      ack = h("div", { class: "ack" }, box, h("label", { for: "u-ack" }, t("upload.ack")));
    }

    const btn = h(
      "button",
      { type: "submit", class: "btn btn-primary btn-lg", "data-focus": "submit" },
      icon("upload"),
      h("span", {}, submitting ? t("upload.submitting") : t("upload.submit")),
    );
    btn.disabled = submitting;
    const form = h(
      "form",
      { class: "upload-step upload-form", novalidate: true, "aria-labelledby": "step-details" },
      h(
        "h2",
        { id: "step-details", class: "step-title" },
        h("span", { class: "step-no" }, "3"),
        t("upload.stepDetails"),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { for: "u-name" }, t("upload.name")),
        nameInput,
        h("p", { class: "field-hint", id: "u-name-hint" }, t("upload.nameHint")),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { for: "u-desc" }, t("upload.description")),
        desc,
        count,
      ),
      h(
        "div",
        { class: "field" },
        h("label", { for: "u-author" }, t("upload.author")),
        author,
        h(
          "p",
          { class: "field-hint", id: "u-author-hint" },
          t("upload.authorHint"),
          " ",
          h("a", { href: "/account/" }, t("upload.manageNames")),
        ),
      ),
      ack,
      submitError
        ? h(
            "p",
            { class: "form-error", role: "alert", tabindex: "-1", "data-submit-error": true },
            icon("alert", "icon-sm"),
            h("span", {}, t(`upload.error.${submitError}` as MessageKey)),
          )
        : null,
      h("p", { class: "muted small" }, t("upload.reviewNote")),
      btn,
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void submit();
    });
    return form;
  }

  function doneView(): HTMLElement {
    const again = h("button", { type: "button", class: "btn btn-ghost" }, t("upload.again"));
    again.addEventListener("click", () => {
      doneId = null;
      render();
      box!.querySelector<HTMLElement>("#u-file")?.focus();
    });
    return h(
      "div",
      { class: "notice notice-done", tabindex: "-1", "data-done": true, role: "status" },
      icon("check", "notice-icon"),
      h("h2", { class: "notice-title" }, t("upload.doneTitle")),
      h("p", {}, t("upload.doneText")),
      h(
        "div",
        { class: "notice-actions" },
        h("a", { class: "btn btn-primary", href: "/uploads/" }, t("upload.toMyUploads")),
        again,
      ),
    );
  }

  function gateNotice(): HTMLElement {
    const link = (href: string, key: MessageKey) =>
      h("a", { class: "btn btn-primary btn-sm", href }, t(key));
    const map: Record<
      Exclude<Gate, "ready" | "loading">,
      [MessageKey, MessageKey, HTMLElement | null]
    > = {
      signedOut: ["upload.signedOutTitle", "upload.signedOutText", link("/account/", "nav.signIn")],
      banned: ["auth.bannedTitle", "upload.bannedText", link("/account/", "nav.account")],
      noNames: [
        "upload.noNamesTitle",
        "upload.noNamesText",
        link("/account/", "upload.manageNames"),
      ],
      namesNotReady: ["upload.notReadyTitle", "upload.notReadyText", null],
      error: ["library.errorTitle", "library.errorText", null],
    };
    const [title, text, action] = map[gate as keyof typeof map];
    const n = h(
      "div",
      {
        class: `notice ${gate === "error" ? "notice-error" : "notice-empty"}`,
        role: gate === "error" ? "alert" : null,
      },
      icon(gate === "error" ? "alert" : "info", "notice-icon"),
      h("h2", { class: "notice-title" }, t(title)),
      h("p", {}, t(text)),
    );
    if (action) n.append(action);
    if (gate === "error") {
      const retry = h(
        "button",
        { type: "button", class: "btn btn-ghost btn-sm" },
        t("library.retry"),
      );
      retry.addEventListener("click", () => void load());
      n.append(retry);
    }
    return n;
  }

  // ---------------------------------------------------------------- çizim

  function render() {
    box!.setAttribute("aria-busy", String(gate === "loading" || scanning || submitting));
    if (gate === "loading") return;
    const focusKey = document.activeElement?.closest<HTMLElement>("[data-focus]")?.dataset.focus;
    const content: Child[] = [];
    if (gate !== "ready") content.push(gateNotice());
    else if (doneId !== null) content.push(doneView());
    else content.push(kindPicker(), dropzone(), reportSection(), detailsForm());
    box!.replaceChildren(...content.filter((c): c is HTMLElement => c instanceof HTMLElement));
    if (focusKey) box!.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus();
  }

  onLangChange(() => render());
  void load();
}
