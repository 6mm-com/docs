function normalizeLanguage(lang) {
  return typeof lang === 'string'
    ? lang.trim().replace(/_/g, '-').toLowerCase()
    : '';
}

function currentLocaleRoute() {
  return localeRoutes.get(host.firstPathSegment(window.location.pathname));
}

function currentDocsLocale() {
  var locale = currentLocaleRoute();
  return locale ? locale.route : '';
}

function currentLang() {
  var locale = currentLocaleRoute();
  return locale ? locale.widget : 'en';
}

function currentTheme() {
  return host.readTheme(document.documentElement);
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
  force = force || languageRetryForce;
  if (languageRetryTimer !== null) window.clearTimeout(languageRetryTimer);
  languageRetryTimer = null;
  languageRetryForce = false;
  var language = currentLang();
  if (!force && language === lastWidgetLanguage) return;
  if (callWidget('setLang', language)) {
    lastWidgetLanguage = language;
    return;
  }
  if (retries > 0) {
    languageRetryForce = force;
    languageRetryTimer = window.setTimeout(function () {
      languageRetryTimer = null;
      syncWidgetLanguageFromHost(retries - 1, force);
    }, 100);
  }
}

function syncWidgetThemeFromHost(retries, force) {
  force = force || themeRetryForce;
  if (themeRetryTimer !== null) window.clearTimeout(themeRetryTimer);
  themeRetryTimer = null;
  themeRetryForce = false;
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
      themeRetryForce = force;
      themeRetryTimer = window.setTimeout(function () {
        themeRetryTimer = null;
        syncWidgetThemeFromHost(retries - 1, force);
      }, 100);
    }
  }
}

function routeForWidgetLanguage(lang) {
  var normalized = normalizeLanguage(lang);
  return Object.prototype.hasOwnProperty.call(widgetLanguageRoutes, normalized)
    ? widgetLanguageRoutes[normalized]
    : '';
}

function clearPendingWidgetDocsNavigation() {
  pendingWidgetDocsLocale = null;
  pendingWidgetDocsResolved = false;
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
  var requestId = ++widgetDocsRequestId;
  var locale = localeRoutes.get(route);

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
  switchHostLanguage(language);
}

function onWidgetThemeChange(event) {
  var theme = event && event.detail ? event.detail.theme : '';
  if (theme !== 'light' && theme !== 'dark') return;
  pendingWidgetTheme = theme;
  switchHostTheme(theme);
}
