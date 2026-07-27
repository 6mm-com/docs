(function () {
  var lastPathname;
  var lastLocaleSignature;

  function syncLocale() {
    var locales = window.__sixmmDocsLocales || [];
    var localeSignature = locales
      .map(function (locale) {
        return locale.code + ":" + (locale.htmlLang || locale.code || "en");
      })
      .join("|");
    if (
      window.location.pathname === lastPathname &&
      localeSignature === lastLocaleSignature
    ) {
      return;
    }
    lastPathname = window.location.pathname;
    lastLocaleSignature = localeSignature;

    var localeHtmlLanguages = {};
    locales.forEach(function (locale) {
      localeHtmlLanguages[locale.code] =
        locale.htmlLang || locale.code || "en";
    });
    var firstSegment = lastPathname.split("/").filter(Boolean)[0];
    var locale = localeHtmlLanguages[firstSegment] || localeHtmlLanguages[""] || "en";
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
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
