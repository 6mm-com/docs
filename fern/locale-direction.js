(function () {
  var locales = [
    "en-SG",
    "es-419",
    "zh-TW",
    "pt-BR",
    "es-AR",
    "ja",
    "ru",
    "it",
    "fr",
    "de",
    "zh",
    "id",
    "pl",
    "vi",
    "uk",
    "pt-PT",
    "es-ES",
    "ar",
  ];
  var standaloneLocales = {
    "en-SG": "en-SG",
    uz: "uz-UZ",
    fil: "fil-PH",
    az: "az-AZ",
  };
  var lastPathname;

  function normalizeNestedStandaloneRoute() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var nativeLocale = segments[0];
    var standaloneRoute = segments[1];
    if (
      locales.indexOf(nativeLocale) < 0 ||
      !standaloneLocales[standaloneRoute]
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
    if (standaloneLocales[firstSegment]) return standaloneLocales[firstSegment];
    return locales.indexOf(firstSegment) >= 0 ? firstSegment : "en";
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
