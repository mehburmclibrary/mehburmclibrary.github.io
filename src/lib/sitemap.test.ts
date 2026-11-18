import { describe, expect, it, vi } from "vitest";
import { buildSitemap, fetchSitemapItems } from "./sitemap";

describe("sitemap", () => {
  it("sabit sayfaları ve onaylı içerikleri tarihleriyle listeler", () => {
    const xml = buildSitemap([
      { id: 18, approved_at: "2026-11-03T10:00:00Z" },
      { id: 21, approved_at: null },
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<loc>https://mehburmclibrary.github.io/</loc>");
    expect(xml).toContain("<loc>https://mehburmclibrary.github.io/library/</loc>");
    expect(xml).toContain(
      "<loc>https://mehburmclibrary.github.io/item/?id=18</loc>\n    <lastmod>2026-11-03</lastmod>",
    );
    expect(xml).toContain("<loc>https://mehburmclibrary.github.io/item/?id=21</loc>\n  </url>");
    expect(xml.match(/<url>/g)).toHaveLength(4);
  });

  it("giriş gerektiren sayfaları listelemez", () => {
    const xml = buildSitemap([]);
    for (const p of ["/account/", "/upload/", "/uploads/"]) expect(xml).not.toContain(p);
  });

  it("geçersiz ve tekrar eden kimlikleri atlar", () => {
    const xml = buildSitemap([
      { id: 5, approved_at: "x" },
      { id: 5, approved_at: null },
      { id: 0, approved_at: null },
      { id: -3, approved_at: null },
      { id: 1.5, approved_at: null },
    ]);
    expect(xml.match(/item\/\?id=/g)).toHaveLength(1);
    expect(xml).not.toContain("<lastmod>");
  });

  it("listeyi girişsiz anahtarla ister, hata olursa fırlatır", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify([{ id: 1, approved_at: null }])));
    await expect(fetchSitemapItems("https://x.supabase.co/", "anon", ok)).resolves.toEqual([
      { id: 1, approved_at: null },
    ]);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://x.supabase.co/rest/v1/rpc/library_public_list?select=id,approved_at&order=id.asc",
    );
    expect((init.headers as Record<string, string>).apikey).toBe("anon");

    const bad = vi.fn(async () => new Response("no", { status: 500 }));
    await expect(fetchSitemapItems("https://x.supabase.co", "anon", bad)).rejects.toThrow("500");
  });
});
