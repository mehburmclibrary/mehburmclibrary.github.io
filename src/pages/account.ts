// Hesap sayfası (/account/): giriş, kayıt, e-posta kodu, şifre sıfırlama, Google ile giriş,
// ban durumu ve hesap adları. Hesaplar MehburMC Launcher ile ortaktır.
import "../main";
import "../styles/library.css";
import "../styles/account.css";
import { initAccount } from "../features/account";
import { authApi } from "../lib/auth-api";
import { notifyAuthChanged } from "../lib/session-hint";

initAccount(document, authApi, { onAuthChange: notifyAuthChanged });
