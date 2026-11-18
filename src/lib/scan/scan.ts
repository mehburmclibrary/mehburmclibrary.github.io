// Kütüphaneye yüklenecek dosyanın otomatik kontrolü. MehburMC Launcher'daki tarayıcının
// (crates/launcher-core/src/content/scan.rs, SCANNER_VERSION 2) birebir TypeScript karşılığıdır:
// aynı kurallar, aynı bulgu kodları ve aynı rapor biçimi. Sunucu bu raporu yüklemeyle birlikte
// saklar; adminler onaylamadan önce dosyayı kendi launcher'larında yeniden tarar.
// Hiçbir tarama bir dosyanın güvenli olduğunu kanıtlamaz; bariz olanı eler ve admine nereye
// bakacağını gösterir.
import { ZipReader, type ZipEntry } from "./zip";

export type Severity = "warn" | "block";
export type Verdict = "pass" | "warn" | "block";
export type ScanLoader = "fabric" | "quilt" | "forge" | "neoForge";
export type LibraryKind = "mod" | "modpack" | "resourcepack" | "shader";

export interface Finding {
  severity: Severity;
  code: string;
  examples: string[];
}

export interface ModDescriptor {
  modId: string;
  name: string;
  version: string;
  loaders: ScanLoader[];
  gameVersions: string;
}

export interface ScanReport {
  verdict: Verdict;
  descriptor: ModDescriptor | null;
  findings: Finding[];
  sha1: string;
  size: number;
  classes: number;
  scanner: number;
  kind: LibraryKind;
}

export const SCANNER_VERSION = 2;
export const MAX_JAR_BYTES = 25 * 1024 * 1024;
export const MAX_PACK_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 30_000;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_DEPTH = 3;
const MAX_EXAMPLES = 5;
const MAX_FIELD_CHARS = 80;

export function maxBytes(kind: LibraryKind): number {
  return kind === "mod" ? MAX_JAR_BYTES : MAX_PACK_BYTES;
}

export function kindExt(kind: LibraryKind): "jar" | "mrpack" | "zip" {
  return kind === "mod" ? "jar" : kind === "modpack" ? "mrpack" : "zip";
}

// ---------------------------------------------------------------- metin yardımcıları

const chars = (s: string) => Array.from(s);
const takeChars = (s: string, n: number) => chars(s).slice(0, n).join("");
const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
const byteLen = (s: string) => new TextEncoder().encode(s).length;
/** Rust char::is_control: Unicode "Cc" (U+0000–U+001F, U+007F–U+009F). */
const isControl = (c: string) => {
  const n = c.codePointAt(0)!;
  return n <= 0x1f || (n >= 0x7f && n <= 0x9f);
};

/** Tek satır, sınırlı, biçim kodsuz (Minecraft'ın § renk kodları atılır). */
export function clean(s: string): string | null {
  const noControl = chars(s)
    .filter((c) => !isControl(c))
    .join("");
  const out = noControl
    .split("§")
    .map((part, i) => {
      if (i === 0) return part;
      // Rust: part.get(1..) — ilk karakter tek baytlık değilse parça tamamen düşer
      return part.length > 0 && part.charCodeAt(0) < 0x80 ? part.slice(1) : "";
    })
    .join("")
    .trim();
  const s2 = takeChars(out, MAX_FIELD_CHARS);
  return s2 && !s2.startsWith("${") ? s2 : null;
}

