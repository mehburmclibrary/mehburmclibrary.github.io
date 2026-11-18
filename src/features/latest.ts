// Ana sayfadaki "Son eklenenler": en son onaylanan birkaç içerik.
import { itemCard, notice, skeletonCards } from "../components/item-card";
import type { Page } from "../lib/api";
import { onLangChange, t } from "../lib/i18n";
import { DEFAULT_FILTERS, type Filters, type LibraryItem } from "../lib/library";

export const LATEST_COUNT = 4;

export function initLatest(
  root: ParentNode,
  listItems: (f: Filters, offset: number, limit: number) => Promise<Page>,
): void {
  const list = root.querySelector<HTMLUListElement>("[data-latest]");
  const noticeBox = list?.parentElement?.querySelector<HTMLElement>("[data-notice]");
  if (!list || !noticeBox) return;

  let items: LibraryItem[] | null = null;
  let failed = false;

  function render() {
    list!.setAttribute("aria-busy", String(items === null && !failed));
    noticeBox!.replaceChildren();
    if (failed) {
      list!.replaceChildren();
      noticeBox!.append(
        notice({
          kind: "error",
          title: t("library.errorTitle"),
          text: t("library.errorText"),
          action: { label: t("library.retry"), onClick: () => void load() },
        }),
      );
      return;
    }
    if (items === null) return;
    if (items.length === 0) {
      list!.replaceChildren();
      noticeBox!.append(
        notice({ kind: "empty", title: t("library.emptyTitle"), text: t("library.emptyAllText") }),
      );
      return;
    }
    list!.replaceChildren(...items.map((i) => itemCard(i)));
  }

  async function load() {
    items = null;
    failed = false;
    list!.replaceChildren(...skeletonCards(LATEST_COUNT));
    render();
    try {
      items = (await listItems(DEFAULT_FILTERS, 0, LATEST_COUNT)).items;
    } catch {
      failed = true;
    }
    render();
  }

  onLangChange(render);
  void load();
}
