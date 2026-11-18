// Tarama arka planda (Web Worker) çalışır; büyük dosyalarda sayfa donmaz.
import { scanAs, type LibraryKind } from "./scan";

interface WorkerScope {
  onmessage: ((e: MessageEvent<{ bytes: Uint8Array; kind: LibraryKind }>) => void) | null;
  postMessage(message: unknown): void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = (e) => {
  scanAs(e.data.bytes, e.data.kind).then(
    (report) => ctx.postMessage({ ok: true, report }),
    (err: unknown) => ctx.postMessage({ ok: false, error: String(err) }),
  );
};