// Mod yükleyicileri gibi gevşek JSON: string içinde satır sonu, satır yorumu (//) ve blok
// yorumu kabul edilir.
export function lenientJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // aşağıda temizlenip yeniden denenir
  }
  let out = "";
  const cs = chars(text);
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    if (inStr) {
      if (escaped) {
        escaped = false;
        out += c;
      } else if (c === "\\") {
        escaped = true;
        out += c;
      } else if (c === '"') {
        inStr = false;
        out += c;
      } else out += isControl(c) ? " " : c;
      continue;
    }
    const next = cs[i + 1];
    if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === "/" && next === "/") {
      i++;
      while (i + 1 < cs.length && cs[++i] !== "\n");
      out += "\n";
    } else if (c === "/" && next === "*") {
      i += 2;
      let prev = " ";
      for (; i < cs.length; i++) {
        if (prev === "*" && cs[i] === "/") break;
        prev = cs[i]!;
      }
      out += " ";
    } else out += c;
  }
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/** Bir satırdaki `key = "…"` / `'…'` / `"""…"""` değeri. */
export function tomlValue(line: string, key: string): string | null {
  const eq = line.indexOf("=");
  if (eq < 0 || line.slice(0, eq).trim() !== key) return null;
  const rest = line.slice(eq + 1).trim();
  for (const q of ['"""', "'''", '"', "'"]) {
    if (rest.startsWith(q)) {
      const inner = rest.slice(q.length);
      const end = inner.indexOf(q);
      return end >= 0 ? inner.slice(0, end) : null;
    }
  }
  return null;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function jsonVersions(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").join(" || ");
  return "";
}

function validId(id: string): string | null {
  const l = asciiLower(id.trim());
  return l && byteLen(l) <= 64 && /^[A-Za-z0-9_.-]+$/.test(l) ? l : null;
}

// ---------------------------------------------------------------- bulgular

class Collector {
  private found = new Map<string, { severity: Severity; code: string; examples: Set<string> }>();
  classes = 0;
  shortNames = 0;

  add(severity: Severity, code: string, example: string) {
    const key = `${severity}|${code}`;
    let f = this.found.get(key);
    if (!f) {
      f = { severity, code, examples: new Set() };
      this.found.set(key, f);
    }
    if (f.examples.size < MAX_EXAMPLES) f.examples.add(takeChars(example, 160));
  }

  has(code: string): boolean {
    return [...this.found.values()].some((f) => f.code === code);
  }

  /** Rust'taki gibi: önce "block", sonra kodlar ters alfabetik; örnekler sıralı. */
  findings(): Finding[] {
    const rank = (s: Severity) => (s === "block" ? 1 : 0);
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    return [...this.found.values()]
      .sort((a, b) => rank(b.severity) - rank(a.severity) || cmp(b.code, a.code))
      .map((f) => ({ severity: f.severity, code: f.code, examples: [...f.examples].sort(cmp) }));
  }
}

// ---------------------------------------------------------------- Java sınıf dosyası

interface ClassRefs {
  methods: [string, string][];
  classes: string[];
  strings: string[];
}

const lossy = new TextDecoder("utf-8");

/** Sabit havuzu (constant pool) okuyucu; sınıf dosyası değilse null. */
export function classRefs(b: Uint8Array): ClassRefs | null {
  const u16 = (i: number) => (i + 1 < b.length ? (b[i]! << 8) | b[i + 1]! : null);
  if (b.length < 4 || b[0] !== 0xca || b[1] !== 0xfe || b[2] !== 0xba || b[3] !== 0xbe) return null;
  const count = u16(8);
  if (count === null) return null;
  const utf8: (string | null)[] = new Array<string | null>(count).fill(null);
  const refs: [number, number, number][] = Array.from({ length: count }, () => [0, 0, 0]);
  let i = 10;
  let idx = 1;
  while (idx < count) {
    if (i >= b.length) return null;
    const tag = b[i]!;
    i += 1;
    switch (tag) {
      case 1: {
        const len = u16(i);
        if (len === null || i + 2 + len > b.length) return null;
        utf8[idx] = lossy.decode(b.subarray(i + 2, i + 2 + len));
        i += 2 + len;
        break;
      }
      case 3:
      case 4:
        i += 4;
        break;
      case 5:
      case 6:
        i += 8;
        idx += 1; // iki yer kaplar
        break;
      case 7:
      case 8:
      case 16:
      case 19:
      case 20: {
        const a = u16(i);
        if (a === null) return null;
        refs[idx] = [tag, a, 0];
        i += 2;
        break;
      }
      case 9:
      case 10:
      case 11:
      case 12:
      case 17:
      case 18: {
        const a = u16(i);
        const c = u16(i + 2);
        if (a === null || c === null) return null;
        refs[idx] = [tag, a, c];
        i += 4;
        break;
      }
      case 15:
        i += 3;
        break;
      default:
        return null;
    }
    idx += 1;
  }
  const text = (n: number) => utf8[n] ?? null;
  const className = (n: number) => {
    const r = refs[n];
    return r && r[0] === 7 ? text(r[1]) : null;
  };
  const out: ClassRefs = { methods: [], classes: [], strings: [] };
  for (const [tag, a, c] of refs) {
    if (tag === 7) {
      const t = text(a);
      if (t !== null) out.classes.push(t);
    } else if (tag === 8) {
      const t = text(a);
      if (t !== null) out.strings.push(t);
    } else if (tag === 10 || tag === 11) {
      const owner = className(a);
      const nat = refs[c];
      if (owner !== null && nat && nat[0] === 12) {
        const name = text(nat[1]);
        if (name !== null) out.methods.push([owner, name]);
      }
    }
  }
  return out;
}

const CREDENTIAL_MARKERS = [
  "local storage\\leveldb",
  "local storage/leveldb",
  "\\login data",
  "/login data",
  "\\local state",
  "/local state",
  "launcher_accounts",
  "microsoft_accounts",
  "lunarclient/settings/game/accounts",
  ".lunarclient\\settings\\game\\accounts",
  "feather/accounts",
  "essential/microsoft_accounts",
  "wallet.dat",
  "exodus.wallet",
  "metamask",
  "\\discord\\",
  "/discord/",
  "discordcanary",
  "discordptb",
];

const EXFIL_MARKERS = [
  "discord.com/api/webhooks",
  "discordapp.com/api/webhooks",
  "canary.discord.com/api/webhooks",
  "api.telegram.org/bot",
];

const SUSPICIOUS_HOSTS = [
  "pastebin.com/raw",
  "hastebin.com/raw",
  "ngrok.io",
  "ngrok-free.app",
  "transfer.sh",
  "anonfiles",
  "iplogger",
  "grabify",
];

function checkStrings(c: Collector, cls: string, r: ClassRefs) {
  for (const s of r.strings) {
    const l = asciiLower(s);
    if (EXFIL_MARKERS.some((m) => l.includes(m))) c.add("block", "webhook", cls);
    if (CREDENTIAL_MARKERS.some((m) => l.includes(m))) c.add("block", "credentialPaths", cls);
    if (SUSPICIOUS_HOSTS.some((m) => l.includes(m))) c.add("warn", "suspiciousUrl", cls);
    // Uzun base64 benzeri metinler çoğu zaman gizli kod taşır
    if (s.length > 4096 && /^[A-Za-z0-9+/=]*$/.test(s)) c.add("warn", "encodedBlob", cls);
  }
}

function checkMethods(c: Collector, cls: string, r: ClassRefs) {
  let base64 = false;
  let cipher = false;
  let define = false;
  for (const [owner, name] of r.methods) {
    if (
      (owner === "java/lang/Runtime" && name === "exec") ||
      (owner === "java/lang/ProcessBuilder" && (name === "start" || name === "<init>"))
    ) {
      c.add("warn", "processExec", cls);
    } else if (
      (owner === "java/lang/System" || owner === "java/lang/Runtime") &&
      (name === "load" || name === "loadLibrary")
    ) {
      c.add("warn", "nativeLoad", cls);
    } else if (
      (name === "defineClass" || name === "defineHiddenClass" || name === "defineAnonymousClass") &&
      (owner.includes("ClassLoader") || owner.endsWith("Lookup") || owner.endsWith("Unsafe"))
    ) {
      define = true;
      c.add("warn", "defineClass", cls);
    } else if (owner === "java/util/Base64$Decoder" && name === "decode") {
      base64 = true;
    } else if (owner === "javax/crypto/Cipher" && (name === "doFinal" || name === "init")) {
      cipher = true;
      c.add("warn", "crypto", cls);
    } else if (
      (owner === "java/net/URL" && (name === "openConnection" || name === "openStream")) ||
      (owner === "java/net/http/HttpClient" && (name === "send" || name === "sendAsync")) ||
      (owner === "java/net/Socket" && name === "<init>") ||
      (owner === "java/net/DatagramSocket" && name === "<init>")
    ) {
      c.add("warn", "network", cls);
    }
  }
  // Veriyi çözüp ya da şifresini açıp sınıfa çevirmek, zararlıların kodu saklama yolu
  if (define && (base64 || cipher)) c.add("block", "hiddenPayload", cls);
}

const EXEC_EXT = [".exe", ".scr", ".bat", ".cmd", ".ps1", ".vbs", ".msi", ".com", ".jse", ".wsf"];
const NATIVE_EXT = [".dll", ".so", ".dylib", ".jnilib"];
const isExecutableName = (n: string) => EXEC_EXT.some((e) => asciiLower(n).endsWith(e));
const isNativeName = (n: string) => NATIVE_EXT.some((e) => asciiLower(n).endsWith(e));

/** Kılık değiştirmiş çalıştırılabilir dosya: Windows "MZ" ya da Linux ELF. */
const looksExecutable = (d: Uint8Array) =>
  (d.length > 64 && d[0] === 0x4d && d[1] === 0x5a) ||
  (d.length >= 4 && d[0] === 0x7f && d[1] === 0x45 && d[2] === 0x4c && d[3] === 0x46);

/** Sıkıştırma oranı ve boyut ile zip bombası denetimi (Rust'taki tam sayı bölmesiyle aynı). */
const isBomb = (e: ZipEntry) =>
  e.size > MAX_ENTRY_BYTES ||
  (e.size > 1024 * 1024 && Math.floor(e.size / Math.max(e.compressedSize, 1)) > 200);

function openZip(bytes: Uint8Array): ZipReader | null {
  try {
    return new ZipReader(bytes);
  } catch {
    return null;
  }
}

interface Total {
  value: number;
}

// ---------------------------------------------------------------- mod (jar)

function scanZip(c: Collector, bytes: Uint8Array, prefix: string, depth: number, total: Total) {
  const zip = openZip(bytes);
  if (!zip) {
    c.add("block", "notAJar", prefix === "" ? "/" : prefix);
    return;
  }
  if (zip.entries.length > MAX_ENTRIES) {
    c.add("block", "tooManyFiles", prefix);
    return;
  }
  for (const e of zip.entries) {
    try {
      zip.check(e);
    } catch {
      c.add("block", "notAJar", prefix);
      return;
    }
    if (e.isDir) continue;
    // Adı çözülemeyen bir dosya güvenli sayılamaz
    if (e.name === null) {
      c.add("block", "unsafePath", prefix);
      return;
    }
    const name = prefix + e.name;
    if (isBomb(e)) {
      c.add("block", "zipBomb", name);
      return;
    }
    total.value += e.size;
    if (total.value > MAX_TOTAL_BYTES) {
      c.add("block", "zipBomb", name);
      return;
    }
    if (isExecutableName(name)) c.add("block", "executable", name);
    else if (isNativeName(name)) c.add("warn", "nativeBinary", name);
    const lower = asciiLower(name);
    const isClass = lower.endsWith(".class");
    const full = isClass || lower.endsWith(".jar");
    // Diğer dosyaların yalnızca ilk baytlarına bakılır
    const limit = full ? Math.min(e.size, MAX_ENTRY_BYTES) : 128;
    let data: Uint8Array;
    try {
      data = zip.read(e, limit);
    } catch {
      c.add("block", "notAJar", name);
      return;
    }
    if (!isClass && !isNativeName(name) && looksExecutable(data))
      c.add("block", "executable", name);
    if (isClass) {
      c.classes += 1;
      const r = classRefs(data);
      if (r) {
        let simple = name.slice(name.lastIndexOf("/") + 1);
        while (simple.endsWith(".class")) simple = simple.slice(0, -6);
        if (byteLen(simple.split("$")[0]!) <= 2) c.shortNames += 1;
        checkMethods(c, name, r);
        checkStrings(c, name, r);
      } else c.add("warn", "badClass", name);
    } else if (lower.endsWith(".jar")) {
      if (depth + 1 >= MAX_DEPTH) c.add("warn", "deepNesting", name);
      else scanZip(c, data, `${name}!/`, depth + 1, total);
    }
  }
}

function readText(zip: ZipReader, name: string): string | null {
  const e = zip.byName(name);
  if (!e || e.size > 512 * 1024) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(zip.read(e, 512 * 1024));
    // Başta BOM (U+FEFF) varsa atılır
    let i = 0;
    while (text.charCodeAt(i) === 0xfeff) i++;
    return text.slice(i);
  } catch {
    return null;
  }
}

