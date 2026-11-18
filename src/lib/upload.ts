// Siteden kütüphaneye yükleme: sunucuya gidecek alanların hazırlanması ve hata kodları.
// Kurallar MehburMC Launcher ile aynıdır (crates/launcher-core/src/friends/library.rs →
// submit_library_mod, library_file_name, slug, clean_text). Sunucu tarafı:
// supabase/library_packs.sql + library_web.sql (p_source = 'web').
import { kindExt, type LibraryKind, type ScanLoader, type ScanReport } from "./scan/scan";

export const MAX_NAME_CHARS = 64;
export const MAX_DESCRIPTION_CHARS = 1000;
export const MAX_NOTE_CHARS = 500;
const MAX_FILE_NAME_CHARS = 120;

export const REPORT_REASONS = ["malware", "broken", "stolen", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type UploadErrorCode =
  | "blocked"
  | "fileMissing"
  | "quota"
  | "storageFull"
  | "rateLimited"
  | "authorInvalid"
  | "badKind"
  | "serverNotReady"
  | "tooLarge"
  | "uploadFailed"
  | "notSignedIn"
  | "notFound"
  | "ownReport"
  | "network"
  | "unknown";

export class UploadError extends Error {
  constructor(readonly code: UploadErrorCode) {
    super(code);
    this.name = "UploadError";
  }
}

/** Sunucu / depo hatasını arayüz koduna çevirir. */
export function uploadErrorCode(e: unknown): UploadErrorCode {
  if (e instanceof UploadError) return e.code;
  const err = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
  const message = typeof err.message === "string" ? err.message : String(e ?? "");
  const code = typeof err.code === "string" ? err.code : "";
  const status = String(err.statusCode ?? err.status ?? "");
  const byMessage: Record<string, UploadErrorCode> = {
    "library.blocked": "blocked",
    "library.fileMissing": "fileMissing",
    "library.quota": "quota",
    "library.storageFull": "storageFull",
    "library.badKind": "badKind",
    "library.badSource": "badKind",
    "library.notFound": "notFound",
    "friends.rateLimited": "rateLimited",
    "textures.authorInvalid": "authorInvalid",
    "textures.ownReport": "ownReport",
    "not signed in": "notSignedIn",
  };
  if (message in byMessage) return byMessage[message]!;
  if (code === "PGRST202") return "serverNotReady";
  if (status === "413" || /too large|exceeded the maximum/i.test(message)) return "tooLarge";
  if (status === "415" || /mime type/i.test(message)) return "badKind";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "network";
  }
  return "unknown";
}

/** Launcher'daki clean_text: kırp, kontrol karakterlerini at (çok satırlıda \n kalır), sınırla. */
export function cleanText(s: string, max: number, multiline: boolean): string {
  return Array.from(s.trim())
    .filter((c) => {
      const n = c.codePointAt(0)!;
      const control = n <= 0x1f || (n >= 0x7f && n <= 0x9f);
      return (multiline && c === "\n") || !control;
    })
    .slice(0, max)
    .join("")
    .trim();
}

/** Sunucunun kabul ettiği dosya adı (`[A-Za-z0-9._+-]`, türün uzantısıyla biter). */
export function libraryFileName(name: string, kind: LibraryKind): string {
  const ext = kindExt(kind);
  let stem = name.split(/[/\\]/).pop() ?? "";
  while (stem.endsWith(".disabled")) stem = stem.slice(0, -".disabled".length);
  const dot = stem.lastIndexOf(".");
  if (dot >= 0 && stem.slice(dot + 1).toLowerCase() === ext) stem = stem.slice(0, dot);
  let s = Array.from(stem)
    .map((c) => (/^[A-Za-z0-9._+-]$/.test(c) ? c : "_"))
    .slice(0, MAX_FILE_NAME_CHARS - 1 - ext.length)
    .join("");
  s = s.replace(/^\.+|\.+$/g, "");
  if (!s) s = kind;
  return `${s}.${ext}`;
}

