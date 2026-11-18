// Hesap işlemlerinin Supabase ile yapılan gerçek hali (bkz. auth.ts: AuthApi).
// Hesaplar MehburMC Launcher ile aynıdır; oturum tarayıcıda saklanır ve kendiliğinden yenilenir.
import { AuthError, authErrorCode, type AccountInfo, type AuthApi } from "./auth";
import { supabase } from "./supabase";

/** Supabase'in döndürdüğü hatayı arayüz koduna çevirip fırlatır. */
function fail(error: unknown): never {
  throw new AuthError(authErrorCode(error));
}

/** Ağ hatası gibi beklenmedik durumlar da AuthError olarak çıksın. */
async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    fail(e);
  }
}

/** Google'dan dönüş ve e-posta bağlantıları için adres. */
export function accountUrl(): string {
  return `${location.origin}/account/`;
}

interface MyAccountRow {
  rank: number;
  banned: boolean;
  ban_until: string | null;
  ban_reason: string | null;
}

export const authApi: AuthApi = {
  currentUser: () =>
    guard(async () => {
      const { data, error } = await supabase().auth.getSession();
      if (error) fail(error);
      const user = data.session?.user;
      // Launcher'ın eski "anonim" kimlikleri sitede hesap sayılmaz
      if (!user || user.is_anonymous) return null;
      return { email: user.email ?? "" };
    }),

  signIn: (email, password) =>
    guard(async () => {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) fail(error);
    }),

  signUp: (email, password) =>
    guard(async () => {
      const { data, error } = await supabase().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: accountUrl() },
      });
      if (error) fail(error);
      // E-posta zaten kayıtlıysa Supabase (hesap var mı belli olmasın diye) hata vermez,
      // kimliği boş bir kullanıcı döndürür.
      if (data.user && data.user.identities?.length === 0) fail({ code: "user_already_exists" });
      return data.session ? "signedIn" : "code";
    }),

  verifySignup: (email, code) =>
    guard(async () => {
      const { error } = await supabase().auth.verifyOtp({ email, token: code, type: "signup" });
      if (error) fail(error);
    }),

  resendSignup: (email) =>
    guard(async () => {
      const { error } = await supabase().auth.resend({ type: "signup", email });
      if (error) fail(error);
    }),

  requestReset: (email) =>
    guard(async () => {
      const { error } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: accountUrl(),
      });
      if (error) fail(error);
    }),

  resetPassword: (email, code, password) =>
    guard(async () => {
      const verified = await supabase().auth.verifyOtp({ email, token: code, type: "recovery" });
      if (verified.error) fail(verified.error);
      const { error } = await supabase().auth.updateUser({ password });
      // Aynı şifreyi yeniden seçmek sorun değil (launcher da böyle yapar)
      if (error && authErrorCode(error) !== "samePassword") fail(error);
    }),

  google: () =>
    guard(async () => {
      const { error } = await supabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: accountUrl() },
      });
      if (error) fail(error);
    }),

  signOut: () =>
    guard(async () => {
      // Yalnızca bu tarayıcıdan çıkış; launcher ve diğer cihazlar açık kalır
      const { error } = await supabase().auth.signOut({ scope: "local" });
      if (error) fail(error);
    }),

  account: () =>
    guard(async (): Promise<AccountInfo> => {
      const { data, error } = await supabase().rpc("my_account");
      if (error) fail(error);
      const row = ((data ?? []) as MyAccountRow[])[0];
      return {
        rank: row?.rank ?? 0,
        ban: row?.banned ? { until: row.ban_until, reason: row.ban_reason ?? "" } : null,
      };
    }),

  names: () =>
    guard(async () => {
      const { data, error } = await supabase().rpc("my_account_names");
      if (error) fail(error);
      return ((data ?? []) as { name: string }[]).map((r) => r.name);
    }),

  claimName: (name) =>
    guard(async () => {
      const { error } = await supabase().rpc("claim_name", { name });
      if (error) fail(error);
    }),
};
