# MehburMC Kütüphane

MehburMC topluluğunun paylaştığı modların, modpack'lerin, resource pack'lerin ve shader'ların
listelendiği site. [MehburMC Launcher](https://github.com/Mehbur07/MehburMC-Launcher) ile aynı
kütüphaneyi kullanır: launcher'dan ya da siteden yüklenen içerik iki yerde birden görünür.

**Canlı site:** https://mehburmclibrary.github.io

> **Durum:** Kütüphane vitrini, hesap sistemi ve siteden yükleme hazır. Onaylı içerik giriş
> yapmadan aranıp indirilebilir; MehburMC hesabıyla giriş yapıp mod, modpack, resource pack ve
> shader yüklenebilir. Fazlar için [ROADMAP.md](ROADMAP.md), değişiklikler için
> [CHANGELOG.md](CHANGELOG.md) dosyasına bak.

## Özellikler

- Kütüphane (`/library/`): ad, yükleyen ya da açıklamaya göre arama; tür, loader ve Minecraft
  sürümüne göre filtre; en yeni / ada göre sıralama. Filtreler adres çubuğunda tutulur, arama
  bağlantı olarak paylaşılabilir
- İçerik sayfası (`/item/?id=…`): bilgiler, kurulum ipucu, SHA-1 ve giriş yapmadan indirme
- Ana sayfada son eklenen içerikler
- Hesap (`/account/`): MehburMC Launcher ile aynı hesap. E-posta + şifre ile giriş ve kayıt
  (6 haneli e-posta kodu), şifre sıfırlama, Google ile giriş, ban durumu, hesap adları
- Yükleme (`/upload/`): tür seç → sürükle-bırak → dosya tarayıcıda otomatik kontrol edilir →
  ad / açıklama / yükleyen adı → yöneticilerin onayına "siteden" işaretiyle düşer
- Yüklediklerim (`/uploads/`): onay bekliyor / yayında / reddedildi, yönetici notu, geri çekme
- İçerik sayfasında "Şikâyet et"
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
src/lib/scan/          Dosya tarayıcısı: launcher'daki tarayıcının birebir karşılığı (+ testleri)
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

Derleme sırasında `sitemap.xml` de üretilir (`vite.config.ts` → `src/lib/sitemap.ts`): sabit
sayfalar ve onaylı her içerik. Supabase'e ulaşılamazsa derleme bozulmaz, yalnızca sabit sayfalar
yazılır. Sitemap her yayında yenilenir. Paylaşım önizleme görseli `public/og-image.jpg`; kaynağı
`scripts/og-image.html` (dosyadaki açıklamaya bakın).

## Dosya tarayıcısı

Yüklenecek dosya, gönderilmeden önce tarayıcıda (arka planda, Web Worker ile) kontrol edilir.
`src/lib/scan/` MehburMC Launcher'daki tarayıcının (`crates/launcher-core/src/content/scan.rs`,
sürüm 2) birebir TypeScript karşılığıdır: aynı kurallar, aynı bulgu kodları, aynı rapor. Sunucu
raporu yüklemeyle birlikte saklar; yöneticiler onaylamadan önce dosyayı kendi launcher'larında
yeniden tarar.

Launcher'ın testleri `scan.test.ts`'e taşındı. Ayrıca iki tarayıcı 462 dosyada (288 gerçek mod ve
paket, launcher test dosyaları ve bilerek bozulmuş kopyalar) karşılaştırıldı: gerçek ve test
dosyalarının hepsinde rapor birebir aynı; yalnızca içindekiler bölümü bozuk birkaç zip'te site
daha katı davranıp reddediyor (launcher'ın reddettiğini sitenin kabul ettiği bir durum yok).
Launcher'daki kurallar değişirse bu klasör de aynı şekilde güncellenmelidir.

## Sunucu tarafı ve indirme kotası

Veritabanı kuralları launcher reposundadır: `supabase/library_web.sql` (site yalnızca onaylı
içeriği görür, giriş yapmadan yalnızca onaylı dosyaları indirebilir) ve `supabase/site_account.sql`
(giriş yapan kullanıcı kendi hesap adlarını görür). SQL dosyaları Supabase → SQL Editor'de, her
zaman **launcher'ın projesinde** çalıştırılır.

Giriş için Supabase → Authentication → URL Configuration → Redirect URLs listesinde
`https://mehburmclibrary.github.io/**` ve geliştirme için `http://localhost:5173/**` bulunmalıdır
(Google ile girişten dönüş ve e-posta bağlantıları buraya gelir).

Her indirme Supabase'in aylık **veri aktarımı (egress)** kotasından düşer; ücretsiz planda bu
kota sınırlıdır. Kullanımı Supabase panelinde **Organization → Usage → Egress** bölümünden takip
et. Kota dolmaya yaklaşırsa indirmeler hem sitede hem launcher'da durabilir; o zaman planı
yükseltmek ya da büyük dosyaları başka bir yerde barındırmak gerekir.

## Lisans

Site kodu [GPL-3.0](LICENSE) lisanslıdır. MehburMC logosu ve ikonları lisansa dahil değildir.
Yazı tipleri kendi lisanslarıyla gelir (`src/fonts/LICENSE-*.txt`).

Minecraft, Mojang AB'nin ticari markasıdır. MehburMC; Mojang veya Microsoft ile bağlantılı değildir.
