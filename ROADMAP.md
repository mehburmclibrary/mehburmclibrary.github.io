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

## Faz 2: Veritabanı eklemesi (launcher reposu)

- Giriş yapmadan çağrılabilen liste fonksiyonu: yalnızca onaylı içerik, gizli alanlar hariç
  (sahip kimliği, tarama detayları, admin notları)
- Onaylı dosyalar için girişsiz indirme izni
- Siteden gelen yüklemeler için "web'den yüklendi" işareti + launcher admin panelinde gösterimi
- `_test.sql` dosyası; SQL, Supabase SQL Editor'de elle çalıştırılır

## Faz 3: Kütüphane vitrini (v0.2.0)

- Liste, arama, filtreler (tür / loader / Minecraft sürümü), sıralama
- Detay sayfası, girişsiz indirme
- Yükleniyor / boş / hata durumları, mobil uyum
- Supabase indirme kotasının (egress) izlenmesi

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
  tüketebilir. Faz 3'te izlenecek.
- **picomatch (high):** Yalnızca geliştirme araçlarında kullanılan bir pakette güvenlik açığı var,
  düzeltilmiş sürümü henüz yok. Yayınlanan siteye girmez; Dependabot ile takip ediliyor.
