// Türkçe metinler. Ana kaynak budur: buraya eklenen her anahtar en.ts'de de olmalıdır
// (olmazsa TypeScript hata verir).
export const tr = {
  "meta.homeTitle": "MehburMC Kütüphane · Mod, modpack, resource pack ve shader",
  "meta.homeDescription":
    "MehburMC topluluğunun paylaştığı modlar, modpack'ler, resource pack'ler ve shader'lar. Launcher'dan ya da siteden yüklenen içerik iki yerde birden görünür.",
  "meta.notFoundTitle": "Sayfa bulunamadı · MehburMC Kütüphane",

  skip: "İçeriğe geç",
  "brand.suffix": "Kütüphane",
  "brand.home": "MehburMC Kütüphane ana sayfası",
  "nav.label": "Ana menü",
  "nav.library": "Kütüphane",
  "nav.getLauncher": "Launcher'ı indir",
  "nav.openMenu": "Menüyü aç",
  "nav.closeMenu": "Menüyü kapat",
  "theme.toLight": "Açık temaya geç",
  "theme.toDark": "Koyu temaya geç",
  "lang.label": "Dil seçimi",
  external: "(yeni sekmede açılır)",

  "home.chip": "Yapım aşamasında",
  "home.lead":
    "MehburMC topluluğunun paylaştığı modlar, modpack'ler, resource pack'ler ve shader'lar tek yerde. Launcher'dan ya da buradan yüklenen her içerik iki yerde birden görünür.",
  "home.soon": "Kütüphane listesi çok yakında burada olacak.",
  "home.ctaLauncher": "Launcher'ı indir",
  "home.ctaSource": "Kaynak kod",

  "kinds.title": "Neler bulacaksın",
  "kinds.lead": "Kütüphanede dört tür içerik paylaşılabilir.",
  "kinds.mod": "Modlar",
  "kinds.modText":
    "Fabric, Quilt, Forge ve NeoForge için oyuna yeni özellikler katan .jar dosyaları.",
  "kinds.modpack": "Modpack'ler",
  "kinds.modpackText": "Birlikte çalışacak şekilde hazırlanmış, tek seferde kurulan mod paketleri.",
  "kinds.resourcepack": "Resource pack'ler",
  "kinds.resourcepackText": "Dokuları, sesleri ve arayüzü değiştiren paketler.",
  "kinds.shader": "Shader'lar",
  "kinds.shaderText": "Işığı, gölgeleri ve suyu yeniden çizen görsel paketler.",

  "how.title": "Nasıl çalışır",
  "how.lead": "Kütüphane, MehburMC Launcher ile aynı yerden beslenir.",
  "how.upload": "Yükle",
  "how.uploadText": "MehburMC hesabınla içeriğini launcher'dan ya da bu siteden yükle.",
  "how.review": "Onay",
  "how.reviewText": "Yöneticiler her yüklemeyi inceler; onaylanmayan içerik yayınlanmaz.",
  "how.share": "Paylaş",
  "how.shareText": "Onaylanan içerik hem launcher'da hem bu sitede herkese açılır.",

  "footer.about": "MehburMC topluluğunun mod paylaşım yeri.",
  "footer.links": "Bağlantılar",
  "footer.launcherSite": "Launcher sitesi",
  "footer.source": "Kaynak kod",
  "footer.bug": "Hata bildir",
  "footer.license": "Lisans (GPL-3.0)",
  "footer.copy": "Site kodu GPL-3.0 lisansı ile açık kaynaklıdır.",
  "footer.legal":
    "Minecraft, Mojang AB'nin ticari markasıdır. MehburMC; Mojang veya Microsoft ile bağlantılı değildir.",

  "notFound.title": "Sayfa bulunamadı",
  "notFound.text": "Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.",
  "notFound.home": "Ana sayfaya dön",
} as const;

export type MessageKey = keyof typeof tr;
