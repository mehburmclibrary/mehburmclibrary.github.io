// Taramayı arka planda başlatır; Web Worker kullanılamıyorsa sayfanın içinde çalıştırır.
import { scanAs, type LibraryKind, type ScanReport } from "./scan";

export function scanInBackground(bytes: Uint8Array, kind: LibraryKind): Promise<ScanReport> {
  if (typeof Worker === "undefined") return scanAs(bytes, kind);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; report?: ScanReport; error?: string }>) => {
      worker.terminate();
      if (e.data.ok && e.data.report) resolve(e.data.report);
      else reject(new Error(e.data.error ?? "scan failed"));
    };
    worker.onerror = () => {
      worker.terminate();
      // Worker açılamadıysa (eski tarayıcı vb.) aynı tarama sayfada yapılır
      scanAs(bytes, kind).then(resolve, reject);
    };
    // Kopya gönderilir; asıl veri yükleme için sayfada kalır
    worker.postMessage({ bytes: bytes.slice(), kind });
  });
}
