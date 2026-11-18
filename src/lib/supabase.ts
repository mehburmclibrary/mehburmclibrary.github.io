// Supabase bağlantısı (MehburMC Launcher ile aynı proje). Bağlantı ilk kullanıldığı anda
// kurulur; böylece testler ve Supabase'e ihtiyaç duymayan sayfalar ayar olmadan da çalışır.
// Adres ve anahtar .env dosyasından gelir (bkz. .env.example). Bu anahtar herkese açık
// "anon" anahtardır: ne yapılabileceğini sunucudaki kurallar belirler.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase ayarları eksik: .env dosyasına VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY yaz.",
    );
  }
  client = createClient(url, key, { auth: { flowType: "pkce" } });
  return client;
}
