var WIDGET_SRC = 'https://cs.6mm.com/widget/widget.js';
// Public SaaS tenant identifier, not a signing secret.
var APP_KEY = 'app_-ofLSy2QTO0xAI4pkAiQ3Jch';
var locales = window.__sixmmDocsLocales || [];
var host = window.__sixmmDocsHost;
var localeRoutes = new Map();
var widgetLanguageRoutes = {};
locales.forEach(function (locale) {
  if (locale.code && !localeRoutes.has(locale.code)) {
    localeRoutes.set(locale.code, { route: locale.code, widget: locale.widget || locale.code });
  }
  (locale.aliases || [locale.widget || locale.code]).forEach(function (alias) {
    widgetLanguageRoutes[String(alias).toLowerCase()] = locale.code;
  });
});
var lastWidgetLanguage = null;
var lastTheme = null;
var languageRetryTimer = null;
var languageRetryForce = false;
var themeRetryTimer = null;
var themeRetryForce = false;
var pendingWidgetDocsLocale = null;
var pendingWidgetDocsResolved = false;
var pendingWidgetTheme = null;
var widgetDocsRequestId = 0;
var retainedWidgetNodes = [];
var observedWidgetContainer = null;
var widgetContainerObserver = null;
var observedWidgetBody = null;
var widgetBodyObserver = null;
var widgetRequested = false;
var openWhenReady = false;
var retainedModalStyles = null;
var supportFrame = null;
var supportStatus = null;
var supportMessage = null;
var supportRetry = null;
var supportClose = null;
var supportFrameReady = false;
var supportFrameFailed = false;
var supportDeadline = null;
var modalProperties = ['overflow', 'position', 'top', 'left', 'right', 'width', 'background', 'padding-right'];