/** Jar'ın kendi mod tanımı (yalnızca kökte). */
export function descriptor(bytes: Uint8Array): ModDescriptor | null {
  const zip = openZip(bytes);
  if (!zip) return null;
  const short = (s: string) => takeChars(clean(s) ?? "", 100);

  const fabricText = readText(zip, "fabric.mod.json");
  const fabric = fabricText === null ? null : lenientJson(fabricText);
  if (fabric !== null && fabric !== undefined) {
    const v = obj(fabric);
    const rawId = str(v.id);
    if (rawId === null) return null;
    const id = validId(rawId);
    if (id === null) return null;
    return {
      name: (str(v.name) !== null ? clean(str(v.name)!) : null) ?? id,
      version: (str(v.version) !== null ? clean(str(v.version)!) : null) ?? "",
      modId: id,
      loaders: ["fabric", "quilt"],
      gameVersions: short(jsonVersions(obj(v.depends).minecraft)),
    };
  }

  const quiltText = readText(zip, "quilt.mod.json");
  const quilt = quiltText === null ? null : lenientJson(quiltText);
  if (quilt !== null && quilt !== undefined) {
    const ql = obj(obj(quilt).quilt_loader);
    const rawId = str(ql.id);
    if (rawId === null) return null;
    const id = validId(rawId);
    if (id === null) return null;
    const deps = Array.isArray(ql.depends) ? ql.depends : null;
    const mcDep = deps?.find((x) => obj(x).id === "minecraft");
    const mc = deps ? (mcDep !== undefined ? jsonVersions(obj(mcDep).versions) : "") : "";
    const name = str(obj(ql.metadata).name);
    const version = str(ql.version);
    return {
      name: (name !== null ? clean(name) : null) ?? id,
      version: (version !== null ? clean(version) : null) ?? "",
      modId: id,
      loaders: ["quilt"],
      gameVersions: short(mc),
    };
  }

  const tomls: [string, ScanLoader][] = [
    ["META-INF/neoforge.mods.toml", "neoForge"],
    ["META-INF/mods.toml", "forge"],
  ];
  for (const [file, loader] of tomls) {
    const text = readText(zip, file);
    if (text === null) continue;
    let id: string | null = null;
    let name: string | null = null;
    let version: string | null = null;
    let mc: string | null = null;
    let section = "";
    let depIsMc = false;
    for (const raw of text.split("\n")) {
      const line = raw.replace(/\r$/, "").trim();
      if (line.startsWith("[")) {
        section = line;
        depIsMc = false;
        continue;
      }
      if (section === "[[mods]]") {
        id ??= tomlValue(line, "modId");
        name ??= tomlValue(line, "displayName");
        version ??= tomlValue(line, "version");
      } else if (section.startsWith("[[dependencies")) {
        if (tomlValue(line, "modId") === "minecraft") depIsMc = true;
        if (depIsMc) mc ??= tomlValue(line, "versionRange");
      }
    }
    if (id === null) return null;
    const vid = validId(id);
    if (vid === null) return null;
    let ver = version ?? "";
    if (version !== null && version.includes("${")) {
      const manifest = readText(zip, "META-INF/MANIFEST.MF");
      ver = "";
      if (manifest !== null) {
        for (const l of manifest.split("\n")) {
          const line = l.replace(/\r$/, "");
          if (line.startsWith("Implementation-Version:")) {
            ver = line.slice("Implementation-Version:".length).trim();
            break;
          }
        }
      }
    }
    return {
      name: (name !== null ? clean(name) : null) ?? vid,
      version: clean(ver) ?? "",
      modId: vid,
      loaders: [loader],
      gameVersions: short(mc ?? ""),
    };
  }
  return null;
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function finish(
  c: Collector,
  desc: ModDescriptor | null,
  bytes: Uint8Array,
  kind: LibraryKind,
): Promise<ScanReport> {
  const findings = c.findings();
  const verdict: Verdict = findings.some((f) => f.severity === "block")
    ? "block"
    : findings.length === 0
      ? "pass"
      : "warn";
  return {
    verdict,
    descriptor: desc,
    findings,
    sha1: await sha1Hex(bytes),
    size: bytes.length,
    classes: c.classes,
    scanner: SCANNER_VERSION,
    kind,
  };
}

/** Bir mod jar'ını denetler. Kötü niyetli dosyada bile hata fırlatmaz. */
export async function scanMod(bytes: Uint8Array): Promise<ScanReport> {
  const c = new Collector();
  if (bytes.length > MAX_JAR_BYTES) c.add("block", "tooLarge", "/");
  else scanZip(c, bytes, "", 0, { value: 0 });
  const desc = c.has("notAJar") ? null : descriptor(bytes);
  if (desc === null && !c.has("notAJar") && !c.has("tooLarge")) c.add("block", "noDescriptor", "/");
  if (c.classes >= 20 && c.shortNames * 2 > c.classes) {
    c.add("warn", "obfuscated", `${c.shortNames}/${c.classes}`);
  }
  return finish(c, desc, bytes, "mod");
}

// ---------------------------------------------------------------- paketler

const MRPACK_HOSTS = ["cdn.modrinth.com", "github.com", "raw.githubusercontent.com", "gitlab.com"];
const MRPACK_INDEX = "modrinth.index.json";

/** Profil içinde güvenli göreli yol: "..", mutlak yol, sürücü ya da ters eğik çizgi yok. */
export function safeRelPath(p: string): boolean {
  return (
    p !== "" &&
    !p.startsWith("/") &&
    !p.includes("\\") &&
    !p.includes(":") &&
    p.split("/").every((s) => s !== "" && s !== "." && s !== "..")
  );
}

function scanPackZip(c: Collector, bytes: Uint8Array, kind: LibraryKind, total: Total) {
  const zip = openZip(bytes);
  if (!zip) {
    c.add("block", "notAJar", "/");
    return;
  }
  if (zip.entries.length > MAX_ENTRIES) {
    c.add("block", "tooManyFiles", "/");
    return;
  }
  for (const e of zip.entries) {
    try {
      zip.check(e);
    } catch {
      c.add("block", "notAJar", "/");
      return;
    }
    if (e.isDir) continue;
    if (e.name === null) {
      c.add("block", "unsafePath", "/");
      return;
    }
    const name = e.name;
    if (isBomb(e)) {
      c.add("block", "zipBomb", name);
      return;
    }
    total.value += e.size;
    if (total.value > MAX_TOTAL_BYTES) {
      c.add("block", "zipBomb", name);
      return;
    }
    if (!safeRelPath(name)) {
      c.add("block", "unsafePath", name);
      continue;
    }
    const lower = asciiLower(name);
    const overrideJar =
      kind === "modpack" &&
      lower.endsWith(".jar") &&
      ["overrides/", "client-overrides/", "server-overrides/"].some((p) => lower.startsWith(p));
    if (isExecutableName(name)) c.add("block", "executable", name);
    else if (isNativeName(name)) c.add("block", "nativeBinary", name);
    else if ((lower.endsWith(".class") || lower.endsWith(".jar")) && !overrideJar) {
      c.add("block", "codeInPack", name);
    }
    const limit = overrideJar ? Math.min(e.size, MAX_ENTRY_BYTES) : 128;
    let data: Uint8Array;
    try {
      data = zip.read(e, limit);
    } catch {
      c.add("block", "notAJar", name);
      return;
    }
    if (!overrideJar && looksExecutable(data)) c.add("block", "executable", name);
    if (overrideJar) {
      // Pakete gömülü modlar: mod kurallarının tamamı (iç içe jar'lar dahil)
      scanZip(c, data, `${name}!/`, 1, total);
      if (descriptor(data) === null) c.add("warn", "noDescriptor", name);
    }
  }
}

function resourcePackDescriptor(zip: ZipReader): ModDescriptor | null {
  const text = readText(zip, "pack.mcmeta");
  if (text === null) return null;
  const v = lenientJson(text);
  if (!v || typeof v !== "object" || Array.isArray(v) || !("pack" in v)) return null;
  const pack = obj((v as Json).pack);
  const d = pack.description;
  let description = "";
  if (typeof d === "string") description = d;
  else if (Array.isArray(d)) {
    description = d
      .map((p) => (typeof p === "string" ? p : str(obj(p).text)))
      .filter((p): p is string => p !== null)
      .join("");
  } else if (d && typeof d === "object") description = str(obj(d).text) ?? "";
  // İlk satır, biçim kodları (§ ve ardından gelen karakter) olmadan
  const firstLine = (description.split("\n")[0] ?? "").replace(/\r$/, "");
  let first = "";
  const cs = chars(firstLine);
  for (let i = 0; i < cs.length; i++) {
    if (cs[i] === "§") i++;
    else first += cs[i];
  }
  const format = pack.pack_format;
  return {
    modId: "",
    name: takeChars(clean(first) ?? "", 64),
    version:
      typeof format === "number" && Number.isInteger(format) && format >= 0
        ? `pack_format ${format}`
        : "",
    loaders: [],
    gameVersions: "",
  };
}

/** Shader paketinin programları kökteki shaders/ klasöründedir. */
function shaderDescriptor(zip: ZipReader): ModDescriptor | null {
  const readable = (e: ZipEntry) => {
    try {
      zip.check(e);
      return true;
    } catch {
      return false;
    }
  };
  const found = zip.entries.some(
    (e) => readable(e) && e.name !== null && e.name.startsWith("shaders/") && e.nameBytes > 8,
  );
  return found ? { modId: "", name: "", version: "", loaders: [], gameVersions: "" } : null;
}

/** modrinth.index.json: ad, sürüm, loader'lar, MC sürümü; her indirme doğrulanmış olmalı. */
function mrpackDescriptor(c: Collector, zip: ZipReader): ModDescriptor | null {
  const text = readText(zip, MRPACK_INDEX);
  if (text === null) return null;
  let v: Json;
  try {
    v = obj(JSON.parse(text));
  } catch {
    return null;
  }
  if (v.formatVersion !== 1 || v.game !== "minecraft") return null;
  const deps = obj(v.dependencies);
  const loaders: ScanLoader[] = [];
  const keys: [string, ScanLoader][] = [
    ["fabric-loader", "fabric"],
    ["quilt-loader", "quilt"],
    ["forge", "forge"],
    ["neoforge", "neoForge"],
  ];
  for (const [key, l] of keys) if (key in deps) loaders.push(l);
  const files = Array.isArray(v.files) ? v.files : [];
  for (const f of files) {
    const file = obj(f);
    const path = str(file.path) ?? "";
    if (!safeRelPath(path)) {
      c.add("block", "unsafePath", path);
      continue;
    }
    if (isExecutableName(path) || isNativeName(path)) c.add("block", "executable", path);
    const hashes = obj(file.hashes);
    const hashed = ["sha1", "sha512"].some((h) => {
      const s = str(hashes[h]);
      return s !== null && s !== "";
    });
    const downloads = Array.isArray(file.downloads) ? file.downloads : [];
    const hosts = downloads.map((u) => {
      const s = str(u);
      if (s === null) return null;
      try {
        const url = new URL(s);
        return url.protocol === "https:" ? asciiLower(url.hostname) : null;
      } catch {
        return null;
      }
    });
    const allowed = hosts.filter((h): h is string => h !== null && MRPACK_HOSTS.includes(h));
    if (!hashed || allowed.length === 0) c.add("block", "badDownload", path);
    else if (!allowed.includes("cdn.modrinth.com")) c.add("warn", "externalDownload", path);
  }
  const text2 = (x: unknown) => {
    const s = str(x);
    return s === null ? "" : (clean(s) ?? "");
  };
  return {
    modId: "",
    name: takeChars(text2(v.name), 64),
    version: takeChars(text2(v.versionId), 64),
    loaders,
    gameVersions: takeChars(text2(deps.minecraft), 100),
  };
}

/** Her türden kütüphane dosyasını denetler. Kötü niyetli dosyada bile hata fırlatmaz. */
export async function scanAs(bytes: Uint8Array, kind: LibraryKind): Promise<ScanReport> {
  if (kind === "mod") return scanMod(bytes);
  const c = new Collector();
  let desc: ModDescriptor | null = null;
  if (bytes.length > maxBytes(kind)) c.add("block", "tooLarge", "/");
  else {
    scanPackZip(c, bytes, kind, { value: 0 });
    const zip = openZip(bytes);
    if (zip) {
      desc =
        kind === "resourcepack"
          ? resourcePackDescriptor(zip)
          : kind === "shader"
            ? shaderDescriptor(zip)
            : mrpackDescriptor(c, zip);
    }
  }
  if (desc === null && !c.has("notAJar") && !c.has("tooLarge")) c.add("block", "noDescriptor", "/");
  return finish(c, desc, bytes, kind);
}
