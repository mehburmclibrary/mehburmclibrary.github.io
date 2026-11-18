import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../lib/auth";
import { setLang } from "../lib/i18n";
import type { LibraryKind, ScanReport } from "../lib/scan/scan";
import { UploadError, type Submission } from "../lib/upload";
import { findingText, initUpload, type UploadDeps } from "./upload";
import { flush } from "./test-helpers";

const html = readFileSync(resolve(import.meta.dirname, "../../upload/index.html"), "utf8");

function mount(search = "") {
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, "");
  history.replaceState(null, "", `/upload/${search}`);
}

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
  sha1: "b".repeat(40),
  size: 4,
  classes: 2,
  scanner: 2,
  kind: "mod",
  ...over,
});

function deps(over: Partial<UploadDeps> = {}, uploads: Partial<UploadDeps["uploads"]> = {}) {
  return {
    uploads: {
      userId: vi.fn(async () => "user-1"),
      submit: vi.fn(async () => 42),
      ...uploads,
    },
    account: vi.fn(async () => ({ rank: 0, ban: null })),
    names: vi.fn(async () => ["Mehbur07", "Alt_Ad"]),
    scan: vi.fn(async (_b: Uint8Array, kind: LibraryKind) => report({ kind })),
    ...over,
  } satisfies UploadDeps;
}

const box = () => document.querySelector<HTMLElement>("[data-upload]")!;

async function pick(name: string, bytes = new Uint8Array([1, 2, 3, 4])) {
  const input = box().querySelector<HTMLInputElement>("#u-file")!;
  const file = new File([bytes], name);
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  await flush();
  await flush();
}

