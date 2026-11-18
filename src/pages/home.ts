// Ana sayfa: tanıtım, son eklenen içerikler, içerik türleri ve "nasıl çalışır".
import "../main";
import "../styles/home.css";
import "../styles/library.css";
import { initLatest } from "../features/latest";
import { listItems } from "../lib/api";

initLatest(document, listItems);
