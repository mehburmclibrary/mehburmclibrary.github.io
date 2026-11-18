// Kütüphane sayfasının (/library/) davranışı: filtre formu, sonuç listesi, "daha fazla göster",
// yükleniyor / boş / hata durumları. Filtreler adres çubuğunda tutulur (?q=&kind=...), böylece
// bir arama bağlantı olarak paylaşılabilir ve sayfa yenilenince kaybolmaz.
// Veri kaynağı parametre olarak verilir; testler sahte bir kaynakla çalışır.
import { itemCard, notice, skeletonCards } from "../components/item-card";
import type { Page } from "../lib/api";
import { onLangChange, t, tf } from "../lib/i18n";
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  MAX_QUERY,
  type Filters,
  type LibraryItem,
} from "../lib/library";

export interface LibrarySource {
  listItems(f: Filters, offset: number): Promise<Page>;
  listGameVersions(): Promise<string[]>;
}

const SEARCH_DELAY_MS = 300;
const SKELETONS = 6;

export function initLibraryList(root: ParentNode, source: LibrarySource): void {
  const form = root.querySelector<HTMLFormElement>("[data-filters]");
  const results = root.querySelector<HTMLUListElement>("[data-results]");
  const status = root.querySelector<HTMLElement>("[data-status]");
  const noticeBox = root.querySelector<HTMLElement>("[data-notice]");
  const more = root.querySelector<HTMLButtonElement>("[data-more]");
  if (!form || !results || !status || !noticeBox || !more) return;

  const q = form.elements.namedItem("q") as HTMLInputElement;
  const loader = form.elements.namedItem("loader") as HTMLSelectElement;
  const mc = form.elements.namedItem("mc") as HTMLSelectElement;
  const sort = form.elements.namedItem("sort") as HTMLSelectElement;
  const clear = form.querySelector<HTMLButtonElement>('button[type="reset"]');
  const kindInputs = () => [...form.querySelectorAll<HTMLInputElement>('input[name="kind"]')];

  let filters: Filters = filtersFromParams(new URLSearchParams(location.search));
  let items: LibraryItem[] = [];
  let total = 0;
  let failed = false;
  let loading = false;
  let request = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  function ensureMcOption(value: string) {
    if (![...mc.options].some((o) => o.value === value)) mc.add(new Option(value, value));
  }

  function writeForm() {
    q.value = filters.q;
    kindInputs().forEach((r) => (r.checked = r.value === (filters.kind ?? "")));
    loader.value = filters.loader ?? "";
    if (filters.mc) ensureMcOption(filters.mc);
    mc.value = filters.mc ?? "";
    sort.value = filters.sort;
  }

  function readForm(): Filters {
    const params = new URLSearchParams();
    params.set("q", q.value.slice(0, MAX_QUERY));
    params.set("kind", kindInputs().find((r) => r.checked)?.value ?? "");
    params.set("loader", loader.value);
    params.set("mc", mc.value);
    params.set("sort", sort.value);
    return filtersFromParams(params);
  }

  function syncUrl() {
    const p = filtersToParams(filters).toString();
    history.replaceState(null, "", p ? `${location.pathname}?${p}` : location.pathname);
  }

  function render() {
    results!.setAttribute("aria-busy", String(loading));
    if (clear) clear.hidden = !hasActiveFilters(filters);
    if (loading && items.length === 0) return; // iskelet kartlar zaten gösteriliyor

    results!.replaceChildren(...items.map((i) => itemCard(i)));
    noticeBox!.replaceChildren();
    more!.hidden = failed || items.length >= total;
    more!.disabled = loading;
    more!.textContent = loading ? t("library.loading") : t("library.more");

    if (failed) {
      status!.textContent = "";
      noticeBox!.append(
        notice({
          kind: "error",
          title: t("library.errorTitle"),
          text: t("library.errorText"),
          action: { label: t("library.retry"), onClick: () => void load(items.length > 0) },
        }),
      );
      return;
    }
    if (total === 0) {
      status!.textContent = "";
      const filtered = hasActiveFilters(filters);
      noticeBox!.append(
        notice({
          kind: "empty",
          title: t("library.emptyTitle"),
          text: filtered ? t("library.emptyText") : t("library.emptyAllText"),
          action: filtered ? { label: t("library.clear"), onClick: resetFilters } : undefined,
        }),
      );
      return;
    }
    status!.textContent =
      items.length < total
        ? tf("library.showing", { shown: items.length, total })
        : tf(total === 1 ? "library.countOne" : "library.countOther", { n: total });
  }

  async function load(append: boolean) {
    const id = ++request;
    loading = true;
    failed = false;
    if (!append) {
      items = [];
      results!.replaceChildren(...skeletonCards(SKELETONS));
      noticeBox!.replaceChildren();
      status!.textContent = t("library.loading");
      more!.hidden = true;
    }
    render();
    const firstNew = items.length;
    try {
      const page = await source.listItems(filters, append ? items.length : 0);
      if (id !== request) return; // daha yeni bir istek başladı; bu sonuç eskidi
      items = append ? [...items, ...page.items] : page.items;
      total = page.total;
    } catch {
      if (id !== request) return;
      failed = true;
      if (!append) items = [];
    }
    loading = false;
    render();
    // "Daha fazla göster"den sonra klavye odağı ilk yeni karta geçer
    if (append && !failed) results!.querySelectorAll("a")[firstNew]?.focus();
  }

  function update(next: Filters) {
    filters = next;
    syncUrl();
    void load(false);
  }

  function resetFilters() {
    filters = { ...DEFAULT_FILTERS, sort: filters.sort };
    writeForm();
    update(filters);
    q.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    update(readForm());
  });
  form.addEventListener("reset", (e) => {
    e.preventDefault();
    resetFilters();
  });
  q.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => update(readForm()), SEARCH_DELAY_MS);
  });
  form.addEventListener("change", (e) => {
    if (e.target === q) return; // arama kutusu "input" ile izleniyor
    update(readForm());
  });
  more.addEventListener("click", () => void load(true));
  onLangChange(() => {
    if (!loading) render();
  });

  writeForm();
  syncUrl();
  void load(false);

  // Minecraft sürümü seçenekleri ayrıca yüklenir; gelmezse filtre "Hepsi" ile çalışmaya devam eder
  source
    .listGameVersions()
    .then((versions) => {
      versions.forEach(ensureMcOption);
      mc.value = filters.mc ?? "";
    })
    .catch(() => undefined);
}
