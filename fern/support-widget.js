(function () {
  if (window.__sixmmSupportWidgetLoader) return;
  window.__sixmmSupportWidgetLoader = true;

  var WIDGET_SRC = 'https://csadmin.6mm.com/widget/widget.js';
  var APP_ID = '6mm-docs';
  var lastPathname = window.location.pathname;
  var lastTheme = null;

  function isChinesePage() {
    return window.location.pathname === '/zh' || window.location.pathname.indexOf('/zh/') === 0;
  }

  function currentLang() {
    return isChinesePage() ? 'zh-CN' : 'en';
  }

  function currentTheme() {
    var root = document.documentElement;
    if (root.classList.contains('dark') || root.dataset.theme === 'dark') return 'dark';
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
    callWidget('setLang', currentLang());
    var theme = currentTheme();
    if (theme !== lastTheme) {
      lastTheme = theme;
      callWidget('setTheme', theme);
    }
  }

  function loadWidget() {
    if (document.querySelector('script[data-sixmm-support-widget="true"]')) return;

    var script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.dataset.sixmmSupportWidget = 'true';
    script.dataset.lang = currentLang();
    script.dataset.color = currentAccentColor();
    script.dataset.appId = APP_ID;
    script.onload = syncWidget;
    document.body.appendChild(script);
  }

  function boot() {
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
