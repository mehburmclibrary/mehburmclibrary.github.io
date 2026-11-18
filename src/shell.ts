// Her sayfada ortak olan iskelet: üst menü, alt bilgi, tema ve dil düğmeleri.
// Sayfalar <header data-shell="header"> ve <footer data-shell="footer"> boş alanlarını
// içerir; içleri burada doldurulur (menüyü her HTML dosyasına ayrı ayrı yazmamak için).
import iconUrl from "./assets/icon-64.webp";
import { applyTranslations, currentLang, initI18n, setLang, t, type Lang } from "./lib/i18n";
import { LINKS } from "./lib/links";
import { currentTheme, initTheme, onThemeChange, toggleTheme, type Theme } from "./lib/theme";

const ICON_SUN = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICON_MOON = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const ICON_EXTERNAL = `<svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

/** Yeni sekmede açılan bağlantılar için ekran okuyucuya ek bilgi. */
const externalHint = `<span class="sr-only" data-i18n="external"></span>`;

function brandHtml(): string {
  return `
    <a class="brand" href="/" data-i18n-attr="aria-label:brand.home">
      <img src="${iconUrl}" width="38" height="38" alt="" />
      <span class="brand-name">Mehbur<span>MC</span></span>
      <span class="brand-suffix" data-i18n="brand.suffix"></span>
    </a>`;
}

function headerHtml(): string {
  return `
    <a class="skip-link" href="#main" data-i18n="skip"></a>
    <div class="container nav">
      ${brandHtml()}
      <div class="nav-actions">
        <button class="icon-btn theme-toggle" type="button" data-theme-toggle></button>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu"
          data-nav-toggle>
          <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
        </button>
      </div>
      <nav class="nav-menu" id="nav-menu" data-i18n-attr="aria-label:nav.label">
        <ul class="nav-links">
          <li><a href="/library/" data-nav-link data-i18n="nav.library"></a></li>
        </ul>
        <div class="lang-switch" role="group" data-i18n-attr="aria-label:lang.label">
          <button type="button" lang="tr" data-lang="tr">TR</button>
          <button type="button" lang="en" data-lang="en">EN</button>
        </div>
        <a class="btn btn-ghost btn-sm" href="${LINKS.launcherSite}" target="_blank" rel="noopener">
          <span data-i18n="nav.getLauncher"></span>${ICON_EXTERNAL}${externalHint}
        </a>
      </nav>
    </div>`;
}

function footerHtml(): string {
  const link = (href: string, key: string) =>
    `<li><a href="${href}" target="_blank" rel="noopener"><span data-i18n="${key}"></span>${externalHint}</a></li>`;
  return `
    <div class="container footer-top">
      <div class="footer-brand">
        ${brandHtml()}
        <p data-i18n="footer.about"></p>
      </div>
      <nav data-i18n-attr="aria-label:footer.links">
        <h2 class="footer-title" data-i18n="footer.links"></h2>
        <ul class="footer-links">
          ${link(LINKS.launcherSite, "footer.launcherSite")}
          ${link(LINKS.source, "footer.source")}
          ${link(LINKS.issues, "footer.bug")}
          ${link(LINKS.license, "footer.license")}
        </ul>
      </nav>
    </div>
    <div class="container footer-bottom">
      <p>© ${new Date().getFullYear()} MehburMC. <span data-i18n="footer.copy"></span></p>
      <p class="footer-legal" data-i18n="footer.legal"></p>
    </div>`;
}

function setupThemeToggle(header: HTMLElement): void {
  const btn = header.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!btn) return;
  // Düğme, geçilecek temanın ikonunu gösterir (koyudayken güneş, açıktayken ay)
  const render = (theme: Theme) => {
    const key = theme === "dark" ? "theme.toLight" : "theme.toDark";
    btn.innerHTML = theme === "dark" ? ICON_SUN : ICON_MOON;
    btn.dataset.i18nAttr = `aria-label:${key};title:${key}`;
    applyTranslations(header);
  };
  render(currentTheme());
  onThemeChange(render);
  btn.addEventListener("click", () => toggleTheme());
}

function setupLangSwitch(header: HTMLElement): void {
  const buttons = header.querySelectorAll<HTMLButtonElement>("[data-lang]");
  const render = () =>
    buttons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.lang === currentLang())),
    );
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      setLang(b.dataset.lang as Lang);
      render();
    }),
  );
  render();
}

function setupMobileMenu(header: HTMLElement): void {
  const toggle = header.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  if (!toggle) return;
  const setOpen = (open: boolean) => {
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    const key = open ? "nav.closeMenu" : "nav.openMenu";
    toggle.dataset.i18nAttr = `aria-label:${key}`;
    toggle.setAttribute("aria-label", t(key));
  };
  setOpen(false);
  toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
  // Menüdeki bir bağlantıya tıklanınca ya da Esc'ye basılınca menü kapanır
  header
    .querySelectorAll(".nav-menu a")
    .forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/** Sayfa kaydırılınca menünün arkası koyulaşır. */
function setupScrollState(header: HTMLElement): void {
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/** Bulunduğumuz sayfanın menü bağlantısını işaretler. */
function markCurrentPage(header: HTMLElement): void {
  header.querySelectorAll<HTMLAnchorElement>("[data-nav-link]").forEach((a) => {
    if (new URL(a.href).pathname === window.location.pathname)
      a.setAttribute("aria-current", "page");
  });
}

export function mountShell(): void {
  document.documentElement.classList.add("js");
  initTheme();

  const header = document.querySelector<HTMLElement>('[data-shell="header"]');
  const footer = document.querySelector<HTMLElement>('[data-shell="footer"]');
  if (header) {
    header.classList.add("site-header");
    header.innerHTML = headerHtml();
  }
  if (footer) {
    footer.classList.add("site-footer");
    footer.innerHTML = footerHtml();
  }

  // Dil, menü çizildikten sonra uygulanır ki menüdeki yazılar da çevrilsin
  initI18n();

  if (header) {
    setupThemeToggle(header);
    setupLangSwitch(header);
    setupMobileMenu(header);
    setupScrollState(header);
    markCurrentPage(header);
  }
}
