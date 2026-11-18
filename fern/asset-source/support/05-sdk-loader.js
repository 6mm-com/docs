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
  // This script starts executing when appended. Astro must not execute the
  // retained SDK again after swapping pages, which would duplicate listeners.
  script.dataset.astroExec = '';
  script.dataset.lang = initialLang;
  script.dataset.theme = initialTheme;
  script.dataset.color = currentAccentColor();
  script.dataset.appKey = APP_KEY;
  script.onload = function () {
    document.documentElement.classList.remove('sixmm-support-widget-loading');
    // The host may have changed while widget.js was loading.
    syncWidgetLanguageFromHost(20, true);
    syncWidgetThemeFromHost(20, true);
    syncWidgetAccessibility();
  };
  script.onerror = function () {
    document.documentElement.classList.remove('sixmm-support-widget-loading');
    script.remove();
    widgetRequested = false;
    openWhenReady = false;
    ensureLauncher();
  };
  lastTheme = initialTheme;
  document.body.appendChild(script);
}

function ensureLauncher() {
  if (document.getElementById('cs-widget-bubble')) return;
  var launcher = document.getElementById('sixmm-support-launcher');
  if (!launcher) {
    launcher = document.createElement('button');
    launcher.id = 'sixmm-support-launcher';
    launcher.type = 'button';
    launcher.className = 'sixmm-support-launcher';
    launcher.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="1" y="13" width="4" height="7" rx="2"/><rect x="19" y="13" width="4" height="7" rx="2"/><path d="M21 18v1a3 3 0 0 1-3 3h-4"/></svg>';
    launcher.addEventListener('click', function () {
      widgetRequested = true;
      openWhenReady = true;
      launcher.setAttribute('aria-busy', 'true');
      loadWidget();
    });
    document.body.appendChild(launcher);
  }
  launcher.setAttribute('aria-busy', widgetRequested ? 'true' : 'false');
  syncWidgetAccessibility();
}

function syncHostNavigation() {
  if (!widgetRequested) { syncWidgetAccessibility(); return; }
  if (pendingWidgetDocsLocale !== null) { confirmPendingWidgetDocsNavigation(); return; }
  syncWidgetLanguageFromHost(20, false);
}

function boot() {
  window.addEventListener('message', onSupportFrameMessage);
  window.addEventListener('cs-widget-lang-change', onWidgetLanguageChange);
  window.addEventListener('cs-widget-theme-change', onWidgetThemeChange);
  document.addEventListener('astro:before-swap', prepareWidgetSwap);
  document.addEventListener('astro:page-load', restoreWidgetAfterSwap);

  ensureLauncher();
  window.addEventListener('popstate', syncHostNavigation);
  window.addEventListener('pageshow', syncHostNavigation);
  // The SDK mounts the controls asynchronously as direct body children.
  observeWidgetBody();
  // Initialize in the background on every fresh page load, so the iframe can
  // mount before the user opens support. Astro navigation retains this SDK.
  widgetRequested = true;
  loadWidget();

  var observer = new MutationObserver(function () {
    if (widgetRequested) syncWidgetThemeFromHost(20, false);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme']
  });

  document.addEventListener('astro:page-load', syncHostNavigation);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
