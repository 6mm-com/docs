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
    uz: "uz-UZ",
    fil: "fil-PH",
    az: "az-AZ",
  };
  var lastPathname;

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

  syncLocale();
  window.addEventListener("popstate", syncLocale);
  window.addEventListener("pageshow", syncLocale);
  document.addEventListener("DOMContentLoaded", syncLocale);

  new MutationObserver(syncLocale).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
