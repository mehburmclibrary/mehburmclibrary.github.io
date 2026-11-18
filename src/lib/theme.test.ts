import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme, currentTheme, resolveTheme, THEME_KEY, toggleTheme } from "./theme";

describe("resolveTheme", () => {
  it("kayıtlı seçim varsa sistemin temasına bakmaz", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("kayıt yoksa ya da bozuksa sistemin temasını kullanır", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme(null, false)).toBe("dark");
    expect(resolveTheme("mor", true)).toBe("light");
  });
});

describe("toggleTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#05070a" />';
    applyTheme("dark");
  });

  it("temayı değiştirir, seçimi kaydeder ve adres çubuğu rengini günceller", () => {
    expect(toggleTheme()).toBe("light");
    expect(currentTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      "#f4f8fa",
    );

    expect(toggleTheme()).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });
});
