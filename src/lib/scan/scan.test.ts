// Launcher'daki tarayıcı testlerinin (scan.rs, mod tests) birebir karşılığı: aynı dosyalar,
// aynı beklentiler. İki taraf aynı dosyaya aynı kararı vermeli.
import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import {
  MAX_JAR_BYTES,
  MAX_PACK_BYTES,
  clean,
  descriptor,
  kindExt,
  lenientJson,
  maxBytes,
  scanAs,
  scanMod,
  tomlValue,
  type ScanReport,
} from "./scan";

/** Sabit havuzunda verilen metod çağrıları ve metinler olan en küçük sınıf dosyası. */
export function classFile(methods: [string, string][], strings: string[]): Uint8Array {
  const pool: number[][] = [];
  const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
  const utf8 = (s: string) => {
    const b = [...new TextEncoder().encode(s)];
    pool.push([1, ...u16(b.length), ...b]);
    return pool.length;
  };
  for (const [owner, name] of methods) {
    const o = utf8(owner);
    pool.push([7, ...u16(o)]);
    const classIdx = pool.length;
    const n = utf8(name);
    const d = utf8("()V");
    pool.push([12, ...u16(n), ...u16(d)]);
    const nat = pool.length;
    pool.push([10, ...u16(classIdx), ...u16(nat)]);
  }
  for (const s of strings) {
    const u = utf8(s);
    pool.push([8, ...u16(u)]);
  }
  // long / double iki yer kaplar
  pool.push([5, 0, 0, 0, 0, 0, 0, 0, 0]);
  const out = [0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 65, ...u16(pool.length + 2)];
  for (const e of pool) out.push(...e);
  out.push(...new Array<number>(10).fill(0));
  return new Uint8Array(out);
}

export function jar(files: [string, Uint8Array | string][]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [n, b] of files) entries[n] = typeof b === "string" ? strToU8(b) : b;
  return zipSync(entries);
}

export const fabricJson = () =>
  '{"schemaVersion":1,"id":"coolmod","name":"Cool Mod","version":"1.2.0","depends":{"minecraft":">=1.21"}}';

const codes = (r: ScanReport) => r.findings.map((f) => f.code);
const mz = () => new Uint8Array([0x4d, 0x5a, ...new Array<number>(100).fill(0)]);

