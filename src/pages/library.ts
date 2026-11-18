// Kütüphane sayfası (/library/): arama, filtreler ve içerik listesi.
import "../main";
import "../styles/library.css";
import { initLibraryList } from "../features/library-list";
import { listGameVersions, listItems } from "../lib/api";

initLibraryList(document, { listItems, listGameVersions });
