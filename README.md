# MehburMC Kütüphane

MehburMC topluluğunun paylaştığı modların, modpack'lerin, resource pack'lerin ve shader'ların
listelendiği site. [MehburMC Launcher](https://github.com/Mehbur07/MehburMC-Launcher) ile aynı
kütüphaneyi kullanır: launcher'dan ya da siteden yüklenen içerik iki yerde birden görünür.

**Canlı site:** https://mehburmclibrary.github.io

> **Durum:** Kütüphane vitrini hazır: onaylı içerik giriş yapmadan aranıp indirilebilir. Hesap
> ve yükleme sonraki fazlarda gelecek. Fazlar için [ROADMAP.md](ROADMAP.md), değişiklikler için
> [CHANGELOG.md](CHANGELOG.md) dosyasına bak.

## Özellikler

- Kütüphane (`/library/`): ad, yükleyen ya da açıklamaya göre arama; tür, loader ve Minecraft
  sürümüne göre filtre; en yeni / ada göre sıralama. Filtreler adres çubuğunda tutulur, arama
  bağlantı olarak paylaşılabilir
- İçerik sayfası (`/item/?id=…`): bilgiler, kurulum ipucu, SHA-1 ve giriş yapmadan indirme
- Ana sayfada son eklenen içerikler
- Açık / koyu tema: ilk açılışta bilgisayarın teması kullanılır, seçim hatırlanır
- Türkçe / İngilizce: ilk açılışta tarayıcının dili kullanılır, seçim hatırlanır
- Telefon, tablet ve bilgisayarda düzgün görünür; klavye ve ekran okuyucuyla kullanılabilir
- Görünüm [MehburMC Launcher sitesi](https://mehburmc.github.io) ile aynıdır

## Teknik bilgiler

|                  |                                             |
| ---------------- | ------------------------------------------- |
| Dil              | TypeScript                                  |
| Derleme aracı    | Vite                                        |
| Paket yöneticisi | pnpm                                        |
| Veri             | Supabase (MehburMC Launcher ile aynı proje) |
| Testler          | Vitest                                      |
| Kod kalitesi     | ESLint + Prettier                           |
| Yayın            | GitHub Pages (GitHub Actions ile otomatik)  |

## Kendi bilgisayarında çalıştırma

Gerekenler: [Node.js](https://nodejs.org) 24 ve [pnpm](https://pnpm.io).

Önce `.env.example` dosyasını `.env` adıyla kopyala ve Supabase adresini ve **anon** anahtarını
yaz (Supabase → Project Settings → API). `.env` git'e girmez. Anon anahtar herkese açıktır; neye
izin verildiğini sunucudaki kurallar belirler. `service_role` anahtarı asla buraya yazılmaz.

```bash
pnpm install     # bağımlılıkları kur
pnpm dev         # geliştirme sunucusu: http://localhost:5173
pnpm check       # tür kontrolü + lint + testler + derleme (push öncesi)
pnpm build       # yayına hazır site dist/ klasörüne çıkar
```

## Klasör yapısı

```
index.html, 404.html   Sayfalar (her sayfa src/pages/ içinde bir giriş dosyasına bağlanır)
library/, item/        Kütüphane listesi ve içerik sayfası
src/shell.ts           Her sayfada ortak üst menü ve alt bilgi
src/features/          Sayfaların davranışı: liste, içerik sayfası, son eklenenler (+ testleri)
src/components/        İçerik kartı, tür rozeti, yükleniyor / boş / hata kutuları
src/lib/               Supabase bağlantısı (api.ts), filtreler, tema, dil, biçimler (+ testleri)
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
Yayın derlemesi Supabase ayarlarını repo değişkenlerinden alır (Settings → Secrets and variables →
Actions → Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Sunucu tarafı ve indirme kotası

Veritabanı kuralları launcher reposundadır (`supabase/library_web.sql`): site yalnızca onaylı
içeriği görür, giriş yapmadan yalnızca onaylı dosyaları indirebilir.

Her indirme Supabase'in aylık **veri aktarımı (egress)** kotasından düşer; ücretsiz planda bu
kota sınırlıdır. Kullanımı Supabase panelinde **Organization → Usage → Egress** bölümünden takip
et. Kota dolmaya yaklaşırsa indirmeler hem sitede hem launcher'da durabilir; o zaman planı
yükseltmek ya da büyük dosyaları başka bir yerde barındırmak gerekir.

## Lisans

Site kodu [GPL-3.0](LICENSE) lisanslıdır. MehburMC logosu ve ikonları lisansa dahil değildir.
Yazı tipleri kendi lisanslarıyla gelir (`src/fonts/LICENSE-*.txt`).

Minecraft, Mojang AB'nin ticari markasıdır. MehburMC; Mojang veya Microsoft ile bağlantılı değildir.
