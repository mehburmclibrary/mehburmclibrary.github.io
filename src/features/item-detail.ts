// İçerik detay sayfasının (/item/?id=...) davranışı: içeriği yükler, bilgileri, kurulum
// ipucunu ve İndir düğmesini çizer. Veri kaynağı parametre olarak verilir (testlerde sahtesi).
import { itemTags, kindBadge, kindLabel, notice } from "../components/item-card";
import { h, icon } from "../lib/dom";
import { LINKS } from "../lib/links";
import { formatBytes, formatDate } from "../lib/format";
import { onLangChange, t, tf } from "../lib/i18n";
import {
  displayGameVersions,
  itemIdFromParams,
  launcherLink,
  loaderName,
  type LibraryItem,
} from "../lib/library";
import type { MessageKey } from "../i18n/tr";
import type { UploadApi } from "../lib/upload";
import { createReportWidget, type ReportWidget } from "./report";

export interface ItemSource {
  getItem(id: number): Promise<LibraryItem | null>;
  downloadUrl(item: LibraryItem): Promise<string>;
  /** Şikâyet işlemleri; verilmezse "Şikâyet et" bölümü gösterilmez. */
  reporter?: Pick<UploadApi, "userId" | "report">;
}

/** Dosya indirmesini başlatır (testlerde değiştirilebilsin diye ayrı). */
export type Navigate = (url: string) => void;

/**
 * "Launcher'da aç"a basıldıktan sonra beklenen süre. Launcher açılırsa tarayıcı penceresi
 * odağı kaybeder; bu süre içinde kaybetmezse launcher büyük ihtimalle kurulu ya da güncel
 * değildir (tarayıcılar bir uygulamanın kurulu olup olmadığını söylemez).
 */
export const LAUNCHER_WAIT_MS = 2500;

const INSTALL_KEYS: Record<LibraryItem["kind"], MessageKey> = {
  mod: "item.installMod",
  modpack: "item.installModpack",
  resourcepack: "item.installResourcepack",
  shader: "item.installShader",
};

function installText(item: LibraryItem): string {
  const loaders = item.loaders.map(loaderName).join(" / ") || "—";
  return tf(INSTALL_KEYS[item.kind], { loaders });
}

function row(label: string, ...value: (Node | string)[]): HTMLDivElement {
  return h("div", { class: "detail-row" }, h("dt", {}, label), h("dd", {}, ...value));
}

