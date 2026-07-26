(function () {
  var siteUrl = "https://docs.6mm.com";
  var standaloneLocales = {
    uz: "uz-UZ",
    fil: "fil-PH",
    az: "az-AZ",
  };
  var lastPathname;

  function upsertAlternate(hreflang, href) {
    var link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = hreflang;
    link.href = href;
    link.dataset.sixmmStandaloneLocale = "true";
    document.head.appendChild(link);
  }

  function syncStandaloneLocaleSeo() {
    var pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    if (pathname === lastPathname) return;
    lastPathname = pathname;

    var segments = pathname.split("/").filter(Boolean);
    var routeLocale = segments[0];
    var hreflang = standaloneLocales[routeLocale];
    if (!hreflang) return;

    var pagePath = "/" + (segments.slice(1).join("/") || "home");
    var canonicalUrl = siteUrl + "/" + routeLocale + pagePath;
    var englishUrl = siteUrl + pagePath;

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (link) {
      link.remove();
    });

    upsertAlternate(hreflang, canonicalUrl);
    upsertAlternate("en", englishUrl);
    upsertAlternate("x-default", englishUrl);

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (!ogLocale) {
      ogLocale = document.createElement("meta");
      ogLocale.setAttribute("property", "og:locale");
      document.head.appendChild(ogLocale);
    }
    ogLocale.content = hreflang.replace("-", "_");
  }

  syncStandaloneLocaleSeo();
  window.addEventListener("popstate", syncStandaloneLocaleSeo);
  window.addEventListener("pageshow", syncStandaloneLocaleSeo);
  document.addEventListener("DOMContentLoaded", syncStandaloneLocaleSeo);
  new MutationObserver(syncStandaloneLocaleSeo).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
