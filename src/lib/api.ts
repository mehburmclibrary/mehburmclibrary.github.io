// Kütüphane verisini Supabase'den okur. Sunucu tarafı launcher reposundaki
// supabase/library_web.sql dosyasındadır: library_public_list() yalnızca onaylı içeriği
// döndürür, giriş gerektirmez. Arama, süzgeç, sıralama ve sayfalama sunucuda yapılır.
import { MAX_QUERY, searchTerm, versionOptions, type Filters, type LibraryItem } from "./library";
import { supabase } from "./supabase";

export const PAGE_SIZE = 24;

const COLUMNS =
  "id,kind,author,name,description,mod_id,version,loaders,game_versions,sha1,size,file_name,file_path,source,created_at,approved_at";

/** İmzalı indirme bağlantısının geçerlilik süresi (saniye). */
const DOWNLOAD_LINK_SECONDS = 60;

export interface Page {
  items: LibraryItem[];
  total: number;
}

function publicList(count?: "exact") {
  return supabase()
    .rpc("library_public_list", {}, count ? { count } : undefined)
    .select(COLUMNS);
}

/** Filtrelere uyan içeriklerden `offset`'ten başlayarak en fazla `limit` tanesi + toplam sayı. */
export async function listItems(f: Filters, offset = 0, limit = PAGE_SIZE): Promise<Page> {
  let query = publicList("exact");
  if (f.kind) query = query.eq("kind", f.kind);
  if (f.loader) query = query.contains("loaders", [f.loader]);
  if (f.mc) query = query.ilike("game_versions", `%${f.mc}%`);
  const term = searchTerm(f.q).slice(0, MAX_QUERY);
  if (term) {
    const like = `"*${term}*"`;
    query = query.or(
      ["name", "author", "description", "mod_id"].map((c) => `${c}.ilike.${like}`).join(","),
    );
  }
  query =
    f.sort === "name"
      ? query.order("name", { ascending: true }).order("id", { ascending: true })
      : query.order("approved_at", { ascending: false }).order("id", { ascending: false });
  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const items = (data ?? []) as unknown as LibraryItem[];
  return { items, total: count ?? items.length };
}

/** Tek bir onaylı içerik; yoksa (onaylı değilse ya da silindiyse) null. */
export async function getItem(id: number): Promise<LibraryItem | null> {
  const { data, error } = await publicList().eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as LibraryItem | null) ?? null;
}

/** Minecraft sürümü filtresinin seçenekleri (bütün onaylı içeriklerden). */
export async function listGameVersions(): Promise<string[]> {
  const { data, error } = await supabase().rpc("library_public_list").select("game_versions");
  if (error) throw new Error(error.message);
  return versionOptions((data ?? []) as unknown as { game_versions: string }[]);
}

/**
 * Dosya için kısa süreli bir indirme bağlantısı üretir. Tarayıcı bu bağlantıya gidince dosya
 * kendi adıyla iner. Her indirme Supabase'in aylık veri aktarım kotasından düşer.
 */
export async function downloadUrl(
  item: Pick<LibraryItem, "file_path" | "file_name">,
): Promise<string> {
  const { data, error } = await supabase()
    .storage.from("library")
    .createSignedUrl(item.file_path, DOWNLOAD_LINK_SECONDS, { download: item.file_name });
  if (error || !data) throw new Error(error?.message ?? "no url");
  return data.signedUrl;
}
