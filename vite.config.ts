/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig } from "vite";

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

export default defineConfig({
  // Site, alan adının kökünde yayınlanır: https://mehburmclibrary.github.io/
  base: "/",
  build: {
    target: "es2022",
    rolldownOptions: { input: pages },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