export function initItemDetail(
  root: ParentNode,
  source: ItemSource,
  navigate: Navigate = (url) => window.location.assign(url),
): void {
  const box = root.querySelector<HTMLElement>("[data-item]");
  if (!box) return;
  const id = itemIdFromParams(new URLSearchParams(location.search));

  let item: LibraryItem | null = null;
  let state: "loading" | "ready" | "missing" | "error" = "loading";
  let downloading = false;
  let downloadFailed = false;
  let copied = false;
  let launcherHint = false;
  let launcherTimer: ReturnType<typeof setTimeout> | undefined;
  let report: ReportWidget | null = null;

  // Bağlantıya tıklanınca tarayıcı launcher'ı açmayı dener (bağlantının kendisi, burada
  // yalnızca açılıp açılmadığı izlenir).
  function watchLauncher() {
    clearTimeout(launcherTimer);
    if (launcherHint) {
      launcherHint = false;
      render();
    }
    let left = false;
    const away = () => {
      left = true;
    };
    const onVisibility = () => document.visibilityState === "hidden" && away();
    window.addEventListener("blur", away);
    document.addEventListener("visibilitychange", onVisibility);
    launcherTimer = setTimeout(() => {
      window.removeEventListener("blur", away);
      document.removeEventListener("visibilitychange", onVisibility);
      if (left) return;
      launcherHint = true;
      render();
    }, LAUNCHER_WAIT_MS);
  }

  async function download() {
    if (!item || downloading) return;
    downloading = true;
    downloadFailed = false;
    render();
    try {
      navigate(await source.downloadUrl(item));
    } catch {
      downloadFailed = true;
    }
    // Tarayıcı indirmeyi başlatırken düğme kısa bir süre kapalı kalır (çift tıklamaya karşı)
    setTimeout(() => {
      downloading = false;
      render();
    }, 1500);
    render();
  }

  async function copySha() {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.sha1);
      copied = true;
      render();
      setTimeout(() => {
        copied = false;
        render();
      }, 2000);
    } catch {
      // Pano kullanılamıyorsa (eski tarayıcı / izin yok) değer zaten seçilebilir durumda
    }
  }

  function renderItem(it: LibraryItem): Node[] {
    const mc = displayGameVersions(it.game_versions);
    const dl = h(
      "button",
      { type: "button", class: "btn btn-primary btn-lg", "data-focus": "download" },
      icon("download"),
      h("span", {}, downloading ? t("item.downloading") : t("item.download")),
      h("span", { class: "btn-note" }, formatBytes(it.size)),
    );
    dl.disabled = downloading;
    dl.addEventListener("click", () => void download());

    const open = h(
      "a",
      { class: "btn btn-ghost btn-lg", href: launcherLink(it.id), "data-focus": "launcher" },
      icon("external"),
      h("span", {}, t("item.openInLauncher")),
    );
    open.addEventListener("click", watchLauncher);

    const copyBtn = h(
      "button",
      {
        type: "button",
        class: "icon-btn copy-btn",
        "data-focus": "copy",
        "aria-label": copied ? t("item.copied") : t("item.copy"),
        title: copied ? t("item.copied") : t("item.copy"),
      },
      icon(copied ? "check" : "copy"),
    );
    copyBtn.addEventListener("click", () => void copySha());

    return [
      h(
        "header",
        { class: "item-header" },
        kindBadge(it.kind),
        h("h1", { class: "page-title item-title" }, it.name),
        h(
          "p",
          { class: "item-meta" },
          h("span", { class: "item-version" }, `v${it.version}`),
          " · ",
          tf("item.by", { author: it.author }),
        ),
        itemTags(it),
      ),
      h(
        "div",
        { class: "item-actions" },
        dl,
        open,
        launcherHint
          ? h(
              "div",
              { class: "launcher-tip launcher-hint", role: "status" },
              icon("info", "icon-sm"),
              h(
                "div",
                {},
                h("p", { class: "launcher-hint-title" }, t("item.launcherHintTitle")),
                h("p", {}, t("item.launcherHintText")),
                h(
                  "a",
                  {
                    class: "btn btn-primary btn-sm",
                    href: LINKS.launcherSite,
                    target: "_blank",
                    rel: "noopener",
                  },
                  icon("download"),
                  h("span", {}, t("item.launcherHintCta")),
                  h("span", { class: "sr-only" }, t("external")),
                ),
              ),
            )
          : null,
        downloadFailed
          ? h("p", { class: "form-error", role: "alert" }, t("item.downloadError"))
          : null,
      ),
      h(
        "div",
        { class: "item-layout" },
        h(
          "div",
          { class: "item-main" },
          h(
            "section",
            { class: "card item-section", "aria-labelledby": "desc-title" },
            h("h2", { id: "desc-title" }, t("item.description")),
            it.description
              ? h("p", { class: "item-description" }, it.description)
              : h("p", { class: "muted" }, t("item.noDescription")),
          ),
          h(
            "section",
            { class: "card item-section", "aria-labelledby": "install-title" },
            h("h2", { id: "install-title" }, t("item.install")),
            h("p", {}, installText(it)),
            h(
              "p",
              { class: "launcher-tip" },
              icon("info", "icon-sm"),
              h("span", {}, t("item.launcherTip")),
            ),
          ),
          report?.el ?? null,
        ),
        h(
          "aside",
          { class: "card item-section item-facts", "aria-labelledby": "facts-title" },
          h("h2", { id: "facts-title" }, t("item.details")),
          h(
            "dl",
            {},
            row(t("item.kind"), kindLabel(it.kind)),
            row(t("item.versionLabel"), it.version),
            row(t("item.author"), it.author),
            it.loaders.length
              ? row(t("item.loaders"), it.loaders.map(loaderName).join(", "))
              : null,
            row(t("item.minecraft"), mc ?? t("item.anyMc")),
            row(t("item.size"), formatBytes(it.size)),
            row(t("item.file"), h("span", { class: "mono break" }, it.file_name)),
            row(
              t("item.published"),
              h("time", { datetime: it.approved_at }, formatDate(it.approved_at)),
            ),
          ),
          h(
            "div",
            { class: "sha-box" },
            h("span", { class: "sha-label" }, t("item.sha1")),
            h("div", { class: "sha-row" }, h("code", { class: "mono break" }, it.sha1), copyBtn),
            h("p", { class: "muted small" }, t("item.sha1Hint")),
          ),
        ),
      ),
    ].filter((n): n is HTMLElement => n !== null);
  }

  function render() {
    box!.setAttribute("aria-busy", String(state === "loading"));
    if (state === "loading") return;
    if (state === "ready" && item) {
      document.title = tf("meta.itemTitle", { name: item.name });
      // Dil değişince çeviri sistemi başlığı geri yazmasın diye işaret kaldırılır
      document.querySelector("title")?.removeAttribute("data-i18n");
      // Yeniden çizimde düğmeler yeniden oluşur; klavye odağı aynı düğmede kalsın
      const focusKey = document.activeElement?.closest<HTMLElement>("[data-focus]")?.dataset.focus;
      box!.replaceChildren(...renderItem(item));
      if (focusKey) box!.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus();
      return;
    }
    const missing = state === "missing";
    box!.replaceChildren(
      notice({
        kind: missing ? "empty" : "error",
        title: missing ? t("item.notFoundTitle") : t("library.errorTitle"),
        text: missing ? t("item.notFoundText") : t("library.errorText"),
        action: missing ? undefined : { label: t("library.retry"), onClick: () => void load() },
      }),
    );
  }

  async function load() {
    state = "loading";
    render();
    if (id === null) {
      state = "missing";
      render();
      return;
    }
    try {
      item = await source.getItem(id);
      if (item && source.reporter) report = createReportWidget(item.id, source.reporter);
      state = item ? "ready" : "missing";
    } catch {
      state = "error";
    }
    render();
  }

  onLangChange(() => {
    report?.render();
    render();
  });
  void load();
}
