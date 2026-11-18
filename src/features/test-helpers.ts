// Testlerde ortak kullanılan sahte içerik.
import type { LibraryItem } from "../lib/library";

export function fakeItem(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 18,
    kind: "mod",
    author: "MehburMC",
    name: "Iron Golem Troll",
    description: "Demir golemler artık şaka yapıyor.",
    mod_id: "iron_golem_troll",
    version: "1.0.0",
    loaders: ["fabric", "quilt"],
    game_versions: "~26.2",
    sha1: "31c1442563af9ddbb9ddc0fe3325d36b9b4a675f",
    size: 24035,
    file_name: "iron-golem-troll-1.0.0.jar",
    file_path: "c0def4cd-7da0-4783-82dd-d131eadfc9ef/31c1442563af9ddbb9ddc0fe3325d36b9b4a675f.jar",
    source: "launcher",
    created_at: "2026-11-03T10:00:00Z",
    approved_at: "2026-11-03T12:00:00Z",
    ...overrides,
  };
}

/** Bekleyen bütün promise'ler ve zamanlayıcılar bitene kadar bekler. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}
