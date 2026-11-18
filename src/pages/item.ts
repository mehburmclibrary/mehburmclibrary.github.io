// İçerik detay sayfası (/item/?id=...): bilgiler, kurulum ipucu, girişsiz indirme ve şikâyet.
import "../main";
import "../styles/library.css";
import "../styles/account.css";
import "../styles/upload.css";
import { initItemDetail } from "../features/item-detail";
import { downloadUrl, getItem } from "../lib/api";
import { uploadApi } from "../lib/upload-api";

initItemDetail(document, { getItem, downloadUrl, reporter: uploadApi });
