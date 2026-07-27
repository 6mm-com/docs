(function () {
  if (window.__sixmmSupportWidgetLoader) return;
  window.__sixmmSupportWidgetLoader = true;
  document.documentElement.classList.add('sixmm-support-widget-loading');

  var WIDGET_SRC = 'https://csadmin.6mm.com/widget/widget.js';
  var APP_ID = '6mm-docs';
  var locales = window.__sixmmDocsLocales || [];
  var localeRoutes = locales
    .filter(function (locale) {
      return locale.code;
    })
    .map(function (locale) {
      return { route: locale.code, widget: locale.widget || locale.code };
    });
  var widgetLanguageRoutes = {};
  locales.forEach(function (locale) {
    (locale.aliases || [locale.widget || locale.code]).forEach(function (alias) {
      widgetLanguageRoutes[String(alias).toLowerCase()] = locale.code;
    });
  });
  var lastPathname = window.location.pathname;
  var lastWidgetLanguage = null;
  var lastTheme = null;
  var pendingWidgetDocsLocale = null;
  var pendingWidgetDocsResolved = false;
  var pendingWidgetTheme = null;
  var widgetDocsRequestId = 0;
  var suppressedWidgetLanguages = {};

  function normalizeLanguage(lang) {
    return typeof lang === 'string'
      ? lang.trim().replace(/_/g, '-').toLowerCase()
      : '';
  }

  function suppressWidgetLanguageEcho(lang) {
    var normalized = normalizeLanguage(lang);
    if (normalized) suppressedWidgetLanguages[normalized] = Date.now() + 1500;
  }

  function consumeSuppressedWidgetLanguage(lang) {
    var normalized = normalizeLanguage(lang);
    var now = Date.now();
    Object.keys(suppressedWidgetLanguages).forEach(function (language) {
      if (suppressedWidgetLanguages[language] < now) {
        delete suppressedWidgetLanguages[language];
      }
    });
    if (
      !normalized ||
      !Object.prototype.hasOwnProperty.call(
        suppressedWidgetLanguages,
        normalized
      )
    ) {
      return false;
    }
    delete suppressedWidgetLanguages[normalized];
    return true;
  }

  function currentDocsLocale() {
    var firstSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
    var locale = localeRoutes.find(function (item) {
      return item.route === firstSegment;
    });
    return locale ? locale.route : '';
  }

  function currentLang() {
    var docsLocale = currentDocsLocale();
    var locale = localeRoutes.find(function (item) {
      return item.route === docsLocale;
    });
    return locale ? locale.widget : 'en';
  }

  function currentDocsLocaleConfig() {
    var docsLocale = currentDocsLocale();
    return locales.find(function (locale) {
      return locale.code === docsLocale;
    });
  }

  function currentTheme() {
    var root = document.documentElement;
    if (root.classList.contains('dark')) return 'dark';
    if (root.classList.contains('light')) return 'light';
    if (root.dataset.theme === 'dark') return 'dark';
    return 'light';
  }

  function currentAccentColor() {
    var value = window.getComputedStyle(document.documentElement).getPropertyValue('--sixmm-accent');
    return value && value.trim() ? value.trim() : '#00ffda';
  }

  function callWidget(method, value) {
    if (!window.CSWidget || typeof window.CSWidget[method] !== 'function') return false;
    window.CSWidget[method](value);
    return true;
  }

  function syncWidgetLanguageFromHost(retries, force) {
    var language = currentLang();
    if (!force && language === lastWidgetLanguage) return;
    var locale = currentDocsLocaleConfig();
    if (locale && locale.widgetFallback) {
      suppressWidgetLanguageEcho(language);
    }
    if (callWidget('setLang', language)) {
      lastWidgetLanguage = language;
      return;
    }
    if (retries > 0) {
      window.setTimeout(function () {
        syncWidgetLanguageFromHost(retries - 1, force);
      }, 100);
    }
  }

  function syncWidgetThemeFromHost(retries, force) {
    var theme = currentTheme();
    if (pendingWidgetTheme === theme) {
      pendingWidgetTheme = null;
      lastTheme = theme;
      return;
    }
    pendingWidgetTheme = null;
    if (force || theme !== lastTheme) {
      if (callWidget('setTheme', theme)) {
        lastTheme = theme;
      } else if (retries > 0) {
        window.setTimeout(function () {
          syncWidgetThemeFromHost(retries - 1, force);
        }, 100);
      }
    }
  }

  function routeForWidgetLanguage(lang) {
    var normalized = normalizeLanguage(lang);
    return Object.prototype.hasOwnProperty.call(widgetLanguageRoutes, normalized)
      ? widgetLanguageRoutes[normalized]
      : null;
  }

  function clearPendingWidgetDocsNavigation() {
    pendingWidgetDocsLocale = null;
    pendingWidgetDocsResolved = false;
    lastPathname = window.location.pathname;
  }

  function confirmPendingWidgetDocsNavigation() {
    if (
      pendingWidgetDocsLocale !== null &&
      pendingWidgetDocsResolved &&
      pendingWidgetDocsLocale === currentDocsLocale()
    ) {
      clearPendingWidgetDocsNavigation();
      return true;
    }
    return false;
  }

  function switchHostLanguage(lang) {
    var route = routeForWidgetLanguage(lang);
    if (route === null) return;
    var requestId = ++widgetDocsRequestId;
    var locale = localeRoutes.find(function (item) {
      return item.route === route;
    });

    if (locale) lastWidgetLanguage = locale.widget;
    pendingWidgetDocsLocale = route;
    pendingWidgetDocsResolved = false;

    if (typeof window.__sixmmNavigateDocsLocale === 'function') {
      var navigation;
      try {
        navigation = window.__sixmmNavigateDocsLocale(route);
      } catch (error) {
        if (requestId === widgetDocsRequestId && pendingWidgetDocsLocale === route) {
          clearPendingWidgetDocsNavigation();
        }
        return;
      }
      Promise.resolve(navigation).then(
        function (success) {
          if (
            requestId !== widgetDocsRequestId ||
            pendingWidgetDocsLocale !== route
          ) {
            return;
          }
          if (!success) {
            clearPendingWidgetDocsNavigation();
            return;
          }
          pendingWidgetDocsResolved = true;
          confirmPendingWidgetDocsNavigation();
        },
        function () {
          if (
            requestId === widgetDocsRequestId &&
            pendingWidgetDocsLocale === route
          ) {
            clearPendingWidgetDocsNavigation();
          }
        }
      );
    } else {
      clearPendingWidgetDocsNavigation();
    }
  }

  function switchHostTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;

    if (typeof window.__sixmmNavigateDocsTheme === 'function') {
      Promise.resolve(window.__sixmmNavigateDocsTheme(theme)).then(function (success) {
        if (pendingWidgetTheme === theme) {
          pendingWidgetTheme = null;
          if (success) lastTheme = theme;
        }
      });
    } else {
      pendingWidgetTheme = null;
    }
  }

  function onWidgetLanguageChange(event) {
    var language = event && event.detail ? event.detail.lang : '';
    if (consumeSuppressedWidgetLanguage(language)) return;
    switchHostLanguage(language);
  }

  function onWidgetThemeChange(event) {
    var theme = event && event.detail ? event.detail.theme : '';
    if (theme !== 'light' && theme !== 'dark') return;
    pendingWidgetTheme = theme;
    switchHostTheme(theme);
  }

  function loadWidget() {
    if (document.querySelector('script[data-sixmm-support-widget="true"]')) {
      document.documentElement.classList.remove('sixmm-support-widget-loading');
      return;
    }

    var initialLang = currentLang();
    var initialTheme = currentTheme();
    var script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.dataset.sixmmSupportWidget = 'true';
    script.dataset.lang = initialLang;
    script.dataset.theme = initialTheme;
    script.dataset.color = currentAccentColor();
    script.dataset.appId = APP_ID;
    script.onload = function () {
      document.documentElement.classList.remove('sixmm-support-widget-loading');
      // The host may have changed while widget.js was loading.
      syncWidgetLanguageFromHost(20, true);
      syncWidgetThemeFromHost(20, true);
    };
    script.onerror = function () {
      document.documentElement.classList.remove('sixmm-support-widget-loading');
    };
    lastTheme = initialTheme;
    var docsLocaleConfig = currentDocsLocaleConfig();
    // When Docs uses a locale unsupported by Support, the widget starts in
    // English. Ignore only the resulting initialization echo so it cannot
    // navigate the host back to English.
    if (docsLocaleConfig && docsLocaleConfig.widgetFallback) {
      suppressWidgetLanguageEcho(initialLang);
    }
    document.body.appendChild(script);
  }

  function boot() {
    window.addEventListener('cs-widget-lang-change', onWidgetLanguageChange);
    window.addEventListener('cs-widget-theme-change', onWidgetThemeChange);

    loadWidget();

    var observer = new MutationObserver(function () {
      syncWidgetThemeFromHost(20, false);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    window.setInterval(function () {
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        if (pendingWidgetDocsLocale !== null) {
          confirmPendingWidgetDocsNavigation();
          return;
        }
        syncWidgetLanguageFromHost(20, false);
      }
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
