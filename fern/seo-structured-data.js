(function () {
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
  var publicLocales = configuredLocales.map(function (locale) {
    var route = locale.code || "";
    return {
      route: route,
      code: route || "en",
    };
  });
  var localeCodes = publicLocales
    .map(function (locale) {
      return locale.route;
    })
    .filter(Boolean);
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

  function localeDefinition(code) {
    var normalized = String(code || "").toLowerCase();
    return publicLocales.find(function (locale) {
      return locale.route.toLowerCase() === normalized;
    });
  }

  function localeForPathname(pathname) {
    var firstSegment = pathname.split("/").filter(Boolean)[0] || "";
    var definition = localeDefinition(firstSegment);
    var route = definition ? definition.route : "";
    return {
      code: route || "en",
      route: route,
      prefix: route ? "/" + route : "",
    };
  }

  function pagePathForPathname(pathname) {
    var segments = normalizedPathname(pathname).split("/").filter(Boolean);

    while (segments.length > 0 && localeCodes.some(function (code) {
      return code.toLowerCase() === segments[0].toLowerCase();
    })) {
      segments.shift();
    }

    return segments.length > 0 ? "/" + segments.join("/") : "/home";
  }

  function localizedUrl(route, pagePath) {
    return siteUrl + (route ? "/" + route : "") + pagePath;
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

    var serialized = JSON.stringify(value);
    if (script.textContent !== serialized) {
      script.textContent = serialized;
    }
  }

  function pageTitle() {
    return document.title.replace(/\s*\|\s*6MM Docs\s*$/i, "").trim();
  }

  function addBreadcrumbs(pagePath, locale, canonicalUrl) {
    var route = pagePath.replace(/^\//, "");
    var localePrefix = locale.prefix;
    var labels =
      breadcrumbLabelsByLocale[locale.code] || breadcrumbLabelsByLocale.en;
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
    var pathname = normalizedPathname(window.location.pathname);
    var pagePath = pagePathForPathname(pathname);
    lastStructuredPath = pathname;
    var locale = localeForPathname(pathname);
    var isHome = pagePath === "/home";
    var canonicalUrl = localizedUrl(locale.route, pagePath);

    upsertStructuredData(
      "website",
      isHome && locale.code === "en"
        ? {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "6MM Docs",
            alternateName: ["6MM", "6MM Documentation"],
            url: siteUrl + "/home",
            inLanguage: "en",
          }
        : null,
    );

    if (isHome) {
      upsertStructuredData("breadcrumb", null);
    } else {
      addBreadcrumbs(pagePath, locale, canonicalUrl);
    }
  }

  var lastStructuredPath;
  var observer;
  var scheduled = false;
  var syncing = false;

  function observeChanges() {
    if (!observer) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function runSync() {
    if (syncing) return;
    syncing = true;
    scheduled = false;
    if (observer) observer.disconnect();
    try {
      syncStructuredData();
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

  function containsManagedSeoNode(node) {
    if (!node || node.nodeType !== 1) return false;

    if (
      node.hasAttribute("data-sixmm-schema")
    ) {
      return true;
    }

    return Boolean(
      node.querySelector &&
        node.querySelector(
          'script[data-sixmm-schema]',
        ),
    );
  }

  function shouldResync(mutations) {
    var pathname = normalizedPathname(window.location.pathname);
    if (pathname !== lastStructuredPath) return true;

    return mutations.some(function (mutation) {
      var target = mutation.target;
      if (target && target.nodeName === "TITLE") return true;

      var titleAdded = Array.prototype.some.call(
        mutation.addedNodes || [],
        function (node) {
          return node && node.nodeName === "TITLE";
        },
      );
      if (titleAdded) return true;

      return Array.prototype.some.call(
        mutation.removedNodes || [],
        containsManagedSeoNode,
      );
    });
  }

  observer = new MutationObserver(function (mutations) {
    if (shouldResync(mutations)) scheduleSync();
  });
  runSync();
  window.addEventListener("popstate", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  document.addEventListener("DOMContentLoaded", scheduleSync);
})();
