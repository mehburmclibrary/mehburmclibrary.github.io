// İçerik detay sayfası (/item/?id=...): bilgiler, kurulum ipucu ve girişsiz indirme.
import "../main";
import "../styles/library.css";
import { initItemDetail } from "../features/item-detail";
import { downloadUrl, getItem } from "../lib/api";

initItemDetail(document, { getItem, downloadUrl });
