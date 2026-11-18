// Kütüphane listesindeki içerik kartı ve sayfalarda ortak kullanılan küçük parçalar.
import { h, icon } from "../lib/dom";
import { formatBytes, formatDate } from "../lib/format";
import { t, tf } from "../lib/i18n";
import {
  displayGameVersions,
  itemUrl,
  loaderName,
  type Kind,
  type LibraryItem,
} from "../lib/library";
import type { MessageKey } from "../i18n/tr";

export function kindLabel(kind: Kind): string {
  return t(`kind.${kind}` as MessageKey);
}

/** Tür rozeti: ikon + "Mod" / "Modpack" / ... */
export function kindBadge(kind: Kind): HTMLSpanElement {
  return h("span", { class: `kind-badge kind-${kind}` }, icon(kind, "icon-sm"), kindLabel(kind));
}

/** Loader ve Minecraft sürümü etiketleri. */
export function itemTags(item: LibraryItem): HTMLUListElement {
  const mc = displayGameVersions(item.game_versions);
  return h(
    "ul",
    { class: "tags" },
    ...item.loaders.map((l) => h("li", { class: "tag" }, loaderName(l))),
    h("li", { class: "tag tag-mc" }, mc ? tf("item.mcShort", { mc }) : t("item.anyMc")),
  );
}

/** Listede bir içerik: kartın tamamı detay sayfasına giden bağlantıdır. */
export function itemCard(item: LibraryItem, headingLevel: "h2" | "h3" = "h3"): HTMLLIElement {
  const heading = h(
    headingLevel,
    { class: "item-name" },
    h("a", { href: itemUrl(item.id) }, item.name),
  );
  return h(
    "li",
    { class: "card item-card" },
    h(
      "div",
      { class: "item-top" },
      kindBadge(item.kind),
      h("span", { class: "item-size" }, formatBytes(item.size)),
    ),
    heading,
    h(
      "p",
      { class: "item-meta" },
      h("span", { class: "item-version" }, `v${item.version}`),
      " · ",
      tf("item.by", { author: item.author }),
    ),
    item.description ? h("p", { class: "item-desc" }, item.description) : null,
    itemTags(item),
    h(
      "p",
      { class: "item-date" },
      h("time", { datetime: item.approved_at }, formatDate(item.approved_at)),
    ),
  );
}

/** Yükleniyor görünümü: gri yer tutucu kartlar (ekran okuyucudan gizli). */
export function skeletonCards(count: number): HTMLLIElement[] {
  return Array.from({ length: count }, () =>
    h(
      "li",
      { class: "card item-card is-skeleton", "aria-hidden": "true" },
      h("span", { class: "skeleton skeleton-badge" }),
      h("span", { class: "skeleton skeleton-title" }),
      h("span", { class: "skeleton skeleton-line" }),
      h("span", { class: "skeleton skeleton-line short" }),
    ),
  );
}

/** Boş sonuç ya da hata kutusu; isteğe bağlı bir düğmeyle. */
export function notice(opts: {
  kind: "empty" | "error";
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}): HTMLDivElement {
  const box = h(
    "div",
    { class: `notice notice-${opts.kind}`, role: opts.kind === "error" ? "alert" : null },
    icon(opts.kind === "error" ? "alert" : "search", "notice-icon"),
    h("h2", { class: "notice-title" }, opts.title),
    h("p", {}, opts.text),
  );
  if (opts.action) {
    const btn = h("button", { type: "button", class: "btn btn-ghost btn-sm" }, opts.action.label);
    btn.addEventListener("click", opts.action.onClick);
    box.append(btn);
  }
  return box;
}
