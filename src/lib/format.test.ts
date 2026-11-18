import { afterEach, describe, expect, it } from "vitest";
import { formatBytes, formatDate } from "./format";
import { setLang } from "./i18n";

describe("biçimler", () => {
  afterEach(() => setLang("tr", false));

  it("boyutu seçili dile göre yazar", () => {
    setLang("tr", false);
    expect(formatBytes(24035)).toBe("23,5 KB");
    expect(formatBytes(10441395)).toBe("10 MB");
    expect(formatBytes(512)).toBe("512 B");
    setLang("en", false);
    expect(formatBytes(24035)).toBe("23.5 KB");
    expect(formatBytes(1332817)).toBe("1.3 MB");
  });

  it("tarihi yazar, geçersizse boş bırakır", () => {
    setLang("en", false);
    expect(formatDate("2026-11-03T12:00:00Z")).toBe("3 Nov 2026");
    expect(formatDate("yok")).toBe("");
  });
});
