import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  compareVersions,
  displayGameVersions,
  filtersFromParams,
  filtersToParams,
  gameVersionsOf,
  hasActiveFilters,
  itemIdFromParams,
  searchTerm,
  versionOptions,
} from "./library";

const params = (s: string) => new URLSearchParams(s);

describe("filtreler ve adres çubuğu", () => {
  it("geçerli değerleri okur", () => {
    expect(filtersFromParams(params("q=golem&kind=mod&loader=fabric&mc=26.2&sort=name"))).toEqual({
      q: "golem",
      kind: "mod",
      loader: "fabric",
      mc: "26.2",
      sort: "name",
    });
  });

  it("geçersiz değerleri yok sayar", () => {
    expect(filtersFromParams(params("kind=datapack&loader=rift&mc=1.2;drop&sort=size"))).toEqual(
      DEFAULT_FILTERS,
    );
  });

  it("çok uzun aramayı kırpar", () => {
    expect(filtersFromParams(params(`q=${"a".repeat(200)}`)).q).toHaveLength(64);
  });

  it("varsayılanları adrese yazmaz ve geri okunabilir", () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
    const f = { q: "death note", kind: "shader", loader: null, mc: "1.21", sort: "new" } as const;
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
  });

  it("sıralama tek başına filtre sayılmaz", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: "name" })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, loader: "quilt" })).toBe(true);
  });
});

describe("searchTerm", () => {
  it("sorgu dilinde özel anlamı olan karakterleri atar", () => {
    expect(searchTerm(" a,b(c)*d%e\"f'g\\h:i ")).toBe("a b c d e f g h i");
  });
  it("Türkçe harfleri ve noktaları korur", () => {
    expect(searchTerm("Garip Şeyler 1.0")).toBe("Garip Şeyler 1.0");
  });
});

describe("Minecraft sürümleri", () => {
  it("farklı yazımlardan sürümleri çıkarır", () => {
    expect(gameVersionsOf("~26.2")).toEqual(["26.2"]);
    expect(gameVersionsOf(">=1.20.1 <1.21")).toEqual(["1.20.1", "1.21"]);
    expect(gameVersionsOf("1.21.x")).toEqual(["1.21"]);
    expect(gameVersionsOf("*")).toEqual([]);
  });

  it("seçenekleri tekrarsız ve en yenisi başta verir", () => {
    expect(
      versionOptions([
        { game_versions: "1.20.1" },
        { game_versions: "~26.2" },
        { game_versions: "1.21 1.20.1" },
      ]),
    ).toEqual(["26.2", "1.21", "1.20.1"]);
  });

  it("sürümleri sayısal karşılaştırır", () => {
    expect(compareVersions("1.21.10", "1.21.9")).toBeGreaterThan(0);
    expect(compareVersions("1.21", "1.21.0")).toBe(0);
  });

  it("ekranda ~ işaretini göstermez", () => {
    expect(displayGameVersions("~26.2")).toBe("26.2");
    expect(displayGameVersions("  ")).toBeNull();
  });
});

describe("itemIdFromParams", () => {
  it("yalnızca pozitif tam sayıları kabul eder", () => {
    expect(itemIdFromParams(params("id=18"))).toBe(18);
    expect(itemIdFromParams(params("id=0"))).toBeNull();
    expect(itemIdFromParams(params("id=-3"))).toBeNull();
    expect(itemIdFromParams(params("id=18abc"))).toBeNull();
    expect(itemIdFromParams(params(""))).toBeNull();
  });
});