/** Paketler için addan sunucunun kabul ettiği kimlik (`[a-z0-9_.-]{1,64}`). */
export function slug(name: string, kind: LibraryKind): string {
  let s = "";
  for (const c of name.trim().toLowerCase()) {
    if (/^[a-z0-9_.-]$/.test(c)) s += c;
    else if (!s.endsWith("-")) s += "-";
  }
  s = s.replace(/^[-.]+|[-.]+$/g, "");
  s = Array.from(s).slice(0, 64).join("");
  return s || kind;
}

const LOADER_IDS: Record<ScanLoader, string> = {
  fabric: "fabric",
  quilt: "quilt",
  forge: "forge",
  neoForge: "neoforge",
};

export interface SubmissionInput {
  report: ScanReport;
  kind: LibraryKind;
  /** Kullanıcının seçtiği dosyanın adı. */
  fileName: string;
  /** Kullanıcının yazdığı ad (boşsa dosyadaki ad, o da yoksa dosya adı). */
  name: string;
  description: string;
  author: string;
}

/** submit_library_mod'a gidecek alanlar (yükleme yolu hariç). */
export interface Submission {
  p_name: string;
  p_description: string;
  p_author: string;
  p_mod_id: string;
  p_version: string;
  p_loaders: string[];
  p_game_versions: string;
  p_sha1: string;
  p_size: number;
  p_file_name: string;
  p_scan: ScanReport;
  p_kind: LibraryKind;
  p_source: "web";
}

/** Launcher'daki submit_library_mod ile aynı alanları hazırlar; engellenen dosyada hata verir. */
export function prepareSubmission(input: SubmissionInput): Submission {
  const { report, kind } = input;
  const d = report.descriptor;
  if (!d || report.verdict === "block" || report.kind !== kind) throw new UploadError("blocked");
  const fileName = libraryFileName(input.fileName, kind);
  const stem = fileName.slice(0, fileName.lastIndexOf("."));
  const take = (s: string) => Array.from(s).slice(0, MAX_NAME_CHARS).join("");
  const name =
    [cleanText(input.name, MAX_NAME_CHARS, false), d.name].map(take).find((n) => n.trim() !== "") ??
    take(stem);
  const version = Array.from(d.version).slice(0, 64).join("");
  return {
    p_name: name,
    p_description: cleanText(input.description, MAX_DESCRIPTION_CHARS, true),
    p_author: input.author.trim(),
    p_mod_id: kind === "mod" ? d.modId : slug(name, kind),
    p_version: version.trim() ? version : kind === "mod" ? "unknown" : "1",
    p_loaders: d.loaders.map((l) => LOADER_IDS[l]),
    p_game_versions: d.gameVersions,
    p_sha1: report.sha1,
    p_size: report.size,
    p_file_name: fileName,
    p_scan: report,
    p_kind: kind,
    p_source: "web",
  };
}

export const MIME: Record<LibraryKind, string> = {
  mod: "application/java-archive",
  modpack: "application/x-modrinth-modpack+zip",
  resourcepack: "application/zip",
  shader: "application/zip",
};

/** Depodaki yol: <kullanıcı>/<sha1>.<uzantı> */
export function storagePath(userId: string, sha1: string, kind: LibraryKind): string {
  return `${userId}/${sha1}.${kindExt(kind)}`;
}

export interface MyUpload {
  id: number;
  kind: LibraryKind;
  name: string;
  version: string;
  author: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
  size: number;
}

export interface UploadApi {
  /** Giriş yapmış (anonim olmayan) kullanıcının kimliği; yoksa null. */
  userId(): Promise<string | null>;
  /** Dosyayı depoya yükler ve kaydı oluşturur; kaydın numarasını döndürür. */
  submit(userId: string, bytes: Uint8Array, submission: Submission): Promise<number>;
  myUploads(): Promise<MyUpload[]>;
  withdraw(userId: string, id: number): Promise<void>;
  report(id: number, reason: ReportReason, note: string): Promise<void>;
}