describe("yükleme sayfası", () => {
  beforeEach(() => {
    mount();
    setLang("en", false);
  });

  it("giriş yapmamışa, banlıya ve adı olmayana uygun mesajı gösterir", async () => {
    initUpload(document, deps({}, { userId: vi.fn(async () => null) }));
    await flush();
    expect(box().textContent).toContain("Sign in first");
    expect(box().querySelector('a[href="/account/"]')).not.toBeNull();

    mount();
    initUpload(
      document,
      deps({ account: vi.fn(async () => ({ rank: 0, ban: { until: null, reason: "x" } })) }),
    );
    await flush();
    expect(box().textContent).toContain("Your account is banned");
    expect(box().querySelector("#u-file")).toBeNull();

    mount();
    initUpload(document, deps({ names: vi.fn(async () => []) }));
    await flush();
    expect(box().textContent).toContain("Add an account name first");

    mount();
    initUpload(
      document,
      deps({ names: vi.fn(async () => Promise.reject(new AuthError("serverNotReady"))) }),
    );
    await flush();
    expect(box().textContent).toContain("isn't ready");
  });

  it("dosya seç → kontrol → bilgiler → yükle", async () => {
    const d = deps();
    initUpload(document, d);
    await flush();
    await pick("Cool Mod.jar");
    expect(d.scan).toHaveBeenCalledWith(new Uint8Array([1, 2, 3, 4]), "mod");
    expect(box().querySelector(".scan-report")!.textContent).toContain("Passed the check");
    expect(box().querySelector<HTMLInputElement>("#u-name")!.value).toBe("Cool Mod");
    const desc = box().querySelector<HTMLTextAreaElement>("#u-desc")!;
    desc.value = "Harika bir mod";
    desc.dispatchEvent(new Event("input"));
    const author = box().querySelector<HTMLSelectElement>("#u-author")!;
    author.value = "Alt_Ad";
    author.dispatchEvent(new Event("change"));
    box().querySelector<HTMLFormElement>(".upload-form")!.requestSubmit();
    await flush();
    const [userId, bytes, s] = vi.mocked(d.uploads.submit).mock.calls[0]! as [
      string,
      Uint8Array,
      Submission,
    ];
    expect(userId).toBe("user-1");
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(s).toMatchObject({
      p_name: "Cool Mod",
      p_description: "Harika bir mod",
      p_author: "Alt_Ad",
      p_file_name: "Cool_Mod.jar",
      p_source: "web",
      p_kind: "mod",
    });
    expect(box().querySelector("[data-done]")!.textContent).toContain("Uploaded");
    expect(box().querySelector('a[href="/uploads/"]')).not.toBeNull();
  });

  it("engellenen dosyada bilgi formu çıkmaz, bulgular türe özel metinle yazılır", async () => {
    const d = deps({
      scan: vi.fn(async () =>
        report({
          kind: "shader",
          verdict: "block",
          descriptor: null,
          findings: [{ severity: "block", code: "noDescriptor", examples: ["/"] }],
        }),
      ),
    });
    mount("?kind=shader");
    initUpload(document, d);
    await flush();
    expect(box().querySelector<HTMLInputElement>('input[value="shader"]')!.checked).toBe(true);
    await pick("x.zip");
    expect(box().querySelector(".scan-report")!.textContent).toContain("can't be uploaded");
    expect(box().querySelector(".finding")!.textContent).toBe(
      findingText("shader", "noDescriptor"),
    );
    expect(findingText("shader", "noDescriptor")).not.toBe(findingText("mod", "noDescriptor"));
    expect(box().querySelector(".upload-form")).toBeNull();
  });

  it("uyarılı dosyada onay kutusu işaretlenmeden gönderilmez", async () => {
    const d = deps({
      scan: vi.fn(async () =>
        report({
          verdict: "warn",
          findings: [{ severity: "warn", code: "network", examples: ["a/B.class"] }],
        }),
      ),
    });
    initUpload(document, d);
    await flush();
    await pick("m.jar");
    expect(box().querySelector(".finding details")!.textContent).toContain("a/B.class");
    box().querySelector<HTMLFormElement>(".upload-form")!.requestSubmit();
    await flush();
    expect(box().querySelector("[data-submit-error]")!.textContent).toContain("read the warnings");
    expect(d.uploads.submit).not.toHaveBeenCalled();
    const ack = box().querySelector<HTMLInputElement>("#u-ack")!;
    ack.checked = true;
    ack.dispatchEvent(new Event("change"));
    box().querySelector<HTMLFormElement>(".upload-form")!.requestSubmit();
    await flush();
    expect(d.uploads.submit).toHaveBeenCalled();
  });

  it("sınırı aşan dosya okunmaz bile", async () => {
    const d = deps();
    initUpload(document, d);
    await flush();
    const input = box().querySelector<HTMLInputElement>("#u-file")!;
    const big = new File(["x"], "big.jar");
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    Object.defineProperty(input, "files", { value: [big] });
    input.dispatchEvent(new Event("change"));
    await flush();
    expect(d.scan).not.toHaveBeenCalled();
    expect(box().querySelector(".scan-report")!.textContent).toContain(
      "the limit for this type is 25 MB",
    );
  });

  it("tür değişince dosya o türün kurallarıyla yeniden taranır", async () => {
    const d = deps();
    initUpload(document, d);
    await flush();
    await pick("pack.zip");
    const rp = box().querySelector<HTMLInputElement>('input[value="resourcepack"]')!;
    rp.checked = true;
    rp.dispatchEvent(new Event("change"));
    await flush();
    expect(d.scan).toHaveBeenLastCalledWith(expect.any(Uint8Array), "resourcepack");
    expect(location.search).toBe("?kind=resourcepack");
  });

  it("sunucu hatasını anlaşılır gösterir", async () => {
    const d = deps({}, { submit: vi.fn(async () => Promise.reject(new UploadError("quota"))) });
    initUpload(document, d);
    await flush();
    await pick("m.jar");
    box().querySelector<HTMLFormElement>(".upload-form")!.requestSubmit();
    await flush();
    expect(box().querySelector("[data-submit-error]")!.textContent).toContain("Up to 10");
    // Form ve seçilen dosya kalır, tekrar denenebilir
    expect(box().querySelector(".upload-form")).not.toBeNull();
  });

  it("dosyadaki ad ve açıklama HTML olarak çalışmaz", async () => {
    const evil = '<img src=x onerror="window.hacked=1">';
    const d = deps({
      scan: vi.fn(async () =>
        report({
          verdict: "warn",
          descriptor: {
            modId: "x",
            name: evil,
            version: evil,
            loaders: ["fabric"],
            gameVersions: evil,
          },
          findings: [{ severity: "warn", code: "network", examples: [evil] }],
        }),
      ),
    });
    initUpload(document, d);
    await flush();
    await pick(`${evil}.jar`);
    expect(box().querySelector("img")).toBeNull();
    expect(box().textContent).toContain(evil);
  });
});