describe("mod tarayıcısı (launcher ile aynı)", () => {
  it("temiz mod geçer", async () => {
    const r = await scanMod(
      jar([
        ["fabric.mod.json", fabricJson()],
        ["com/cool/Mod.class", classFile([["java/util/List", "add"]], ["hello"])],
      ]),
    );
    expect(r.verdict, JSON.stringify(r.findings)).toBe("pass");
    expect(r.descriptor).toMatchObject({
      modId: "coolmod",
      version: "1.2.0",
      gameVersions: ">=1.21",
    });
    expect(r.descriptor!.loaders).toEqual(["fabric", "quilt"]);
    expect(r.classes).toBe(1);
    expect(r.sha1).toMatch(/^[0-9a-f]{40}$/);
    expect(r.kind).toBe("mod");
    expect(r.scanner).toBe(2);
  });

  it("bilgi çalma kalıpları engellenir", async () => {
    const r = await scanMod(
      jar([
        ["fabric.mod.json", fabricJson()],
        [
          "a/Grab.class",
          classFile(
            [["java/net/URL", "openConnection"]],
            [
              "\\AppData\\Roaming\\discord\\Local Storage\\leveldb",
              "https://discord.com/api/webhooks/1/abc",
            ],
          ),
        ],
      ]),
    );
    expect(r.verdict).toBe("block");
    expect(codes(r)).toEqual(expect.arrayContaining(["webhook", "credentialPaths", "network"]));
    expect(r.findings[0]!.severity).toBe("block");
  });

  it("gizli kod ve çalıştırılabilir dosyalar engellenir", async () => {
    const r = await scanMod(
      jar([
        ["fabric.mod.json", fabricJson()],
        [
          "x/Loader.class",
          classFile(
            [
              ["java/util/Base64$Decoder", "decode"],
              ["java/lang/ClassLoader", "defineClass"],
            ],
            [],
          ),
        ],
        ["assets/run.bat", "@echo off"],
        ["assets/icon.png", mz()],
      ]),
    );
    expect(r.verdict).toBe("block");
    expect(codes(r)).toEqual(expect.arrayContaining(["hiddenPayload", "executable"]));
    expect(r.findings.find((f) => f.code === "executable")!.examples).toEqual([
      "assets/icon.png",
      "assets/run.bat",
    ]);
  });

  it("riskli ama meşru davranışlar uyarı verir", async () => {
    const r = await scanMod(
      jar([
        ["fabric.mod.json", fabricJson()],
        [
          "m/Update.class",
          classFile(
            [
              ["java/net/http/HttpClient", "send"],
              ["java/lang/ProcessBuilder", "start"],
              ["java/lang/System", "loadLibrary"],
            ],
            ["https://pastebin.com/raw/x"],
          ),
        ],
        ["natives/lib.dll", mz()],
        ["natives/lib.so", "ELF...."],
      ]),
    );
    expect(r.verdict, JSON.stringify(r.findings)).toBe("warn");
    for (const want of ["network", "processExec", "nativeLoad", "nativeBinary", "suspiciousUrl"]) {
      expect(codes(r)).toContain(want);
    }
  });

  it("iç içe jar'lar da taranır", async () => {
    const inner = jar([
      ["evil/Steal.class", classFile([], ["https://discordapp.com/api/webhooks/9/x"])],
    ]);
    const r = await scanMod(
      jar([
        ["fabric.mod.json", fabricJson()],
        ["META-INF/jars/lib.jar", inner],
      ]),
    );
    expect(r.verdict).toBe("block");
    expect(r.findings.find((f) => f.code === "webhook")!.examples).toEqual([
      "META-INF/jars/lib.jar!/evil/Steal.class",
    ]);
  });

  it("mod olmayan ya da bozuk dosya engellenir", async () => {
    expect(codes(await scanMod(strToU8("not a zip")))).toEqual(["notAJar"]);
    expect(codes(await scanMod(jar([["a.txt", "hi"]])))).toEqual(["noDescriptor"]);
    const r = await scanMod(
      jar([
        ["fabric.mod.json", fabricJson()],
        ["a/B.class", new Uint8Array([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 65, 0xff, 0xff, 7])],
      ]),
    );
    expect(codes(r)).toEqual(["badClass"]);
    expect(r.verdict).toBe("warn");
  });

  it("zip bombası engellenir", async () => {
    const r = await scanMod(
      jar([
        ["fabric.mod.json", fabricJson()],
        ["big.txt", new Uint8Array(8 * 1024 * 1024)],
      ]),
    );
    expect(codes(r)).toContain("zipBomb");
  });

  it("Forge / NeoForge tanımı ve Minecraft aralığı", () => {
    const toml =
      'modLoader="javafml"\n[[mods]]\nmodId="jei"\nversion="19.0"\ndisplayName="Just Enough Items"\n[[dependencies.jei]]\nmodId="forge"\nversionRange="[47,)"\n[[dependencies.jei]]\nmodId="minecraft"\nversionRange="[1.20.1,1.21)"\n';
    const d = descriptor(jar([["META-INF/mods.toml", toml]]))!;
    expect(d.modId).toBe("jei");
    expect(d.loaders).toEqual(["forge"]);
    expect(d.gameVersions).toBe("[1.20.1,1.21)");
    expect(descriptor(jar([["META-INF/neoforge.mods.toml", toml]]))!.loaders).toEqual(["neoForge"]);
    expect(descriptor(jar([["fabric.mod.json", '{"id":"Bad Id!"}']]))).toBeNull();
  });

  it("Forge sürümü ${...} ise MANIFEST'ten okunur", () => {
    const toml = '[[mods]]\nmodId="cool"\nversion="${file.jarVersion}"\n';
    const d = descriptor(
      jar([
        ["META-INF/mods.toml", toml],
        ["META-INF/MANIFEST.MF", "Manifest-Version: 1.0\r\nImplementation-Version: 3.4.5\r\n"],
      ]),
    )!;
    expect(d.version).toBe("3.4.5");
    expect(d.name).toBe("cool");
  });

  it("Quilt tanımı", () => {
    const q =
      '{"quilt_loader":{"id":"qmod","version":"2.0","metadata":{"name":"Q Mod"},"depends":[{"id":"minecraft","versions":[">=1.20","<1.22"]}]}}';
    expect(descriptor(jar([["quilt.mod.json", q]]))).toEqual({
      modId: "qmod",
      name: "Q Mod",
      version: "2.0",
      loaders: ["quilt"],
      gameVersions: ">=1.20 || <1.22",
    });
  });

  it("karartılmış (obfuscated) kod uyarı verir", async () => {
    const cls = classFile([], []);
    const build = (names: string[]) =>
      scanMod(
        jar([
          ["fabric.mod.json", fabricJson()],
          ...names.map((n): [string, Uint8Array] => [n, cls]),
        ]),
      );
    const short = "abcdefghijklmnopqrstuvwxyz".split("").map((c) => `a/${c}.class`);
    expect(codes(await build(short))).toContain("obfuscated");
    const normal = Array.from({ length: 26 }, (_, i) => `com/cool/Feature${i}.class`);
    expect((await build(normal)).verdict).toBe("pass");
  });
});

