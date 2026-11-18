import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../lib/i18n";
import type { Filters } from "../lib/library";
import { initLibraryList, type LibrarySource } from "./library-list";
import { fakeItem, flush } from "./test-helpers";

const html = readFileSync(resolve(import.meta.dirname, "../../library/index.html"), "utf8");

function mount(search = "") {
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, "");
  history.replaceState(null, "", `/library/${search}`);
}

function source(overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    listItems: vi.fn(async () => ({
      items: [fakeItem(), fakeItem({ id: 15, name: "Death Note" })],
      total: 2,
    })),
    listGameVersions: vi.fn(async () => ["26.2", "1.21"]),
    ...overrides,
  };
}

const status = () => document.querySelector("[data-status]")!.textContent;
const cards = () => [...document.querySelectorAll(".item-card:not(.is-skeleton)")];

describe("kütüphane listesi", () => {
  beforeEach(() => {
    mount();
    setLang("en", false);
  });

  it("içerikleri kart olarak gösterir ve sayıyı yazar", async () => {
    const src = source();
    initLibraryList(document, src);
    expect(document.querySelectorAll(".is-skeleton").length).toBeGreaterThan(0);
    await flush();
    expect(cards()).toHaveLength(2);
    expect(status()).toBe("2 items");
    const link = cards()[0]!.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/item/?id=18");
    expect(document.querySelector("[data-results]")!.getAttribute("aria-busy")).toBe("false");
    // Minecraft sürümü seçenekleri doldu
    expect(
      [...document.querySelectorAll<HTMLOptionElement>("#f-mc option")].map((o) => o.value),
    ).toEqual(["", "26.2", "1.21"]);
  });

  it("kullanıcının yazdığı metni HTML olarak çalıştırmaz", async () => {
    const evil = '<img src=x onerror="window.hacked=1">';
    initLibraryList(
      document,
      source({
        listItems: vi.fn(async () => ({
          items: [fakeItem({ name: evil, description: evil })],
          total: 1,
        })),
      }),
    );
    await flush();
    expect(document.querySelector(".item-card img")).toBeNull();
    expect(cards()[0]!.querySelector(".item-name")!.textContent).toBe(evil);
  });

  it("adresteki filtreleri okur ve sunucuya gönderir", async () => {
    mount("?kind=shader&q=glow&sort=name");
    const src = source();
    initLibraryList(document, src);
    await flush();
    expect(src.listItems).toHaveBeenCalledWith(
      { q: "glow", kind: "shader", loader: null, mc: null, sort: "name" },
      0,
    );
    expect(
      document.querySelector<HTMLInputElement>('input[name="kind"][value="shader"]')!.checked,
    ).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#f-q")!.value).toBe("glow");
  });

  it("filtre değişince adres güncellenir ve liste yeniden yüklenir", async () => {
    const src = source();
    initLibraryList(document, src);
    await flush();
    const loader = document.querySelector<HTMLSelectElement>("#f-loader")!;
    loader.value = "quilt";
    loader.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    expect(location.search).toBe("?loader=quilt");
    expect(vi.mocked(src.listItems).mock.lastCall![0]).toMatchObject({ loader: "quilt" });
    // Temizle düğmesi görünür ve filtreleri sıfırlar
    const clear = document.querySelector<HTMLButtonElement>('button[type="reset"]')!;
    expect(clear.hidden).toBe(false);
    clear.click();
    await flush();
    expect(location.search).toBe("");
    expect(clear.hidden).toBe(true);
  });

  it("arama kutusu yazmayı bitirince arar", async () => {
    vi.useFakeTimers();
    const src = source();
    initLibraryList(document, src);
    const q = document.querySelector<HTMLInputElement>("#f-q")!;
    q.value = "golem";
    q.dispatchEvent(new Event("input", { bubbles: true }));
    q.value = "golem t";
    q.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(350);
    vi.useRealTimers();
    await flush();
    const calls = vi.mocked(src.listItems).mock.calls.map((c) => (c[0] as Filters).q);
    expect(calls).toEqual(["", "golem t"]);
  });

  it("daha fazla göster düğmesi sonraki sayfayı ekler", async () => {
    const listItems = vi
      .fn()
      .mockResolvedValueOnce({ items: [fakeItem()], total: 2 })
      .mockResolvedValueOnce({ items: [fakeItem({ id: 15, name: "Death Note" })], total: 2 });
    initLibraryList(document, source({ listItems }));
    await flush();
    expect(status()).toBe("Showing 1 of 2");
    const more = document.querySelector<HTMLButtonElement>("[data-more]")!;
    expect(more.hidden).toBe(false);
    more.click();
    await flush();
    expect(listItems).toHaveBeenLastCalledWith(expect.anything(), 1);
    expect(cards()).toHaveLength(2);
    expect(more.hidden).toBe(true);
    expect(document.activeElement?.textContent).toBe("Death Note");
  });

  it("sonuç yoksa boş durumu, filtre varsa temizle düğmesini gösterir", async () => {
    mount("?kind=shader");
    initLibraryList(document, source({ listItems: vi.fn(async () => ({ items: [], total: 0 })) }));
    await flush();
    const box = document.querySelector(".notice-empty")!;
    expect(box.textContent).toContain("No results");
    expect(box.querySelector("button")!.textContent).toBe("Clear filters");
  });

  it("hata olursa mesaj ve tekrar dene düğmesi gösterir", async () => {
    const listItems = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ items: [fakeItem()], total: 1 });
    initLibraryList(document, source({ listItems }));
    await flush();
    const alert = document.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Couldn't load the library");
    alert.querySelector("button")!.click();
    await flush();
    expect(cards()).toHaveLength(1);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("dil değişince kartlar yeni dilde çizilir", async () => {
    initLibraryList(document, source());
    await flush();
    setLang("tr", false);
    expect(status()).toBe("2 içerik");
    expect(cards()[0]!.textContent).toContain("Yükleyen: MehburMC");
  });
});
