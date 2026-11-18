import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../lib/i18n";
import { UploadError, type MyUpload, type UploadApi } from "../lib/upload";
import { initMyUploads } from "./my-uploads";
import { createReportWidget } from "./report";
import { flush } from "./test-helpers";

const html = readFileSync(resolve(import.meta.dirname, "../../uploads/index.html"), "utf8");

function mount() {
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, "");
  history.replaceState(null, "", "/uploads/");
}

const upload = (over: Partial<MyUpload> = {}): MyUpload => ({
  id: 1,
  kind: "mod",
  name: "Cool Mod",
  version: "1.0",
  author: "Mehbur07",
  status: "pending",
  reviewNote: null,
  createdAt: "2026-11-18T10:00:00Z",
  size: 2048,
  ...over,
});

const box = () => document.querySelector<HTMLElement>("[data-my-uploads]")!;
const button = (text: string) =>
  [...box().querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  )!;

describe("Yüklediklerim", () => {
  beforeEach(() => {
    mount();
    setLang("en", false);
  });

  it("durumları ve admin notunu gösterir; onaylı içerik sayfasına bağlanır", async () => {
    const api = {
      userId: vi.fn(async () => "u"),
      myUploads: vi.fn(async () => [
        upload(),
        upload({ id: 2, name: "Shiny", status: "approved", kind: "shader" }),
        upload({ id: 3, name: "Bad", status: "rejected", reviewNote: "Çalıntı içerik" }),
      ]),
      withdraw: vi.fn(async () => undefined),
    };
    initMyUploads(document, api);
    await flush();
    const cards = [...box().querySelectorAll(".upload-card")];
    expect(cards.map((c) => c.querySelector(".status-badge")!.textContent)).toEqual([
      "Awaiting approval",
      "Published",
      "Rejected",
    ]);
    expect(cards[1]!.querySelector("a")!.getAttribute("href")).toBe("/item/?id=2");
    expect(cards[0]!.querySelector(".item-name a")).toBeNull();
    expect(cards[2]!.textContent).toContain("Admin note: Çalıntı içerik");
  });

  it("geri çekme onay ister, onaylanınca kartı kaldırır", async () => {
    const api = {
      userId: vi.fn(async () => "u"),
      myUploads: vi.fn(async () => [upload(), upload({ id: 2, name: "Other" })]),
      withdraw: vi.fn(async () => undefined),
    };
    initMyUploads(document, api);
    await flush();
    box().querySelector<HTMLButtonElement>('[data-focus="withdraw-1"]')!.click();
    expect(box().textContent).toContain("Delete it from the library");
    button("Cancel").click();
    expect(api.withdraw).not.toHaveBeenCalled();
    box().querySelector<HTMLButtonElement>('[data-focus="withdraw-1"]')!.click();
    button("Yes, withdraw").click();
    await flush();
    expect(api.withdraw).toHaveBeenCalledWith("u", 1);
    expect(box().querySelectorAll(".upload-card")).toHaveLength(1);
  });

  it("geri çekme hatasını kartta gösterir", async () => {
    const api = {
      userId: vi.fn(async () => "u"),
      myUploads: vi.fn(async () => [upload()]),
      withdraw: vi.fn(async () => Promise.reject(new UploadError("network"))),
    };
    initMyUploads(document, api);
    await flush();
    box().querySelector<HTMLButtonElement>('[data-focus="withdraw-1"]')!.click();
    button("Yes, withdraw").click();
    await flush();
    expect(box().querySelector('[role="alert"]')!.textContent).toContain("couldn't be reached");
    expect(box().querySelectorAll(".upload-card")).toHaveLength(1);
  });

  it("boşsa ve giriş yapılmamışsa uygun mesaj", async () => {
    initMyUploads(document, {
      userId: vi.fn(async () => "u"),
      myUploads: vi.fn(async () => []),
      withdraw: vi.fn(),
    });
    await flush();
    expect(box().textContent).toContain("haven't uploaded anything yet");
    mount();
    initMyUploads(document, {
      userId: vi.fn(async () => null),
      myUploads: vi.fn(),
      withdraw: vi.fn(),
    });
    await flush();
    expect(box().textContent).toContain("Sign in first");
  });
});

describe("şikâyet bölümü", () => {
  beforeEach(() => setLang("en", false));

  const widget = (api: Pick<UploadApi, "userId" | "report">) => {
    const w = createReportWidget(7, api);
    document.body.replaceChildren(w.el);
    return w.el;
  };

  it("giriş yapılmamışsa giriş bağlantısı gösterir", async () => {
    const el = widget({ userId: vi.fn(async () => null), report: vi.fn() });
    el.querySelector<HTMLButtonElement>("[data-report-toggle]")!.click();
    await flush();
    expect(el.textContent).toContain("You need to sign in");
    expect(el.querySelector('a[href="/account/"]')).not.toBeNull();
  });

  it("sebep seçilmeden göndermez; gönderince teşekkür eder", async () => {
    const report = vi.fn(async () => undefined);
    const el = widget({ userId: vi.fn(async () => "u"), report });
    el.querySelector<HTMLButtonElement>("[data-report-toggle]")!.click();
    await flush();
    el.querySelector<HTMLFormElement>("form")!.requestSubmit();
    expect(report).not.toHaveBeenCalled();
    const reason = el.querySelector<HTMLSelectElement>("#r-reason")!;
    reason.value = "broken";
    reason.dispatchEvent(new Event("change"));
    const note = el.querySelector<HTMLTextAreaElement>("#r-note")!;
    note.value = "açılmıyor";
    note.dispatchEvent(new Event("input"));
    el.querySelector<HTMLFormElement>("form")!.requestSubmit();
    await flush();
    expect(report).toHaveBeenCalledWith(7, "broken", "açılmıyor");
    expect(el.querySelector('[role="status"]')!.textContent).toContain("sent to the admins");
  });

  it("kendi içeriğini şikâyet edemez", async () => {
    const el = widget({
      userId: vi.fn(async () => "u"),
      report: vi.fn(async () => Promise.reject(new UploadError("ownReport"))),
    });
    el.querySelector<HTMLButtonElement>("[data-report-toggle]")!.click();
    await flush();
    const reason = el.querySelector<HTMLSelectElement>("#r-reason")!;
    reason.value = "other";
    reason.dispatchEvent(new Event("change"));
    el.querySelector<HTMLFormElement>("form")!.requestSubmit();
    await flush();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain("can't report your own");
  });
});
