(function () {
  var localeHtmlLanguages = {
    "en-Asia": "en-SG",
    "es-419": "es-419",
    "pt-BR": "pt-BR",
    "es-AR": "es-AR",
    "zh-TW": "zh-TW",
    ja: "ja",
    ru: "ru",
    it: "it",
    fr: "fr",
    de: "de",
    "zh-CN": "zh-CN",
    id: "id",
    pl: "pl",
    vi: "vi",
    uk: "uk",
    pt: "pt",
    es: "es",
    uz: "uz",
    fil: "fil",
    az: "az",
    ar: "ar",
  };
  var standaloneRoutes = {
    "en-Asia": true,
    uz: true,
    fil: true,
    az: true,
  };
  var lastPathname;

  function normalizeNestedStandaloneRoute() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var nativeLocale = segments[0];
    var standaloneRoute = segments[1];
    if (
      !localeHtmlLanguages[nativeLocale] ||
      !standaloneRoutes[standaloneRoute]
    ) {
      return false;
    }

    var normalizedPath = "/" + segments.slice(1).join("/");
    window.location.assign(
      normalizedPath + window.location.search + window.location.hash,
    );
    return true;
  }

  function localeFromPathname(pathname) {
    var firstSegment = pathname.split("/").filter(Boolean)[0];
    return localeHtmlLanguages[firstSegment] || "en";
  }

  function syncLocale() {
    if (window.location.pathname === lastPathname) return;
    lastPathname = window.location.pathname;

    var locale = localeFromPathname(lastPathname);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";

    try {
      window.localStorage.setItem("sixmm-docs-locale", locale);
    } catch (_error) {
      // Storage may be disabled; the page locale still works without persistence.
    }
  }

  if (normalizeNestedStandaloneRoute()) return;

  syncLocale();
  window.addEventListener("popstate", syncLocale);
  window.addEventListener("pageshow", syncLocale);
  document.addEventListener("DOMContentLoaded", syncLocale);

  new MutationObserver(syncLocale).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
