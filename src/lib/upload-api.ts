// Yükleme, "Yüklediklerim", geri çekme ve şikâyet işlemlerinin Supabase ile yapılan hali.
import { kindExt, type LibraryKind } from "./scan/scan";
import { supabase } from "./supabase";
import {
  MAX_NOTE_CHARS,
  MIME,
  UploadError,
  cleanText,
  storagePath,
  uploadErrorCode,
  type MyUpload,
  type UploadApi,
} from "./upload";

const BUCKET = "library";

function fail(e: unknown): never {
  throw new UploadError(uploadErrorCode(e));
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    fail(e);
  }
}

interface ListRow {
  id: number;
  kind: LibraryKind | null;
  name: string;
  version: string;
  author: string;
  status: MyUpload["status"];
  review_note: string | null;
  created_at: string;
  size: number;
  mine: boolean;
}

export const uploadApi: UploadApi = {
  userId: () =>
    guard(async () => {
      const { data } = await supabase().auth.getSession();
      const user = data.session?.user;
      return user && !user.is_anonymous ? user.id : null;
    }),

  submit: (userId, bytes, s) =>
    guard(async () => {
      // 1) Dosya: <kullanıcı>/<sha1>.<uzantı> (aynı dosya tekrar yüklenirse üzerine yazılır)
      const path = storagePath(userId, s.p_sha1, s.p_kind);
      // Ham bayt olarak gönderilir; tür başlıkta (Content-Type) gider, launcher ile aynı.
      // Depo yalnızca jar / zip / mrpack türlerini kabul eder.
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const up = await supabase()
        .storage.from(BUCKET)
        .upload(path, body as ArrayBuffer, {
          contentType: MIME[s.p_kind],
          upsert: true,
        });
      if (up.error) fail(up.error);
      // 2) Kayıt: admin onayına "web" kaynağıyla düşer
      const { data, error } = await supabase().rpc("submit_library_mod", s);
      if (error) fail(error);
      return Number(data);
    }),

  myUploads: () =>
    guard(async () => {
      const { data, error } = await supabase().rpc("library_list", { p_max: 300, p_all: true });
      if (error) fail(error);
      return ((data ?? []) as ListRow[])
        .filter((r) => r.mine)
        .map((r) => ({
          id: r.id,
          kind: r.kind ?? "mod",
          name: r.name,
          version: r.version,
          author: r.author,
          status: r.status,
          reviewNote: r.review_note,
          createdAt: r.created_at,
          size: r.size,
        }));
    }),

  withdraw: (userId, id) =>
    guard(async () => {
      const { data, error } = await supabase().rpc("withdraw_library_mod", { p_id: id });
      if (error) fail(error);
      const sha1 = typeof data === "string" ? data.toLowerCase() : "";
      if (!/^[0-9a-f]{40}$/.test(sha1)) return;
      // Kayıtla birlikte tür de gitti: hangi uzantıysa o dosya silinir (launcher gibi)
      const paths = (["mod", "modpack", "resourcepack"] as const).map(
        (k) => `${userId}/${sha1}.${kindExt(k)}`,
      );
      await supabase().storage.from(BUCKET).remove(paths);
    }),

  report: (id, reason, note) =>
    guard(async () => {
      const { error } = await supabase().rpc("report_library_mod", {
        p_id: id,
        p_reason: reason,
        p_note: cleanText(note, MAX_NOTE_CHARS, true),
      });
      if (error) fail(error);
    }),
};