const mcmeta = () =>
  JSON.stringify({ pack: { pack_format: 46, description: "§6Faithful §r32x\nsecond line" } });

const mrIndex = (files: unknown[]) =>
  JSON.stringify({
    formatVersion: 1,
    game: "minecraft",
    versionId: "1.4.0",
    name: "Mehbur Pack",
    dependencies: { minecraft: "1.21.4", "fabric-loader": "0.16.9" },
    files,
  });

const mrFile = (path: string, url: string): Record<string, unknown> => ({
  path,
  hashes: { sha1: "ab", sha512: "cd" },
  downloads: [url],
  fileSize: 10,
});

describe("paket tarayıcısı (launcher ile aynı)", () => {
  it("resource pack geçer ve pack.mcmeta okunur", async () => {
    const r = await scanAs(
      jar([
        ["pack.mcmeta", mcmeta()],
        ["pack.png", "\x89PNG...."],
        ["assets/minecraft/textures/block/stone.png", "\x89PNG"],
      ]),
      "resourcepack",
    );
    expect(r.verdict, JSON.stringify(r.findings)).toBe("pass");
    expect(r.kind).toBe("resourcepack");
    expect(r.descriptor).toMatchObject({
      name: "Faithful 32x",
      version: "pack_format 46",
      loaders: [],
    });
  });

  it("paketlerde kod olamaz", async () => {
    const r = await scanAs(
      jar([
        ["pack.mcmeta", mcmeta()],
        ["assets/x/Evil.class", classFile([], [])],
        ["assets/x/lib.jar", jar([["a.txt", "a"]])],
        ["assets/x/run.bat", "@echo off"],
        ["assets/x/innocent.png", mz()],
        ["assets/x/native.dll", "MZ"],
      ]),
      "resourcepack",
    );
    expect(r.verdict).toBe("block");
    for (const c of ["codeInPack", "executable", "nativeBinary"]) expect(codes(r)).toContain(c);
    expect(r.classes).toBe(0);
  });

  it("paketler kendi işaret dosyalarını ister", async () => {
    expect(codes(await scanAs(jar([["Faithful/pack.mcmeta", mcmeta()]]), "resourcepack"))).toEqual([
      "noDescriptor",
    ]);
    const shader = await scanAs(jar([["shaders/final.fsh", "void main(){}"]]), "shader");
    expect(shader.verdict, JSON.stringify(shader.findings)).toBe("pass");
    expect(codes(await scanAs(jar([["readme.txt", "hi"]]), "shader"))).toEqual(["noDescriptor"]);
    expect(codes(await scanAs(strToU8("not a zip"), "shader"))).toEqual(["notAJar"]);
  });

  it("modpack dizini okunur, indirmeler denetlenir", async () => {
    const ok = await scanAs(
      jar([
        [
          "modrinth.index.json",
          mrIndex([
            mrFile(
              "mods/sodium.jar",
              "https://cdn.modrinth.com/data/AANobbMI/versions/x/sodium.jar",
            ),
          ]),
        ],
      ]),
      "modpack",
    );
    expect(ok.verdict, JSON.stringify(ok.findings)).toBe("pass");
    expect(ok.descriptor).toMatchObject({
      name: "Mehbur Pack",
      version: "1.4.0",
      loaders: ["fabric"],
      gameVersions: "1.21.4",
    });

    const noHash = mrFile("mods/b.jar", "https://cdn.modrinth.com/b.jar");
    noHash.hashes = {};
    const bad = await scanAs(
      jar([
        [
          "modrinth.index.json",
          mrIndex([
            mrFile("mods/a.jar", "https://github.com/x/y/releases/download/1/a.jar"),
            noHash,
            mrFile("mods/c.jar", "https://evil.example/c.jar"),
            mrFile("mods/d.jar", "http://cdn.modrinth.com/d.jar"),
            mrFile("../../evil.jar", "https://cdn.modrinth.com/e.jar"),
            mrFile("config/run.exe", "https://cdn.modrinth.com/run.exe"),
          ]),
        ],
      ]),
      "modpack",
    );
    expect(bad.verdict).toBe("block");
    const f = (code: string) => bad.findings.find((x) => x.code === code);
    expect(f("externalDownload")!.examples).toEqual(["mods/a.jar"]);
    expect(f("badDownload")!.examples).toEqual(["mods/b.jar", "mods/c.jar", "mods/d.jar"]);
    expect(f("unsafePath")!.examples).toEqual(["../../evil.jar"]);
    expect(f("executable")).toBeDefined();
  });

  it("modpack içindeki override modlar mod kurallarıyla taranır", async () => {
    const stealer = jar([
      ["fabric.mod.json", fabricJson()],
      ["a/Grab.class", classFile([], ["https://discord.com/api/webhooks/1/abc"])],
    ]);
    const cleanJar = jar([["fabric.mod.json", fabricJson()]]);
    const pack = (extra: [string, Uint8Array | string][]) =>
      scanAs(jar([["modrinth.index.json", mrIndex([])], ...extra]), "modpack");
    const ok = await pack([
      ["overrides/mods/own.jar", cleanJar],
      ["overrides/config/own.json", "{}"],
    ]);
    expect(ok.verdict, JSON.stringify(ok.findings)).toBe("pass");
    const bad = await pack([["overrides/mods/grab.jar", stealer]]);
    expect(bad.verdict).toBe("block");
    expect(codes(bad)).toContain("webhook");
    expect(codes(await pack([["Loose.class", classFile([], [])]]))).toContain("codeInPack");
    expect(codes(await pack([]))).toEqual([]);
    expect(codes(await scanAs(jar([["x.txt", "x"]]), "modpack"))).toEqual(["noDescriptor"]);
  });

  it("paketlerin kendi boyut sınırı var", async () => {
    expect(maxBytes("mod")).toBe(MAX_JAR_BYTES);
    expect(codes(await scanAs(new Uint8Array(MAX_PACK_BYTES + 1), "shader"))).toEqual(["tooLarge"]);
    expect((["mod", "modpack", "resourcepack"] as const).map(kindExt)).toEqual([
      "jar",
      "mrpack",
      "zip",
    ]);
  });
});

describe("metin yardımcıları (launcher ile aynı)", () => {
  it("clean: kontrol karakterleri ve § kodları atılır, ${...} reddedilir", () => {
    expect(clean("  §6Gold§r Mod\u0007 ")).toBe("Gold Mod");
    expect(clean("${version}")).toBeNull();
    expect(clean("   ")).toBeNull();
    expect(clean("a".repeat(100))).toHaveLength(80);
  });

  it("lenientJson: yorumlar ve string içi satır sonları kabul edilir", () => {
    expect(lenientJson('{\n // yorum\n "id": "a", /* blok */ "name": "x\ny"}')).toEqual({
      id: "a",
      name: "x y",
    });
    expect(lenientJson("{bozuk")).toBeNull();
  });

  it("tomlValue", () => {
    expect(tomlValue('modId = "jei"', "modId")).toBe("jei");
    expect(tomlValue("displayName='''Just'''", "displayName")).toBe("Just");
    expect(tomlValue('modIdX="a"', "modId")).toBeNull();
    expect(tomlValue("modId=jei", "modId")).toBeNull();
  });
});
