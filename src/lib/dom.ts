// JavaScript ile HTML öğesi oluşturmak için küçük yardımcı.
// Metinler her zaman metin düğümü olarak eklenir (innerHTML değil): kullanıcıların yazdığı
// mod adı ya da açıklama içinde HTML/kod olsa bile sayfada çalışmaz, düz yazı görünür.

export type Child = Node | string | number | null | undefined | false;
export type Props = Record<string, string | number | boolean | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === "class") el.className = String(value);
    else el.setAttribute(name, value === true ? "" : String(value));
  }
  append(el, ...children);
  return el;
}

export function append(parent: Node, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    parent.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
}

/**
 * Sabit SVG ikonları. İçerikleri koddaki sabit metinlerdir (kullanıcı verisi değil), bu yüzden
 * burada HTML olarak eklenmeleri güvenlidir.
 */
const ICONS = {
  mod: '<path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  modpack: '<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  resourcepack:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  shader:
    '<path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  external:
    '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, extraClass = ""): SVGSVGElement {
  const wrap = document.createElement("span");
  wrap.innerHTML = `<svg class="icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}
