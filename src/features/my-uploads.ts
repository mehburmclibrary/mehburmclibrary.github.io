// "Yüklediklerim" sayfasının (/uploads/) davranışı: kullanıcının yüklemeleri, durumları
// (beklemede / onaylandı / reddedildi), admin notu ve geri çekme.
import { kindBadge, notice, skeletonCards } from "../components/item-card";
import type { MessageKey } from "../i18n/tr";
import { h, icon } from "../lib/dom";
import { formatBytes, formatDate } from "../lib/format";
import { onLangChange, t, tf } from "../lib/i18n";
import { itemUrl } from "../lib/library";
import {
  uploadErrorCode,
  type MyUpload,
  type UploadApi,
  type UploadErrorCode,
} from "../lib/upload";

export function initMyUploads(
  root: ParentNode,
  api: Pick<UploadApi, "userId" | "myUploads" | "withdraw">,
): void {
  const box = root.querySelector<HTMLElement>("[data-my-uploads]");
  if (!box) return;

  let userId: string | null = null;
  let state: "loading" | "signedOut" | "error" | "ready" = "loading";
  let items: MyUpload[] = [];
  let confirming: number | null = null;
  let busy: number | null = null;
  let rowError: { id: number; code: UploadErrorCode } | null = null;

  async function load() {
    state = "loading";
    render();
    try {
      userId = await api.userId();
      if (!userId) {
        state = "signedOut";
      } else {
        items = await api.myUploads();
        state = "ready";
      }
    } catch {
      state = "error";
    }
    render();
  }

  async function withdraw(id: number) {
    if (!userId || busy !== null) return;
    busy = id;
    rowError = null;
    render();
    try {
      await api.withdraw(userId, id);
      items = items.filter((i) => i.id !== id);
      confirming = null;
    } catch (e) {
      rowError = { id, code: uploadErrorCode(e) };
    }
    busy = null;
    render();
    // Silinen kartın yerine bir sonraki karta (yoksa "yeni yükle" bağlantısına) odaklanılır
    box!.querySelector<HTMLElement>('[data-focus^="withdraw-"], a[href="/upload/"]')?.focus();
  }

  function card(it: MyUpload): HTMLLIElement {
    const title =
      it.status === "approved" ? h("a", { href: itemUrl(it.id) }, it.name) : h("span", {}, it.name);
    const actions = h("div", { class: "upload-actions" });
    if (confirming === it.id) {
      const yes = h(
        "button",
        { type: "button", class: "btn btn-sm btn-danger", "data-focus": `yes-${it.id}` },
        busy === it.id ? t("auth.working") : t("uploads.withdrawYes"),
      );
      yes.disabled = busy !== null;
      yes.addEventListener("click", () => void withdraw(it.id));
      const no = h(
        "button",
        { type: "button", class: "btn btn-sm btn-ghost", "data-focus": `no-${it.id}` },
        t("uploads.withdrawNo"),
      );
      no.disabled = busy !== null;
      no.addEventListener("click", () => {
        confirming = null;
        render();
        box!.querySelector<HTMLElement>(`[data-focus="withdraw-${it.id}"]`)?.focus();
      });
      actions.append(h("span", { class: "confirm-text" }, t("uploads.withdrawConfirm")), yes, no);
    } else {
      const btn = h(
        "button",
        {
          type: "button",
          class: "btn btn-sm btn-ghost",
          "data-focus": `withdraw-${it.id}`,
          "aria-label": tf("uploads.withdrawLabel", { name: it.name }),
        },
        icon("trash", "icon-sm"),
        h("span", {}, t("uploads.withdraw")),
      );
      btn.disabled = busy !== null;
      btn.addEventListener("click", () => {
        confirming = it.id;
        render();
        box!.querySelector<HTMLElement>(`[data-focus="no-${it.id}"]`)?.focus();
      });
      actions.append(btn);
    }
    return h(
      "li",
      { class: "card upload-card" },
      h(
        "div",
        { class: "item-top" },
        kindBadge(it.kind),
        h(
          "span",
          { class: `status-badge status-${it.status}` },
          t(`uploads.status.${it.status}` as MessageKey),
        ),
      ),
      h("h2", { class: "item-name" }, title),
      h(
        "p",
        { class: "item-meta" },
        h("span", { class: "item-version" }, `v${it.version}`),
        " · ",
        tf("item.by", { author: it.author }),
        " · ",
        formatBytes(it.size),
      ),
      h("p", { class: "item-date" }, tf("uploads.uploaded", { date: formatDate(it.createdAt) })),
      it.status === "pending" ? h("p", { class: "muted small" }, t("uploads.pendingHint")) : null,
      it.reviewNote
        ? h(
            "p",
            { class: "review-note" },
            h("strong", {}, t("uploads.reviewNote")),
            " ",
            it.reviewNote,
          )
        : null,
      rowError?.id === it.id
        ? h(
            "p",
            { class: "form-error", role: "alert" },
            t(`upload.error.${rowError.code}` as MessageKey),
          )
        : null,
      actions,
    );
  }

  function render() {
    box!.setAttribute("aria-busy", String(state === "loading"));
    const focusKey = document.activeElement?.closest<HTMLElement>("[data-focus]")?.dataset.focus;
    if (state === "loading") {
      box!.replaceChildren(h("ul", { class: "item-grid" }, ...skeletonCards(3)));
      return;
    }
    if (state === "signedOut") {
      const n = notice({
        kind: "empty",
        title: t("upload.signedOutTitle"),
        text: t("uploads.signedOutText"),
      });
      n.append(h("a", { class: "btn btn-primary btn-sm", href: "/account/" }, t("nav.signIn")));
      box!.replaceChildren(n);
      return;
    }
    if (state === "error") {
      box!.replaceChildren(
        notice({
          kind: "error",
          title: t("library.errorTitle"),
          text: t("library.errorText"),
          action: { label: t("library.retry"), onClick: () => void load() },
        }),
      );
      return;
    }
    const head = h(
      "div",
      { class: "uploads-head" },
      h(
        "p",
        { class: "results-status", role: "status" },
        items.length
          ? tf(items.length === 1 ? "library.countOne" : "library.countOther", { n: items.length })
          : "",
      ),
      h(
        "a",
        { class: "btn btn-primary btn-sm", href: "/upload/" },
        icon("upload", "icon-sm"),
        h("span", {}, t("uploads.new")),
      ),
    );
    if (items.length === 0) {
      const n = notice({
        kind: "empty",
        title: t("uploads.emptyTitle"),
        text: t("uploads.emptyText"),
      });
      n.append(h("a", { class: "btn btn-primary btn-sm", href: "/upload/" }, t("uploads.new")));
      box!.replaceChildren(n);
      return;
    }
    box!.replaceChildren(head, h("ul", { class: "item-grid" }, ...items.map(card)));
    if (focusKey) box!.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus();
  }

  onLangChange(() => render());
  void load();
}
