// Kütüphane verisinin tipleri ve sunucuya bağlı olmayan (saf) yardımcılar:
// filtrelerin adres çubuğuna yazılması/okunması, Minecraft sürümlerinin ayıklanması,
// arama metninin güvenli hale getirilmesi. Hepsi testlerle doğrulanır (library.test.ts).

export const KINDS = ["mod", "modpack", "resourcepack", "shader"] as const;
export type Kind = (typeof KINDS)[number];

export const LOADERS = ["fabric", "quilt", "forge", "neoforge"] as const;
export type Loader = (typeof LOADERS)[number];

export const SORTS = ["new", "name"] as const;
export type Sort = (typeof SORTS)[number];

/** Sunucudaki library_public_list() fonksiyonunun döndürdüğü bir satır. */
export interface LibraryItem {
  id: number;
  kind: Kind;
  author: string;
  name: string;
  description: string;
  mod_id: string;
  version: string;
  loaders: string[];
  game_versions: string;
  sha1: string;
  size: number;
  file_name: string;
  /** Depodaki dosya yolu: <sahip>/<sha1>.<uzantı> */
  file_path: string;
  source: "launcher" | "web";
  created_at: string;
  approved_at: string;
}

export interface Filters {
  q: string;
  kind: Kind | null;
  loader: Loader | null;
  mc: string | null;
  sort: Sort;
}

export const DEFAULT_FILTERS: Filters = { q: "", kind: null, loader: null, mc: null, sort: "new" };

/** Arama kutusuna yazılabilecek en uzun metin. */
export const MAX_QUERY = 64;

const MC_VERSION = /^\d+(?:\.\d+){0,2}$/;

function oneOf<T extends string>(list: readonly T[], value: string | null): T | null {
  return value !== null && (list as readonly string[]).includes(value) ? (value as T) : null;
}

/** Adres çubuğundaki ?q=&kind=&loader=&mc=&sort= değerlerini okur; geçersiz olanlar yok sayılır. */
export function filtersFromParams(params: URLSearchParams): Filters {
  const mc = params.get("mc");
  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY),
    kind: oneOf(KINDS, params.get("kind")),
    loader: oneOf(LOADERS, params.get("loader")),
    mc: mc !== null && MC_VERSION.test(mc) ? mc : null,
    sort: oneOf(SORTS, params.get("sort")) ?? "new",
  };
}

/** Filtreleri adres çubuğu için yazar; varsayılan değerler adrese eklenmez. */
export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  const q = f.q.trim();
  if (q) p.set("q", q);
  if (f.kind) p.set("kind", f.kind);
  if (f.loader) p.set("loader", f.loader);
  if (f.mc) p.set("mc", f.mc);
  if (f.sort !== DEFAULT_FILTERS.sort) p.set("sort", f.sort);
  return p;
}

export function hasActiveFilters(f: Filters): boolean {
  return filtersToParams({ ...f, sort: DEFAULT_FILTERS.sort }).toString() !== "";
}

/**
 * Arama metnini sunucu sorgusuna güvenle konabilir hale getirir: sorgu dilinde özel anlamı
 * olan karakterler (virgül, parantez, yıldız, yüzde, tırnak, ters eğik çizgi, iki nokta)
 * atılır, boşluklar teke indirilir.
 */
export function searchTerm(q: string): string {
  return q
    .replace(/[,()*%"'\\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY);
}

/** "1.21.1", "26.2" gibi sürümleri sayısal olarak karşılaştırır (büyük olan önce gelsin diye). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * game_versions alanındaki sürüm numaralarını çıkarır. Alan mod dosyasından okunur ve
 * "~26.2", ">=1.20.1", "1.21.x" ya da "1.20.1 1.21" gibi yazılabilir.
 */
export function gameVersionsOf(raw: string): string[] {
  const found = raw.match(/\d+(?:\.\d+){1,2}/g) ?? [];
  return [...new Set(found)];
}

/** Filtre listesi için bütün içeriklerdeki farklı Minecraft sürümleri, en yenisi başta. */
export function versionOptions(rows: readonly { game_versions: string }[]): string[] {
  const all = new Set<string>();
  rows.forEach((r) => gameVersionsOf(r.game_versions).forEach((v) => all.add(v)));
  return [...all].sort((a, b) => compareVersions(b, a));
}

/** Ekranda gösterilecek Minecraft sürümü: "~26.2" → "26.2"; boşsa null. */
export function displayGameVersions(raw: string): string | null {
  const s = raw.replace(/~/g, "").replace(/\s+/g, " ").trim();
  return s || null;
}

const LOADER_NAMES: Record<string, string> = {
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

export function loaderName(id: string): string {
  return LOADER_NAMES[id] ?? id;
}

/** Detay sayfasının adresi. */
export function itemUrl(id: number): string {
  return `/item/?id=${id}`;
}

/** ?id= değerini okur; pozitif bir tam sayı değilse null. */
export function itemIdFromParams(params: URLSearchParams): number | null {
  const raw = params.get("id") ?? "";
  if (!/^\d{1,12}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}
