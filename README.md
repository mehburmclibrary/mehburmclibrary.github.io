# MehburMC Kütüphane

MehburMC topluluğunun paylaştığı modların, modpack'lerin, resource pack'lerin ve shader'ların
listelendiği site. [MehburMC Launcher](https://github.com/Mehbur07/MehburMC-Launcher) ile aynı
kütüphaneyi kullanır: launcher'dan ya da siteden yüklenen içerik iki yerde birden görünür.

**Canlı site:** https://mehburmclibrary.github.io

> **Durum:** Faz 1 (iskelet) tamamlandı: tasarım, açık/koyu tema ve TR/EN dil desteği hazır.
> Kütüphane listesi Faz 3'te gelecek. Fazlar için [ROADMAP.md](ROADMAP.md), değişiklikler için
> [CHANGELOG.md](CHANGELOG.md) dosyasına bak.

## Özellikler

- Açık / koyu tema: ilk açılışta bilgisayarın teması kullanılır, seçim hatırlanır
- Türkçe / İngilizce: ilk açılışta tarayıcının dili kullanılır, seçim hatırlanır
- Telefon, tablet ve bilgisayarda düzgün görünür; klavye ve ekran okuyucuyla kullanılabilir
- Görünüm [MehburMC Launcher sitesi](https://mehburmc.github.io) ile aynıdır

## Teknik bilgiler

|                  |                                            |
| ---------------- | ------------------------------------------ |
| Dil              | TypeScript                                 |
| Derleme aracı    | Vite                                       |
| Paket yöneticisi | pnpm                                       |
| Testler          | Vitest                                     |
| Kod kalitesi     | ESLint + Prettier                          |
| Yayın            | GitHub Pages (GitHub Actions ile otomatik) |

## Kendi bilgisayarında çalıştırma

Gerekenler: [Node.js](https://nodejs.org) 24 ve [pnpm](https://pnpm.io).

```bash
pnpm install     # bağımlılıkları kur
pnpm dev         # geliştirme sunucusu: http://localhost:5173
pnpm check       # tür kontrolü + lint + testler + derleme (push öncesi)
pnpm build       # yayına hazır site dist/ klasörüne çıkar
```

## Klasör yapısı

```
index.html, 404.html   Sayfalar (her sayfa src/pages/ içinde bir giriş dosyasına bağlanır)
src/shell.ts           Her sayfada ortak üst menü ve alt bilgi
src/lib/               Tema, dil ve tarayıcı hafızası yardımcıları (+ testleri)
src/i18n/              Türkçe (ana kaynak) ve İngilizce metinler
src/styles/            Stiller: tokens.css (renkler), base.css, shell.css, sayfa stilleri
src/fonts/             Yazı tipleri ve lisansları
public/                Olduğu gibi kopyalanan dosyalar (ikonlar, manifest, robots.txt)
```

Yeni bir metin eklerken önce `src/i18n/tr.ts`'e, sonra aynı anahtarla `src/i18n/en.ts`'e yaz;
İngilizcesi eksik kalırsa TypeScript hata verir.

## Yayın

`main` branch'ine gelen her değişiklikten sonra GitHub Actions testleri çalıştırır; geçerse siteyi
GitHub Pages'e yayınlar. `main`'e doğrudan push kapalıdır, değişiklikler Pull Request ile girer.

## Lisans

Site kodu [GPL-3.0](LICENSE) lisanslıdır. MehburMC logosu ve ikonları lisansa dahil değildir.
Yazı tipleri kendi lisanslarıyla gelir (`src/fonts/LICENSE-*.txt`).

Minecraft, Mojang AB'nin ticari markasıdır. MehburMC; Mojang veya Microsoft ile bağlantılı değildir.
