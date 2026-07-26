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
  var lastTheme = null;
  var pendingWidgetDocsLocale = null;
  var pendingWidgetTheme = null;
  var widgetDocsRequestId = 0;

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

  function syncWidgetLanguageFromHost(retries) {
    if (callWidget('setLang', currentLang())) return;
    if (retries > 0) {
      window.setTimeout(function () {
        syncWidgetLanguageFromHost(retries - 1);
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
    var normalized = typeof lang === 'string' ? lang.trim().replace(/_/g, '-').toLowerCase() : '';
    return Object.prototype.hasOwnProperty.call(widgetLanguageRoutes, normalized)
      ? widgetLanguageRoutes[normalized]
      : null;
  }

  function switchHostLanguage(lang) {
    var route = routeForWidgetLanguage(lang);
    if (route === null) return;
    var requestId = ++widgetDocsRequestId;

    pendingWidgetDocsLocale = route;

    if (typeof window.__sixmmNavigateDocsLocale === 'function') {
      Promise.resolve(window.__sixmmNavigateDocsLocale(route)).then(function (success) {
        if (
          !success &&
          requestId === widgetDocsRequestId &&
          pendingWidgetDocsLocale === route
        ) {
          pendingWidgetDocsLocale = null;
        }
      });
    } else {
      pendingWidgetDocsLocale = null;
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
    switchHostLanguage(event && event.detail ? event.detail.lang : '');
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
      syncWidgetLanguageFromHost(20);
      syncWidgetThemeFromHost(20, true);
    };
    script.onerror = function () {
      document.documentElement.classList.remove('sixmm-support-widget-loading');
    };
    lastTheme = initialTheme;
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
        if (
          pendingWidgetDocsLocale !== null &&
          pendingWidgetDocsLocale === currentDocsLocale()
        ) {
          pendingWidgetDocsLocale = null;
          return;
        }
        pendingWidgetDocsLocale = null;
        syncWidgetLanguageFromHost(20);
      }
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
