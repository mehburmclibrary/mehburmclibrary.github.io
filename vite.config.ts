/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { buildSitemap, fetchSitemapItems, type SitemapItem } from "./src/lib/sitemap.ts";

// Site birden fazla gerçek HTML sayfasından oluşur (GitHub Pages'te her sayfa
// kendi adresiyle doğrudan açılabilsin diye). Yeni sayfa eklenince buraya da yazılır.
const pages = {
  main: resolve(import.meta.dirname, "index.html"),
  notFound: resolve(import.meta.dirname, "404.html"),
  library: resolve(import.meta.dirname, "library/index.html"),
  item: resolve(import.meta.dirname, "item/index.html"),
  account: resolve(import.meta.dirname, "account/index.html"),
  upload: resolve(import.meta.dirname, "upload/index.html"),
  uploads: resolve(import.meta.dirname, "uploads/index.html"),
};

/**
 * Derlemenin sonunda dist/sitemap.xml'i yazar: sabit sayfalar + onaylı her içerik. Supabase'e
 * ulaşılamazsa (bağlantı bilgisi yok, ağ yok) derleme bozulmaz, yalnızca sabit sayfalar yazılır.
 */
function sitemap(env: Record<string, string>): Plugin {
  return {
    name: "mmclib-sitemap",
    apply: "build",
    async generateBundle() {
      let items: SitemapItem[] = [];
      const url = env.VITE_SUPABASE_URL;
      const key = env.VITE_SUPABASE_ANON_KEY;
      if (url && key) {
        try {
          items = await fetchSitemapItems(url, key);
        } catch (e) {
          this.warn(`sitemap: içerik listesi alınamadı, yalnızca sabit sayfalar yazılıyor (${e})`);
        }
      } else {
        this.warn("sitemap: Supabase bağlantı bilgisi yok, yalnızca sabit sayfalar yazılıyor");
      }
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: buildSitemap(items) });
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Site, alan adının kökünde yayınlanır: https://mehburmclibrary.github.io/
  base: "/",
  build: {
    target: "es2022",
    rolldownOptions: { input: pages },
  },
  plugins: [
    sitemap({ ...loadEnv(mode, import.meta.dirname, "VITE_"), ...process.env } as Record<
      string,
      string
    >),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
}));
