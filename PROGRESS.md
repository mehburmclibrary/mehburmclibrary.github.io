# İlerleme Kaydı

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
