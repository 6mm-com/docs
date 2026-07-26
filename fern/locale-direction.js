(function () {
  var localeHtmlLanguages = {};
  (window.__sixmmDocsLocales || []).forEach(function (locale) {
    localeHtmlLanguages[locale.code] =
      locale.htmlLang || locale.code || "en";
  });
  var lastPathname;

  function syncLocale() {
    if (window.location.pathname === lastPathname) return;
    lastPathname = window.location.pathname;

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
