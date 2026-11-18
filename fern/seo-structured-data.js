(function () {
  if (window.__sixmmSeoStructuredData) return;
  window.__sixmmSeoStructuredData = true;

  var siteUrl = "https://docs.6mm.com";
  var fallbackLocales = [
    { code: "", htmlLang: "en" },
    { code: "ja" },
    { code: "ru" },
    { code: "es-419" },
    { code: "it" },
    { code: "fr" },
    { code: "de" },
    { code: "zh-CN" },
    { code: "zh-TW" },
    { code: "pt-BR" },
    { code: "id" },
    { code: "pl" },
    { code: "vi" },
    { code: "uk" },
    { code: "pt-PT" },
    { code: "es-ES" },
    { code: "tr" },
    { code: "ko" },
    { code: "el" },
    { code: "ar" },
  ];
  var configuredLocales =
    window.__sixmmDocsLocales && window.__sixmmDocsLocales.length
      ? window.__sixmmDocsLocales
      : fallbackLocales;
  var localeRoutes = new Map();
  configuredLocales.forEach(function (locale) {
    var route = locale.code || "";
    var key = route.toLowerCase();
    if (!localeRoutes.has(key)) localeRoutes.set(key, route);
  });
  var homeNames = {
    en: "Home",
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
    "pt-PT": "Início",
    "es-ES": "Inicio",
    ko: "홈",
    tr: "Ana Sayfa",
    el: "Αρχική",
    ar: "الرئيسية",
  };
  var productBreadcrumbLabels = {
    developerApi: "Developer API",
    restApi: "REST API",
    websocket: "WebSocket",
    sdk: "SDKs",
    tradingWidget: "Trading Widget SDK",
    agentSdk: "Agent SDK",
    javaSdk: "Java SDK",
    phpSdk: "PHP SDK",
  };

  function breadcrumbLabels(solutions, trading, security, resources) {
    return {
      solutions: solutions,
      trading: trading,
      developerApi: productBreadcrumbLabels.developerApi,
      restApi: productBreadcrumbLabels.restApi,
      websocket: productBreadcrumbLabels.websocket,
      sdk: productBreadcrumbLabels.sdk,
      tradingWidget: productBreadcrumbLabels.tradingWidget,
      agentSdk: productBreadcrumbLabels.agentSdk,
      javaSdk: productBreadcrumbLabels.javaSdk,
      phpSdk: productBreadcrumbLabels.phpSdk,
      security: security,
      resources: resources,
    };
  }

  var breadcrumbLabelsByLocale = {
    en: breadcrumbLabels(
      "Solutions",
      "Trading",
      "Security & Compliance",
      "Integration & Support",
    ),
    ja: breadcrumbLabels(
      "ソリューション",
      "取引ガイド",
      "セキュリティとコンプライアンス",
      "連携とサポート",
    ),
    ru: breadcrumbLabels(
      "Решения",
      "Торговля",
      "Безопасность и соответствие требованиям",
      "Интеграция и поддержка",
    ),
    "es-419": breadcrumbLabels(
      "Soluciones",
      "Operaciones",
      "Seguridad y cumplimiento normativo",
      "Integración y soporte",
    ),
    it: breadcrumbLabels(
      "Soluzioni",
      "Operatività",
      "Sicurezza e conformità",
      "Integrazione e supporto",
    ),
    fr: breadcrumbLabels(
      "Solutions",
      "Opérations de marché",
      "Sécurité et conformité",
      "Intégration et assistance",
    ),
    de: breadcrumbLabels(
      "Lösungen",
      "Handel",
      "Sicherheit und Compliance",
      "Integration und Support",
    ),
    "zh-CN": breadcrumbLabels(
      "解决方案",
      "交易指南",
      "安全与合规",
      "集成与支持",
    ),
    "zh-TW": breadcrumbLabels(
      "解決方案",
      "交易指南",
      "安全與合規",
      "整合與支援",
    ),
    "pt-BR": breadcrumbLabels(
      "Soluções",
      "Negociação",
      "Segurança e conformidade",
      "Integração e suporte",
    ),
    id: breadcrumbLabels(
      "Solusi",
      "Perdagangan",
      "Keamanan dan Kepatuhan",
      "Integrasi dan Dukungan",
    ),
    pl: breadcrumbLabels(
      "Rozwiązania",
      "Handel",
      "Bezpieczeństwo i zgodność",
      "Integracja i wsparcie",
    ),
    vi: breadcrumbLabels(
      "Giải pháp",
      "Giao dịch",
      "Bảo mật và tuân thủ",
      "Tích hợp và hỗ trợ",
    ),
    uk: breadcrumbLabels(
      "Рішення",
      "Торгівля",
      "Безпека та відповідність вимогам",
      "Інтеграція та підтримка",
    ),
    "pt-PT": breadcrumbLabels(
      "Soluções",
      "Negociação",
      "Segurança e conformidade",
      "Integração e suporte",
    ),
    "es-ES": breadcrumbLabels(
      "Soluciones",
      "Operativa",
      "Seguridad y cumplimiento normativo",
      "Integración y asistencia",
    ),
    ko: breadcrumbLabels(
      "솔루션",
      "거래",
      "보안 및 준수",
      "통합 및 지원",
    ),
    tr: breadcrumbLabels(
      "Çözümler",
      "Ticaret",
      "Güvenlik ve Uyum",
      "Entegrasyon ve Destek",
    ),
    el: breadcrumbLabels(
      "Λύσεις",
      "Συναλλαγές",
      "Ασφάλεια & Συμμόρφωση",
      "Ενσωμάτωση & Υποστήριξη",
    ),
    ar: breadcrumbLabels(
      "الحلول",
      "التداول",
      "الأمان والامتثال",
      "التكامل والدعم",
    ),
  };

  function normalizedPathname(pathname) {
    var normalized = (pathname || "/").replace(/\/{2,}/g, "/");
    normalized = normalized.replace(/\/+$/, "");
    return normalized || "/";
  }

  function localeForPathname(pathname) {
    var firstSegment = pathname.split("/").find(Boolean) || "";
    var route = localeRoutes.get(firstSegment.toLowerCase()) || "";
    return {
      code: route || "en",
      route: route,
      prefix: route ? "/" + route : "",
    };
  }

  function pagePathForPathname(pathname) {
    var segments = normalizedPathname(pathname).split("/").filter(Boolean);

    while (segments.length > 0 && localeRoutes.has(segments[0].toLowerCase())) {
      segments.shift();
    }

    return segments.length > 0 ? "/" + segments.join("/") : "/";
  }

  function localizedUrl(route, pagePath) {
    if (pagePath === "/") {
      return siteUrl + (route ? "/" + route : "");
    }
    return siteUrl + (route ? "/" + route : "") + pagePath;
  }

  function upsertStructuredData(key, value) {
    var selector = 'script[data-sixmm-schema="' + key + '"]';
    var script = document.head.querySelector(selector);

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

    var serialized = JSON.stringify(value);
    if (script.textContent !== serialized) {
      script.textContent = serialized;
    }
  }

  function pageTitle() {
    return document.title.replace(/\s*\|\s*6MM Docs\s*$/i, "").trim();
  }

  var breadcrumbLevels = [
    ["solutions", "solutions", "/solutions/overview"],
    ["trading", "trading", "/trading/overview"],
    ["developer-api", "developerApi", "/developer-api/overview"],
    ["developer-api/rest-api", "restApi", "/developer-api/rest-api"],
    ["developer-api/websocket", "websocket", "/developer-api/websocket"],
    ["sdk", "sdk", "/sdk/overview"],
    ["sdk/trading-widget", "tradingWidget", "/sdk/trading-widget/overview"],
    ["sdk/agent-sdk", "agentSdk", "/sdk/agent-sdk/overview"],
    ["sdk/agent-sdk/java", "javaSdk", "/sdk/agent-sdk/java/overview"],
    ["sdk/agent-sdk/php", "phpSdk", "/sdk/agent-sdk/php/overview"],
    ["security-compliance", "security", "/security-compliance/overview"],
    ["resources", "resources", "/resources/overview"],
  ];

  function addBreadcrumbs(pagePath, locale, canonicalUrl) {
    var route = pagePath.replace(/^\//, "");
    var localePrefix = locale.prefix;
    var labels =
      breadcrumbLabelsByLocale[locale.code] || breadcrumbLabelsByLocale.en;
    var items = [
      {
        name: homeNames[locale.code] || "Home",
        item: siteUrl + localePrefix,
      },
    ];

    breadcrumbLevels.forEach(function (level) {
      var prefix = level[0];

      if (route === prefix || route.indexOf(prefix + "/") === 0) {
        items.push({
          name: labels[level[1]],
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
    lastStructuredPath = window.location.pathname;
    var pathname = normalizedPathname(lastStructuredPath);
    var pagePath = pagePathForPathname(pathname);
    var locale = localeForPathname(pathname);
    var isHome = pagePath === "/";
    var canonicalUrl = localizedUrl(locale.route, pagePath);
    var websiteId = siteUrl + "/#website";

    upsertStructuredData(
      "website",
      isHome && locale.code === "en"
        ? {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": websiteId,
            name: "6MM Docs",
            alternateName: [
              "6MM",
              "6MM Documentation",
              "docs.6mm.com",
            ],
            url: siteUrl + "/",
            inLanguage: "en",
          }
        : null,
    );

    upsertStructuredData("webpage", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": canonicalUrl + "#webpage",
      name: pageTitle(),
      url: canonicalUrl,
      inLanguage: locale.code,
      isPartOf: {
        "@id": websiteId,
      },
    });

    if (isHome) {
      upsertStructuredData("breadcrumb", null);
    } else {
      addBreadcrumbs(pagePath, locale, canonicalUrl);
    }
  }

  var lastStructuredPath;
  var observedHead;
  var observer;
  var scheduled = false;
  var syncing = false;

  function observeChanges() {
    observedHead = document.head;
    // Watch the root for replacement of the head. Astro notifies us directly
    // when navigation finishes, so body content need not be observed.
    observer.observe(document.documentElement, { childList: true });
    if (observedHead) {
      observer.observe(observedHead, { childList: true, subtree: true, characterData: true });
    }
  }

  function runSync() {
    if (syncing) return;
    syncing = true;
    scheduled = false;
    observer.disconnect();
    try {
      if (document.head) syncStructuredData();
    } finally {
      observeChanges();
      syncing = false;
    }
  }

  function scheduleSync() {
    if (scheduled || syncing) return;
    scheduled = true;
    window.requestAnimationFrame(runSync);
  }

  function isTitle(node) {
    return node && node.nodeName === "TITLE";
  }

  function shouldResync(mutations) {
    if (document.head !== observedHead || window.location.pathname !== lastStructuredPath) return true;

    return mutations.some(function (mutation) {
      var target = mutation.type === "characterData" ? mutation.target.parentNode : mutation.target;
      return isTitle(target) ||
        Array.prototype.some.call(mutation.addedNodes, isTitle) ||
        Array.prototype.some.call(mutation.removedNodes, function (node) {
          return node.nodeType === 1 && node.matches("title, script[data-sixmm-schema]");
        });
    });
  }

  observer = new MutationObserver(function (mutations) {
    if (shouldResync(mutations)) scheduleSync();
  });
  runSync();
  window.addEventListener("popstate", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  document.addEventListener("DOMContentLoaded", scheduleSync);
  document.addEventListener("astro:page-load", scheduleSync);
})();
