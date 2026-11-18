import { describe, expect, it } from "vitest";
import type { ScanReport } from "./scan/scan";
import {
  UploadError,
  cleanText,
  libraryFileName,
  prepareSubmission,
  slug,
  storagePath,
  uploadErrorCode,
} from "./upload";

const report = (over: Partial<ScanReport> = {}): ScanReport => ({
  verdict: "pass",
  descriptor: {
    modId: "coolmod",
    name: "Cool Mod",
    version: "1.2.0",
    loaders: ["fabric", "quilt"],
    gameVersions: ">=1.21",
  },
  findings: [],
  sha1: "a".repeat(40),
  size: 1234,
  classes: 3,
  scanner: 2,
  kind: "mod",
  ...over,
});

describe("dosya adı ve kimlik (launcher ile aynı)", () => {
  it("dosya adını sunucunun kabul ettiği biçime getirir", () => {
    expect(libraryFileName("C:\\mods\\Cool Mod (1.2).jar", "mod")).toBe("Cool_Mod__1.2_.jar");
    expect(libraryFileName("sodium.jar.disabled", "mod")).toBe("sodium.jar");
    expect(libraryFileName("Pack.ZIP", "resourcepack")).toBe("Pack.zip");
    expect(libraryFileName("pack.mrpack", "modpack")).toBe("pack.mrpack");
    expect(libraryFileName("...", "shader")).toBe("shader.zip");
    expect(libraryFileName(`${"a".repeat(200)}.jar`, "mod")).toHaveLength(120);
  });

  it("paket adından kimlik üretir", () => {
    expect(slug("  Garip ŞeylerMC!! v2 ", "modpack")).toBe("garip-eylermc-v2");
    expect(slug("...", "shader")).toBe("shader");
  });

  it("metni temizler", () => {
    expect(cleanText("  a\u0007b\nc  ", 10, true)).toBe("ab\nc");
    expect(cleanText("a\nb", 10, false)).toBe("ab");
    expect(cleanText("abcdef", 3, false)).toBe("abc");
  });

  it("depo yolu", () => {
    expect(storagePath("u-1", "f".repeat(40), "modpack")).toBe(`u-1/${"f".repeat(40)}.mrpack`);
  });
});

describe("prepareSubmission", () => {
  const base = {
    kind: "mod" as const,
    fileName: "cool.jar",
    name: "",
    description: "",
    author: " Mehbur07 ",
  };

  it("launcher'daki alanları hazırlar ve kaynağı 'web' yapar", () => {
    const s = prepareSubmission({
      ...base,
      report: report(),
      description: " Güzel\u0007 mod\n2. satır ",
    });
    expect(s).toMatchObject({
      p_name: "Cool Mod",
      p_description: "Güzel mod\n2. satır",
      p_author: "Mehbur07",
      p_mod_id: "coolmod",
      p_version: "1.2.0",
      p_loaders: ["fabric", "quilt"],
      p_game_versions: ">=1.21",
      p_sha1: "a".repeat(40),
      p_size: 1234,
      p_file_name: "cool.jar",
      p_kind: "mod",
      p_source: "web",
    });
    expect(s.p_scan.kind).toBe("mod");
  });

  it("kullanıcının yazdığı ad öne geçer; ad yoksa dosya adı kullanılır", () => {
    expect(prepareSubmission({ ...base, report: report(), name: "Benim Modum" }).p_name).toBe(
      "Benim Modum",
    );
    const noName = report({
      kind: "shader",
      descriptor: { modId: "", name: "", version: "", loaders: [], gameVersions: "" },
    });
    const s = prepareSubmission({
      ...base,
      kind: "shader",
      fileName: "BSL v8.zip",
      report: noName,
    });
    expect(s.p_name).toBe("BSL_v8");
    expect(s.p_mod_id).toBe("bsl_v8");
    expect(s.p_version).toBe("1");
  });

  it("sürümsüz mod 'unknown' olur, NeoForge sunucuya 'neoforge' gider", () => {
    const r = report({
      descriptor: {
        modId: "neo",
        name: "Neo",
        version: " ",
        loaders: ["neoForge"],
        gameVersions: "",
      },
    });
    const s = prepareSubmission({ ...base, report: r });
    expect(s.p_version).toBe("unknown");
    expect(s.p_loaders).toEqual(["neoforge"]);
  });

  it("engellenen, tanımsız ya da başka türde taranmış dosyayı kabul etmez", () => {
    expect(() => prepareSubmission({ ...base, report: report({ verdict: "block" }) })).toThrow(
      UploadError,
    );
    expect(() => prepareSubmission({ ...base, report: report({ descriptor: null }) })).toThrow(
      UploadError,
    );
    expect(() => prepareSubmission({ ...base, kind: "shader", report: report() })).toThrow(
      UploadError,
    );
  });
});

describe("uploadErrorCode", () => {
  it("sunucu ve depo hatalarını çevirir", () => {
    expect(uploadErrorCode({ message: "library.quota" })).toBe("quota");
    expect(uploadErrorCode({ message: "library.storageFull" })).toBe("storageFull");
    expect(uploadErrorCode({ message: "friends.rateLimited" })).toBe("rateLimited");
    expect(uploadErrorCode({ message: "textures.authorInvalid" })).toBe("authorInvalid");
    expect(uploadErrorCode({ message: "textures.ownReport" })).toBe("ownReport");
    expect(uploadErrorCode({ code: "PGRST202", message: "x" })).toBe("serverNotReady");
    expect(uploadErrorCode({ statusCode: "413", message: "Payload too large" })).toBe("tooLarge");
    expect(uploadErrorCode({ statusCode: "415", message: "mime type not supported" })).toBe(
      "badKind",
    );
    expect(uploadErrorCode(new TypeError("Failed to fetch"))).toBe("network");
    expect(uploadErrorCode(new UploadError("blocked"))).toBe("blocked");
    expect(uploadErrorCode({})).toBe("unknown");
  });
});
