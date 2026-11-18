/// <reference types="vite/client" />

// .env dosyasındaki değişkenlerin tipleri (bkz. .env.example)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
