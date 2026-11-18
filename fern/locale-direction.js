(function () {
  if (window.__sixmmLocaleDirection) return;
  window.__sixmmLocaleDirection = true;
  var lastPathname;
  var lastLocaleSignature;
  var localeHtmlLanguages;

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
    if (localeSignature !== lastLocaleSignature) {
      localeHtmlLanguages = {};
      locales.forEach(function (locale) {
        localeHtmlLanguages[locale.code] =
          locale.htmlLang || locale.code || "en";
      });
      lastLocaleSignature = localeSignature;
    }
    var firstSegment = window.__sixmmDocsHost.firstPathSegment(lastPathname);
    var locale = localeHtmlLanguages[firstSegment] || localeHtmlLanguages[""] || "en";
    var direction = locale === "ar" ? "rtl" : "ltr";
    if (document.documentElement.lang !== locale) document.documentElement.lang = locale;
    if (document.documentElement.dir !== direction) document.documentElement.dir = direction;
  }

  syncLocale();
  window.addEventListener("popstate", syncLocale);
  window.addEventListener("pageshow", syncLocale);
  document.addEventListener("DOMContentLoaded", syncLocale);
  document.addEventListener("astro:page-load", syncLocale);
})();
