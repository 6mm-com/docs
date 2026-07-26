(function () {
  var siteUrl = "https://docs.6mm.com";
  var localeCodes = [
    "en-Asia",
    "es-419",
    "pt-BR",
    "es-AR",
    "en-Asia",
    "zh-TW",
    "ja",
    "ru",
    "it",
    "fr",
    "de",
    "zh-CN",
    "id",
    "pl",
    "vi",
    "uk",
    "pt",
    "es",
    "uz",
    "fil",
    "az",
    "ar",
  ];
  var standaloneLocales = {};
  var homeNames = {
    en: "Home",
    "en-Asia": "Home",
    ja: "ホーム",
    ru: "Главная",
    "es-419": "Inicio",
    it: "Pagina iniziale",
    fr: "Accueil",
    de: "Startseite",
    "zh-CN": "首页",
    "zh-TW": "首頁",
    "pt-BR": "Início",
    id: "Beranda",
    pl: "Strona główna",
    vi: "Trang chủ",
    uk: "Головна",
    pt: "Início",
    es: "Inicio",
    "es-AR": "Inicio",
    uz: "Bosh sahifa",
    ar: "الرئيسية",
    fil: "Home",
    az: "Ana səhifə",
  };

  function localeForPathname(pathname) {
    var firstSegment = pathname.split("/").filter(Boolean)[0];
    var standaloneCode = standaloneLocales[firstSegment];
    var code =
      standaloneCode ||
      (localeCodes.indexOf(firstSegment) >= 0 ? firstSegment : "en");
    return {
      code: code,
      prefix: code === "en" ? "" : "/" + firstSegment,
    };
  }

  function upsertStructuredData(key, value) {
    var selector = 'script[data-sixmm-schema="' + key + '"]';
    var script = document.querySelector(selector);

    if (!value) {
      if (script) {
        script.remove();
      }
      return;
    }

    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.sixmmSchema = key;
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(value);
  }

  function pageTitle() {
    return document.title.replace(/\s*\|\s*6MM Docs\s*$/i, "").trim();
  }

  function addBreadcrumbs(pathname, locale) {
    var route = pathname
      .replace(new RegExp("^" + locale.prefix.replace("-", "\\-") + "/"), "/")
      .replace(/^\//, "");
    var localePrefix = locale.prefix;
    var isChinese = locale.code === "zh-CN" || locale.code === "zh-TW";
    var labels =
      locale.code === "zh-TW"
        ? {
            solutions: "解決方案",
            trading: "交易指南",
            developerApi: "開發者 API",
            restApi: "REST API",
            websocket: "WebSocket",
            sdk: "SDK",
            tradingWidget: "Trading Widget SDK",
            agentSdk: "Agent SDK",
            javaSdk: "Java SDK",
            phpSdk: "PHP SDK",
            security: "安全與合規",
            resources: "資源與支援",
          }
        : isChinese
          ? {
              solutions: "解决方案",
              trading: "交易指南",
              developerApi: "开发者 API",
              restApi: "REST API",
              websocket: "WebSocket",
              sdk: "SDK",
              tradingWidget: "Trading Widget SDK",
              agentSdk: "Agent SDK",
              javaSdk: "Java SDK",
              phpSdk: "PHP SDK",
              security: "安全与合规",
              resources: "资源与支持",
            }
          : {
              solutions: "Solutions",
              trading: "Trading",
              developerApi: "Developer API",
              restApi: "REST API",
              websocket: "WebSocket",
              sdk: "SDKs",
              tradingWidget: "Trading Widget SDK",
              agentSdk: "Agent SDK",
              javaSdk: "Java SDK",
              phpSdk: "PHP SDK",
              security: "Security & Compliance",
              resources: "Resources & Support",
            };
    var levels = [
      ["solutions", labels.solutions, "/solutions/overview"],
      ["trading", labels.trading, "/trading/overview"],
      ["developer-api", labels.developerApi, "/developer-api/overview"],
      ["developer-api/rest-api", labels.restApi, "/developer-api/rest-api"],
      ["developer-api/websocket", labels.websocket, "/developer-api/websocket"],
      ["sdk", labels.sdk, "/sdk/overview"],
      ["sdk/trading-widget", labels.tradingWidget, "/sdk/trading-widget/overview"],
      ["sdk/agent-sdk", labels.agentSdk, "/sdk/agent-sdk/overview"],
      ["sdk/agent-sdk/java", labels.javaSdk, "/sdk/agent-sdk/java/overview"],
      ["sdk/agent-sdk/php", labels.phpSdk, "/sdk/agent-sdk/php/overview"],
      ["security-compliance", labels.security, "/security-compliance/overview"],
      ["resources", labels.resources, "/resources/overview"],
    ];
    var canonicalElement = document.querySelector('link[rel="canonical"]');
    var canonicalUrl = canonicalElement
      ? canonicalElement.href
      : siteUrl + pathname;
    var items = [
      {
        name: homeNames[locale.code] || "Home",
        item: siteUrl + localePrefix + "/home",
      },
    ];

    levels.forEach(function (level) {
      var prefix = level[0];

      if (route === prefix || route.indexOf(prefix + "/") === 0) {
        items.push({
          name: level[1],
          item: siteUrl + localePrefix + level[2],
        });
      }
    });

    if (items[items.length - 1].item === canonicalUrl) {
      items[items.length - 1].name = pageTitle();
    } else {
      items.push({
        name: pageTitle(),
        item: canonicalUrl,
      });
    }

    upsertStructuredData("breadcrumb", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map(function (item, index) {
        return {
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.item,
        };
      }),
    });
  }

  function syncStructuredData() {
    var pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    lastStructuredPath = pathname;
    var locale = localeForPathname(pathname);
    var isHome =
      pathname === "/" ||
      pathname === "/home" ||
      pathname === locale.prefix ||
      pathname === locale.prefix + "/home";

    upsertStructuredData(
      "website",
      isHome
        ? {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "6MM Docs",
            alternateName: ["6MM Documentation", "docs.6mm.com"],
            url: siteUrl + locale.prefix + "/home",
            inLanguage: locale.code,
          }
        : null,
    );

    if (isHome) {
      upsertStructuredData("breadcrumb", null);
    } else {
      addBreadcrumbs(pathname, locale);
    }
  }

  var lastStructuredPath;
  function syncWhenPathChanges() {
    var pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    if (pathname !== lastStructuredPath) syncStructuredData();
  }

  syncStructuredData();
  window.addEventListener("popstate", syncStructuredData);
  window.addEventListener("pageshow", syncStructuredData);
  document.addEventListener("DOMContentLoaded", syncStructuredData);
  new MutationObserver(syncWhenPathChanges).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
