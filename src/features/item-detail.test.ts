import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../lib/i18n";
import { initItemDetail, type ItemSource } from "./item-detail";
import { fakeItem, flush } from "./test-helpers";

const html = readFileSync(resolve(import.meta.dirname, "../../item/index.html"), "utf8");

function mount(search: string) {
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, "");
  history.replaceState(null, "", `/item/${search}`);
}

function source(overrides: Partial<ItemSource> = {}): ItemSource {
  return {
    getItem: vi.fn(async () => fakeItem()),
    downloadUrl: vi.fn(async () => "https://example.test/signed"),
    ...overrides,
  };
}

const box = () => document.querySelector("[data-item]")!;

describe("içerik detay sayfası", () => {
  beforeEach(() => setLang("en", false));

  it("içeriğin bilgilerini, kurulum ipucunu ve başlığı gösterir", async () => {
    mount("?id=18");
    const src = source();
    initItemDetail(document, src);
    await flush();
    expect(src.getItem).toHaveBeenCalledWith(18);
    expect(box().querySelector("h1")!.textContent).toBe("Iron Golem Troll");
    expect(document.title).toBe("Iron Golem Troll · MehburMC Library");
    expect(box().textContent).toContain("Required loader: Fabric / Quilt");
    expect(box().textContent).toContain("26.2");
    expect(box().querySelector("code")!.textContent).toBe(fakeItem().sha1);
    expect(box().getAttribute("aria-busy")).toBe("false");
  });

  it("türe göre kurulum ipucu verir", async () => {
    mount("?id=5");
    initItemDetail(
      document,
      source({ getItem: vi.fn(async () => fakeItem({ kind: "shader", loaders: [] })) }),
    );
    await flush();
    expect(box().textContent).toContain("Requires Iris or OptiFine");
  });

  it("İndir düğmesi imzalı bağlantıya gider", async () => {
    mount("?id=18");
    const navigate = vi.fn();
    const src = source();
    initItemDetail(document, src, navigate);
    await flush();
    box().querySelector<HTMLButtonElement>("[data-focus=download]")!.click();
    await flush();
    expect(src.downloadUrl).toHaveBeenCalledWith(fakeItem());
    expect(navigate).toHaveBeenCalledWith("https://example.test/signed");
  });

  it("indirme başlatılamazsa hata yazar", async () => {
    mount("?id=18");
    const navigate = vi.fn();
    initItemDetail(
      document,
      source({ downloadUrl: vi.fn(async () => Promise.reject(new Error("quota"))) }),
      navigate,
    );
    await flush();
    box().querySelector<HTMLButtonElement>("[data-focus=download]")!.click();
    await flush();
    expect(navigate).not.toHaveBeenCalled();
    expect(box().querySelector('[role="alert"]')!.textContent).toContain("couldn't start");
  });

  it("geçersiz ya da onaylı olmayan içerik için 'bulunamadı' gösterir", async () => {
    mount("?id=abc");
    const src = source();
    initItemDetail(document, src);
    await flush();
    expect(src.getItem).not.toHaveBeenCalled();
    expect(box().textContent).toContain("Item not found");

    mount("?id=99");
    initItemDetail(document, source({ getItem: vi.fn(async () => null) }));
    await flush();
    expect(box().textContent).toContain("Item not found");
  });

  it("sunucu hatasında tekrar dene düğmesi çalışır", async () => {
    mount("?id=18");
    const getItem = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(fakeItem());
    initItemDetail(document, source({ getItem }));
    await flush();
    box().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await flush();
    expect(box().querySelector("h1")!.textContent).toBe("Iron Golem Troll");
  });

  it("açıklamadaki HTML düz yazı olarak görünür", async () => {
    mount("?id=18");
    const evil = "<script>window.hacked=1</script><b>kalın</b>";
    initItemDetail(
      document,
      source({ getItem: vi.fn(async () => fakeItem({ description: evil })) }),
    );
    await flush();
    expect(box().querySelector(".item-description")!.textContent).toBe(evil);
    expect(box().querySelector(".item-description b")).toBeNull();
  });
});
