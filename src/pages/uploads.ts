// "Yüklediklerim" sayfası (/uploads/): yüklemeler, onay durumları, geri çekme.
import "../main";
import "../styles/library.css";
import "../styles/account.css";
import "../styles/upload.css";
import { initMyUploads } from "../features/my-uploads";
import { uploadApi } from "../lib/upload-api";

initMyUploads(document, uploadApi);
