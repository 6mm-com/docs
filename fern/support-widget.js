(function () {
  if (window.__sixmmSupportWidgetLoader) return;
  window.__sixmmSupportWidgetLoader = true;

  var WIDGET_SRC = 'https://csadmin.6mm.com/widget/widget.js';
  var APP_ID = '6mm-docs';
  var localeRoutes = [
    { route: 'es-419', widget: 'es-419' },
    { route: 'zh-TW', widget: 'zh-TW' },
    { route: 'pt-BR', widget: 'pt-BR' },
    { route: 'es-AR', widget: 'es-AR' },
    { route: 'pt-PT', widget: 'pt-PT' },
    { route: 'es-ES', widget: 'es-ES' },
    { route: 'ja', widget: 'ja' },
    { route: 'ru', widget: 'ru' },
    { route: 'it', widget: 'it' },
    { route: 'fr', widget: 'fr' },
    { route: 'de', widget: 'de' },
    { route: 'zh', widget: 'zh-CN' },
    { route: 'id', widget: 'id' },
    { route: 'pl', widget: 'pl' },
    { route: 'vi', widget: 'vi' },
    { route: 'uk', widget: 'uk' },
    { route: 'ar', widget: 'ar' },
    { route: 'uz', widget: 'uz-UZ' },
    { route: 'fil', widget: 'fil-PH' },
    { route: 'az', widget: 'az-AZ' }
  ];
  var widgetLanguageRoutes = {
    en: '',
    'en-us': '',
    'en-gb': '',
    'en-sg': '',
    ja: 'ja',
    'ja-jp': 'ja',
    ru: 'ru',
    'ru-ru': 'ru',
    'es-419': 'es-419',
    it: 'it',
    'it-it': 'it',
    fr: 'fr',
    'fr-fr': 'fr',
    de: 'de',
    'de-de': 'de',
    zh: 'zh',
    'zh-cn': 'zh',
    'zh-hans': 'zh',
    'zh-tw': 'zh-TW',
    'zh-hant': 'zh-TW',
    'pt-br': 'pt-BR',
    id: 'id',
    'id-id': 'id',
    pl: 'pl',
    'pl-pl': 'pl',
    vi: 'vi',
    'vi-vn': 'vi',
    uk: 'uk',
    'uk-ua': 'uk',
    'pt-pt': 'pt-PT',
    'es-es': 'es-ES',
    'es-ar': 'es-AR',
    ar: 'ar',
    'ar-sa': 'ar',
    uz: 'uz',
    'uz-uz': 'uz',
    fil: 'fil',
    'fil-ph': 'fil',
    az: 'az',
    'az-az': 'az'
  };
  var routePrefixes = localeRoutes.map(function (locale) {
    return locale.route;
  });
  var lastPathname = window.location.pathname;
  var lastTheme = null;
  var lastLang = null;

  function currentLang() {
    var firstSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
    var locale = localeRoutes.find(function (item) {
      return item.route === firstSegment;
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
    if (lang !== lastLang && callWidget('setLang', lang)) {
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

    window.location.assign(targetPath + window.location.search + window.location.hash);
  }

  function switchHostTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;

    lastTheme = theme;
    if (currentTheme() === theme) return;

    var root = document.documentElement;
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
    switchHostLanguage(event && event.detail ? event.detail.lang : '');
  }

  function onWidgetThemeChange(event) {
    switchHostTheme(event && event.detail ? event.detail.theme : '');
  }

  function loadWidget() {
    if (document.querySelector('script[data-sixmm-support-widget="true"]')) return;

    var script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.dataset.sixmmSupportWidget = 'true';
    script.dataset.lang = currentLang();
    script.dataset.theme = currentTheme();
    script.dataset.color = currentAccentColor();
    script.dataset.appId = APP_ID;
    script.onload = syncWidget;
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
      if (window.location.pathname === lastPathname) return;
      lastPathname = window.location.pathname;
      syncWidget();
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
