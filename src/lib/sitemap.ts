// sitemap.xml üretimi (derleme sırasında vite.config.ts'teki eklenti çağırır). Sabit sayfalar
// ve onaylı her içeriğin /item/?id= sayfası listelenir. Giriş gerektiren sayfalar (hesap,
// yükleme) ve 404 bilerek yok: onlar noindex.

export const SITE_URL = "https://mehburmclibrary.github.io";

/** Arama motorlarının bilmesi istenen sabit sayfalar. */
export const STATIC_PAGES = ["/", "/library/"] as const;

export interface SitemapItem {
  id: number;
  /** RFC 3339; sitemap'te yalnızca tarih kısmı kullanılır. */
  approved_at: string | null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entry(path: string, lastmod?: string): string {
  const loc = `    <loc>${escapeXml(SITE_URL + path)}</loc>`;
  const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>\n${loc}${mod}\n  </url>`;
}

/** YYYY-MM-DD; tarih geçersizse undefined. */
function day(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export function buildSitemap(items: readonly SitemapItem[]): string {
  const seen = new Set<number>();
  const urls = STATIC_PAGES.map((p) => entry(p));
  for (const it of items) {
    // Yalnızca geçerli kimlikler (sayfa da ?id= değerini aynı kuralla okur)
    if (!Number.isSafeInteger(it.id) || it.id <= 0 || seen.has(it.id)) continue;
    seen.add(it.id);
    urls.push(entry(`/item/?id=${it.id}`, day(it.approved_at)));
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/**
 * Onaylı içeriklerin kimlik ve onay tarihlerini Supabase'den okur (girişsiz,
 * library_public_list()). Supabase tek istekte en çok 1000 satır döndürür; kütüphane bunu
 * geçerse sitemap ilk 1000 içerikle sınırlı kalır (sayfalar yine de bağlantılardan bulunur).
 * Bağlantı bilgisi yoksa ya da istek başarısızsa hata fırlatır; çağıran taraf sabit
 * sayfalarla devam eder.
 */
export async function fetchSitemapItems(
  url: string,
  anonKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SitemapItem[]> {
  const res = await fetchImpl(
    `${url.replace(/\/$/, "")}/rest/v1/rpc/library_public_list?select=id,approved_at&order=id.asc`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!res.ok) throw new Error(`library_public_list: HTTP ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("library_public_list: beklenmeyen cevap");
  return data as SitemapItem[];
}
