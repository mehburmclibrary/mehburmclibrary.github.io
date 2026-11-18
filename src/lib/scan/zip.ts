// Tarayıcıda zip / jar okuma. Launcher'ın kullandığı Rust "zip" kütüphanesinin davranışına
// yakın: dosya listesi zip'in sonundaki "içindekiler" bölümünden (central directory) okunur,
// her dosyanın beyan edilen boyutu açmadan bilinir ve bir dosyanın yalnızca ilk N baytı
// açılabilir (zip bombalarına karşı). Sıkıştırma açma işini fflate yapar.
import { Inflate } from "fflate";

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export interface ZipEntry {
  /** Çözülemeyen (bozuk UTF-8) adlarda null. */
  name: string | null;
  /** Ad "/" ile bitiyor: klasör. */
  isDir: boolean;
  /** Ad için bayt sayısı (Rust'taki str::len). */
  nameBytes: number;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  /** Beyan edilen (açılmış) boyut. */
  size: number;
  localOffset: number;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** IBM 437: UTF-8 işareti olmayan eski zip adları bu kodlamayla yazılır (0x80–0xFF). */
const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const utf8Strict = new TextDecoder("utf-8", { fatal: true });

function decodeName(bytes: Uint8Array, utf8: boolean): string | null {
  if (utf8) {
    try {
      return utf8Strict.decode(bytes);
    } catch {
      return null;
    }
  }
  let s = "";
  for (const b of bytes) s += b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80];
  return s;
}

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Deflate verisini en fazla `limit` bayt açar. */
function inflateLimited(data: Uint8Array, limit: number): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 0;
  let done = false;
  const inflate = new Inflate((chunk) => {
    if (done) return;
    const take = Math.min(chunk.length, limit - total);
    parts.push(chunk.subarray(0, take));
    total += take;
    if (total >= limit) done = true;
  });
  const STEP = 16 * 1024;
  if (data.length === 0) inflate.push(new Uint8Array(0), true);
  for (let i = 0; i < data.length && !done; i += STEP) {
    inflate.push(data.subarray(i, i + STEP), i + STEP >= data.length);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export class ZipReader {
  readonly entries: ZipEntry[] = [];
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = this.findEocd();
    const count = this.u16(eocd + 10);
    const cdOffset = this.u32(eocd + 16);
    if (count === 0xffff || cdOffset === 0xffffffff) throw new ZipError("zip64 not supported");
    let p = cdOffset;
    for (let i = 0; i < count; i++) {
      if (this.u32(p) !== CENTRAL) throw new ZipError("bad central directory");
      const flags = this.u16(p + 8);
      const nameLen = this.u16(p + 28);
      const extraLen = this.u16(p + 30);
      const commentLen = this.u16(p + 32);
      const raw = this.slice(p + 46, nameLen);
      this.entries.push({
        name: decodeName(raw, (flags & 0x800) !== 0),
        isDir: nameLen > 0 && raw[nameLen - 1] === 0x2f,
        nameBytes: nameLen,
        method: this.u16(p + 10),
        flags,
        crc: this.u32(p + 16),
        compressedSize: this.u32(p + 20),
        size: this.u32(p + 24),
        localOffset: this.u32(p + 42),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
  }

  private findEocd(): number {
    const min = Math.max(0, this.bytes.length - 22 - 0xffff);
    for (let i = this.bytes.length - 22; i >= min; i--) {
      if (this.view.getUint32(i, true) === EOCD) return i;
    }
    throw new ZipError("not a zip");
  }

  private u16(at: number): number {
    if (at < 0 || at + 2 > this.bytes.length) throw new ZipError("truncated");
    return this.view.getUint16(at, true);
  }

  private u32(at: number): number {
    if (at < 0 || at + 4 > this.bytes.length) throw new ZipError("truncated");
    return this.view.getUint32(at, true);
  }

  private slice(at: number, len: number): Uint8Array {
    if (at < 0 || at + len > this.bytes.length) throw new ZipError("truncated");
    return this.bytes.subarray(at, at + len);
  }

  /** Dosyayı açmaya hazırlar; şifreli, desteklenmeyen ya da bozuk kayıtlar hata verir. */
  private compressed(e: ZipEntry): Uint8Array {
    if (e.flags & 1) throw new ZipError("encrypted");
    if (e.method !== 0 && e.method !== 8) throw new ZipError("unsupported compression");
    if (this.u32(e.localOffset) !== LOCAL) throw new ZipError("bad local header");
    const start = e.localOffset + 30 + this.u16(e.localOffset + 26) + this.u16(e.localOffset + 28);
    return this.slice(start, e.compressedSize);
  }

  /** Açılmadan önce yapılan kontrol (Rust'taki by_index): kayıt okunabilir mi? */
  check(e: ZipEntry): void {
    this.compressed(e);
  }

  /**
   * Dosyanın en fazla `limit` baytı. Dosyanın tamamı okunduğunda (limit ≥ boyut) Rust'taki
   * gibi CRC de denetlenir; bozuksa hata verir.
   */
  read(e: ZipEntry, limit: number): Uint8Array {
    const data = this.compressed(e);
    const whole = limit >= e.size;
    const want = whole ? e.size : limit;
    const out =
      e.method === 0 ? data.subarray(0, Math.min(want, data.length)) : inflateLimited(data, want);
    if (whole) {
      if (out.length !== e.size || crc32(out) !== e.crc) throw new ZipError("crc mismatch");
    }
    return out;
  }

  byName(name: string): ZipEntry | undefined {
    return this.entries.find((e) => e.name === name);
  }
}
