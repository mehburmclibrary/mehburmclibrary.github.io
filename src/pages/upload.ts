// Yükleme sayfası (/upload/): tür → dosya → otomatik kontrol → bilgiler → gönderme.
import "../main";
import "../styles/library.css";
import "../styles/account.css";
import "../styles/upload.css";
import { initUpload } from "../features/upload";
import { authApi } from "../lib/auth-api";
import { scanInBackground } from "../lib/scan/run";
import { uploadApi } from "../lib/upload-api";

initUpload(document, {
  uploads: uploadApi,
  account: () => authApi.account(),
  names: () => authApi.names(),
  scan: scanInBackground,
});
