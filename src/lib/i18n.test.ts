import { beforeEach, describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { tr } from "../i18n/tr";
import { applyTranslations, currentLang, detectLang, LANG_KEY, setLang } from "./i18n";

describe("detectLang", () => {
  it("kayıtlı seçimi kullanır", () => {
    expect(detectLang("en", ["tr-TR"])).toBe("en");
    expect(detectLang("tr", ["en-US"])).toBe("tr");
  });

  it("kayıt yoksa tarayıcı dillerinden birinde Türkçe varsa tr seçer", () => {
    expect(detectLang(null, ["en-US", "tr-TR"])).toBe("tr");
    expect(detectLang(null, ["TR"])).toBe("tr");
  });

  it("Türkçe yoksa ya da kayıt bozuksa en seçer", () => {
    expect(detectLang(null, ["de-DE", "en-GB"])).toBe("en");
    expect(detectLang("fr", [])).toBe("en");
  });
});

describe("sözlükler", () => {
  it("iki dilde de aynı anahtarlar var ve hiçbiri boş değil", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
    for (const value of [...Object.values(tr), ...Object.values(en)]) {
      expect(value.trim()).not.toBe("");
    }
  });
});

describe("applyTranslations / setLang", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <p data-i18n="nav.library"></p>
      <button data-i18n-attr="aria-label:theme.toLight;title:theme.toDark"></button>
      <span data-i18n="olmayan.anahtar">dokunulmaz</span>`;
  });

  it("yazıları ve özellikleri seçili dile çevirir, seçimi kaydeder", () => {
    setLang("en");
    expect(currentLang()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem(LANG_KEY)).toBe("en");
    expect(document.querySelector("p")?.textContent).toBe("Library");
    const btn = document.querySelector("button");
    expect(btn?.getAttribute("aria-label")).toBe("Switch to light theme");
    expect(btn?.getAttribute("title")).toBe("Switch to dark theme");

    setLang("tr");
    expect(document.querySelector("p")?.textContent).toBe("Kütüphane");
  });

  it("bilinmeyen anahtara dokunmaz", () => {
    applyTranslations();
    expect(document.querySelector("span")?.textContent).toBe("dokunulmaz");
  });

  it("çeviriyi HTML olarak değil düz metin olarak yazar", () => {
    setLang("tr");
    expect(document.querySelector("p")?.children.length).toBe(0);
  });
});
