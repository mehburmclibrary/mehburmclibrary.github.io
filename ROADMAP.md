# Yol Haritası

Her faz ayrı branch'te yapılır ve Pull Request ile `main`'e alınır. Launcher reposuna dokunan
fazlar (2 ve 6) launcher reposunda ayrı PR olarak açılır.

## Faz 0: Hazırlık ✅

- `mehburmclibrary` organization'ı açıldı
- Supabase → Authentication → Redirect URLs: site adresi ve `http://localhost:5173/**` eklendi
- `mmc-site`'tan tasarım ögeleri (renkler, fontlar, ikonlar) çıkarıldı

## Faz 1: İskelet ✅ (v0.1.0)

- Vite + TypeScript + pnpm
- Üst menü, alt bilgi, 404 sayfası (`mmc-site` tasarımıyla)
- Açık/koyu tema ve TR/EN anahtarı (seçimler hatırlanır)
- GitHub Actions ile otomatik yayın, branch koruması, Dependabot
- Lint ve test altyapısı

## Faz 2: Veritabanı eklemesi (launcher reposu) ✅

Launcher v0.33.0, `supabase/library_web.sql` (MehburMC-Launcher PR #10). Supabase'de çalıştırıldı.

- `library_public_list()`: giriş yapmadan çağrılır, yalnızca onaylı içerik; sahip kimliği sütunu,
  tarama raporu ve admin notları yok. İndirme yolu `file_path` alanında. Arama, süzgeç ve sayfalama
  PostgREST parametreleriyle (`kind=eq.mod`, `loaders=cs.{fabric}`, `limit`, `offset`)
- Onaylı dosyalar için girişsiz indirme izni (imzalı bağlantı da çalışır)
- `submit_library_mod(..., p_source => 'web')`: siteden gelen yükleme "Siteden yüklendi" rozetiyle
  admin kuyruğunda görünür
- Launcher'ın kendi liste fonksiyonu giriş yapmamış ziyaretçiye kapatıldı
- `library_web_test.sql` → `LIBRARY_WEB_OK`

## Faz 3: Kütüphane vitrini ✅ (v0.2.0)

- `/library/`: arama, filtreler (tür / loader / Minecraft sürümü), sıralama, "daha fazla göster";
  filtreler adres çubuğunda
- `/item/?id=…`: bilgiler, kurulum ipucu, SHA-1, girişsiz indirme (kısa süreli imzalı bağlantı)
- Ana sayfada son eklenenler; tür kartları ilgili filtreye gider
- Yükleniyor / boş / hata durumları, mobil uyum, iki dil
- Supabase indirme kotası (egress): README'de nasıl izleneceği yazıyor

## Faz 4: Hesap sistemi

- E-posta + şifre ile giriş, kayıt, 6 haneli kodla e-posta onayı, şifre sıfırlama, çıkış
- Google ile giriş
- Hesap adı (oyuncu adı) kontrolü / oluşturma
- Banlı kullanıcıya durumunu gösterme

## Faz 5: Mod yükleme (v1.0.0)

- Sürükle-bırak dosya seçimi
- Dosyadan ad / sürüm / loader / Minecraft sürümünü otomatik okuma (4 içerik türü için)
- Basit güvenlik kontrolü; yükleme "web'den geldi" işaretiyle admin onayına düşer
- "Yüklediklerim": beklemede / onaylandı / reddedildi + admin notu
- Yüklemeyi geri çekme, şikâyet etme

## Faz 6: "Launcher'da aç" (launcher reposu)

- Launcher'a `mehburmc://` deep link desteği
- Sitede buton; launcher kurulu değilse indirme sayfasına yönlendirme
- Yeni launcher sürümü gerektirir

## Faz 7: Cilalama

- SEO: sitemap, paylaşım önizleme görselleri
- Erişilebilirlik ve performans kontrolleri

## Bilinen riskler

- **Supabase indirme kotası:** Girişsiz indirme, ücretsiz plandaki aylık veri aktarımını hızlı
  tüketebilir. Supabase → Usage → Egress'ten düzenli bakılmalı (bkz. README).
- **picomatch (high):** Yalnızca geliştirme araçlarında kullanılan bir pakette güvenlik açığı var,
  düzeltilmiş sürümü henüz yok. Yayınlanan siteye girmez; Dependabot ile takip ediliyor.
