# İlerleme Kaydı

### [2026-11-18 - Mehbur07]

- **Yapılanlar & Kararlar:**
  - Dependabot PR #1 kapatıldı; `@types/node` büyük sürüm güncellemeleri yok sayılıyor (PR #2).
    `v0.1.0` tag'i ve GitHub sürümü (PR #3)
  - Faz 2 (launcher PR #10, launcher v0.33.0): `supabase/library_web.sql` Supabase'de çalıştırıldı
    ve canlıda doğrulandı. Girişsiz `library_public_list()`, onaylı dosyaları girişsiz indirme,
    `source` = `web` işareti; launcher'ın `library_list`'i ziyaretçiye kapatıldı
  - Faz 3: `/library/` (arama, filtre, sıralama, sayfalama; filtreler adreste), `/item/?id=` (bilgi,
    kurulum ipucu, SHA-1, imzalı bağlantıyla indirme), ana sayfada son eklenenler
  - `@supabase/supabase-js` 2.119.0 eklendi (Faz 4'teki giriş de bunu kullanacak). Bağlantı
    `.env`'den; CI için repo değişkenleri `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  - Kullanıcı metinleri hep `textContent` ile yazılıyor (XSS testi var); arama metni sorguya
    girmeden önce özel karakterlerden arındırılıyor
- **Son Commit:** a0e08c0 Merge pull request #4 from mehburmclibrary/docs/phase-2-done
- **Aktif Branch:** feature/library-showcase
- **Sıradaki İlk İş (Next Action):** Faz 3 PR'ı merge edilince `v0.2.0` tag'i önerilecek;
  kullanıcı "başla" derse Faz 4 (hesap sistemi)
- **Bilinen Sorunlar / Dikkat Edilmesi Gerekenler:**
  - Supabase'de birden fazla proje var: SQL her zaman `rcaifwsiutoxilpkceht` projesinde çalıştırılmalı
  - Girişsiz indirme Supabase egress kotasını tüketir; Usage → Egress takip edilmeli
  - picomatch (high) açığı yalnızca geliştirme araçlarında, düzeltilmiş sürüm yok
  - Launcher'da `feature/faster-launch` merge edilirken sürüm 0.34.0 yapılmalı (0.33.0 kullanıldı)

### [2026-11-18 - Mehbur07]

- **Yapılanlar & Kararlar:**
  - Faz 0: `mehburmclibrary` org'u açıldı; Supabase Redirect URLs'e site ve
    `http://localhost:5173/**` eklendi (`127.0.0.1:47823` girdisi launcher'ın Google girişi
    için, silinmemeli). Supabase'de e-posta + Google girişi açık, kayıt açık, e-posta onayı zorunlu
  - Faz 1: Vite + TypeScript + pnpm iskeleti; `mmc-site` tasarımı, açık/koyu tema, TR/EN,
    404, GitHub Actions ile Pages yayını, Dependabot, ESLint + Prettier + Vitest
  - Koyu tema `mmc-site` ile birebir aynı; açık tema bu siteye özel (koyu cyan `#007c8a`)
  - Çok sayfalı yapı (her sayfa gerçek bir HTML dosyası), sayfalar hash'li adres kullanmıyor
  - TypeScript 6.0'da tutuldu: typescript-eslint henüz TypeScript 7'yi desteklemiyor
  - Kullanıcı kararları: ziyaretçi girişsiz listeyi görür ve indirir; siteden kayıt olunabilir;
    Google girişi olacak; admin paneli launcher'da kalacak; "Launcher'da aç" deep link istendi
- **Son Commit:** ilk yükleme, commit yok
- **Aktif Branch:** main
- **Sıradaki İlk İş (Next Action):** Kullanıcı "başla" derse Faz 2: launcher reposunda
  girişsiz liste/indirme SQL'i (yerel launcher klasöründe DEĞİL, ayrı worktree'de)
- **Bilinen Sorunlar / Dikkat Edilmesi Gerekenler:**
  - Yerel `mehbur-launcher` klasöründe kullanıcının commit edilmemiş işi var; launcher
    değişiklikleri ayrı worktree'de yapılmalı
  - picomatch (high) açığı yalnızca geliştirme araçlarında, düzeltilmiş sürüm yok
  - Launcher'ın `.env.example` dosyası `feature/android-apk` branch'inde, main'e henüz girmedi
