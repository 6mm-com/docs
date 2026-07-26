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
  var routePrefixes = localeRoutes.map(function (locale) {
    return locale.route;
  });
  var lastPathname = window.location.pathname;
  var lastTheme = null;
  var lastLang = null;
  var ignoreWidgetLanguageEventsUntil = 0;

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

  function syncWidget() {
    var lang = currentLang();
    var lastDocsLocale = routeForWidgetLanguage(lastLang);
    if (lastDocsLocale !== currentDocsLocale()) {
      // setLang can synchronously or asynchronously echo a language-change
      // event. Ignore that echo so regional aliases do not bounce routes.
      ignoreWidgetLanguageEventsUntil = Date.now() + 1500;
    }
    if (
      lastDocsLocale !== currentDocsLocale() &&
      callWidget('setLang', lang)
    ) {
      lastLang = lang;
    }

    var theme = currentTheme();
    if (theme !== lastTheme && callWidget('setTheme', theme)) {
      lastTheme = theme;
    }
  }

  function currentPagePath() {
    var segments = window.location.pathname.split('/').filter(Boolean);
    if (routePrefixes.indexOf(segments[0]) >= 0) segments.shift();
    return '/' + (segments.join('/') || 'home');
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

    lastLang = lang;
    var targetPath = (route ? '/' + route : '') + currentPagePath();
    if (targetPath === window.location.pathname) return;

    if (typeof window.__sixmmNavigateDocsLocale === 'function') {
      window.__sixmmNavigateDocsLocale(route);
    }
  }

  function switchHostTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;

    lastTheme = theme;
    if (currentTheme() === theme) return;

    var root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;

    try {
      window.localStorage.setItem('theme', theme);
    } catch (_error) {
      // Theme still changes for the current page when storage is unavailable.
    }
  }

  function onWidgetLanguageChange(event) {
    if (Date.now() < ignoreWidgetLanguageEventsUntil) return;
    switchHostLanguage(event && event.detail ? event.detail.lang : '');
  }

  function onWidgetThemeChange(event) {
    switchHostTheme(event && event.detail ? event.detail.theme : '');
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
      syncWidget();
    };
    script.onerror = function () {
      document.documentElement.classList.remove('sixmm-support-widget-loading');
    };
    lastLang = initialLang;
    lastTheme = initialTheme;
    ignoreWidgetLanguageEventsUntil = Date.now() + 2000;
    document.body.appendChild(script);
  }

  function boot() {
    window.addEventListener('cs-widget-lang-change', onWidgetLanguageChange);
    window.addEventListener('cs-widget-theme-change', onWidgetThemeChange);

    loadWidget();

    var observer = new MutationObserver(syncWidget);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    window.setInterval(function () {
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        syncWidget();
      }
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
