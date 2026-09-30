import { useEffect, useState } from "react";

// Fern's stock mobile theme menu can mount a tooltip without a Provider.
// Use its supported composition API and a native theme button instead.
export default function DocsHeader({ Fern }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="sixmm-docs-header">
      <div className="fern-header-logo-container"><Fern.Logo /></div>
      <div className="sixmm-header-search"><Fern.Search /></div>
      <nav className="sixmm-header-links" aria-label="Navbar links"><Fern.NavbarLinks /><Fern.LoginButton /></nav>
      <div className="sixmm-header-settings">
        <Fern.LanguageSwitcher />
        <button type="button" className="sixmm-theme-trigger" aria-label={dark ? "Light" : "Dark"}
          onClick={() => window.__sixmmNavigateDocsTheme?.(dark ? "light" : "dark")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            {dark ? <path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
          </svg>
        </button>
      </div>
      <div className="fern-header-mobile-menu-button"><Fern.HamburgerMenu /></div>
    </div>
  );
}
