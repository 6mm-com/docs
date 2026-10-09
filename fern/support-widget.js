(function () {
  if (window.__sixmmSupportWidgetLoader) return;
  window.__sixmmSupportWidgetLoader = true;

  var WIDGET_SRC = 'https://cs.6mm.com/widget/widget.js';
  // Public SaaS tenant identifier, not a signing secret.
  var APP_KEY = 'app_-ofLSy2QTO0xAI4pkAiQ3Jch';
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
  var retainedWidgetNodes = [];
  var observedWidgetContainer = null;
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
  var supportLabels = {
    en: 'Open customer support', ja: 'カスタマーサポートを開く',
    ru: 'Открыть поддержку', 'es-419': 'Abrir atención al cliente',
    it: 'Apri assistenza clienti', fr: 'Ouvrir le support client',
    de: 'Kundensupport öffnen', 'zh-CN': '打开在线客服',
    'zh-TW': '開啟線上客服', 'pt-BR': 'Abrir atendimento ao cliente',
    id: 'Buka layanan pelanggan', pl: 'Otwórz obsługę klienta',
    vi: 'Mở hỗ trợ khách hàng', uk: 'Відкрити підтримку',
    'pt-PT': 'Abrir apoio ao cliente', 'es-ES': 'Abrir atención al cliente',
    tr: 'Müşteri desteğini aç', ko: '고객 지원 열기',
    el: 'Άνοιγμα υποστήριξης πελατών', ar: 'فتح دعم العملاء'
  };

  var statusLabels = {
  "en": [
    "Loading customer support…",
    "Customer support is taking longer to load. Check your connection and try again.",
    "Retry",
    "Close"
  ],
  "zh-CN": [
    "正在加载在线客服…",
    "客服加载时间较长，请检查网络后重试。",
    "重试",
    "关闭"
  ],
  "zh-TW": [
    "正在載入線上客服…",
    "客服載入時間較長，請檢查網路後重試。",
    "重試",
    "關閉"
  ],
  "ja": [
    "サポートを読み込み中…",
    "読み込みに時間がかかっています。接続を確認して再試行してください。",
    "再試行",
    "閉じる"
  ],
  "ru": [
    "Загрузка поддержки…",
    "Загрузка поддержки занимает больше времени. Проверьте соединение и повторите попытку.",
    "Повторить",
    "Закрыть"
  ],
  "es-419": [
    "Cargando atención al cliente…",
    "La carga está tardando más de lo esperado. Revisa tu conexión e inténtalo de nuevo.",
    "Reintentar",
    "Cerrar"
  ],
  "it": [
    "Caricamento assistenza clienti…",
    "Il caricamento richiede più tempo. Controlla la connessione e riprova.",
    "Riprova",
    "Chiudi"
  ],
  "fr": [
    "Chargement du support client…",
    "Le chargement prend plus de temps. Vérifiez votre connexion et réessayez.",
    "Réessayer",
    "Fermer"
  ],
  "de": [
    "Kundensupport wird geladen…",
    "Das Laden dauert länger. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    "Erneut versuchen",
    "Schließen"
  ],
  "pt-BR": [
    "Carregando atendimento ao cliente…",
    "O carregamento está demorando mais. Verifique sua conexão e tente novamente.",
    "Tentar novamente",
    "Fechar"
  ],
  "id": [
    "Memuat layanan pelanggan…",
    "Pemuatan memerlukan waktu lebih lama. Periksa koneksi Anda dan coba lagi.",
    "Coba lagi",
    "Tutup"
  ],
  "pl": [
    "Ładowanie obsługi klienta…",
    "Ładowanie trwa dłużej. Sprawdź połączenie i spróbuj ponownie.",
    "Spróbuj ponownie",
    "Zamknij"
  ],
  "vi": [
    "Đang tải hỗ trợ khách hàng…",
    "Quá trình tải mất nhiều thời gian hơn. Kiểm tra kết nối và thử lại.",
    "Thử lại",
    "Đóng"
  ],
  "uk": [
    "Завантаження підтримки…",
    "Завантаження триває довше. Перевірте з’єднання та спробуйте ще раз.",
    "Спробувати ще раз",
    "Закрити"
  ],
  "pt-PT": [
    "A carregar apoio ao cliente…",
    "O carregamento está a demorar mais. Verifique a ligação e tente novamente.",
    "Tentar novamente",
    "Fechar"
  ],
  "es-ES": [
    "Cargando atención al cliente…",
    "La carga está tardando más de lo esperado. Comprueba tu conexión e inténtalo de nuevo.",
    "Reintentar",
    "Cerrar"
  ],
  "tr": [
    "Müşteri desteği yükleniyor…",
    "Yükleme daha uzun sürüyor. Bağlantınızı kontrol edip tekrar deneyin.",
    "Tekrar dene",
    "Kapat"
  ],
  "ko": [
    "고객 지원 로딩 중…",
    "로딩이 지연되고 있습니다. 연결을 확인하고 다시 시도하세요.",
    "다시 시도",
    "닫기"
  ],
  "el": [
    "Φόρτωση υποστήριξης πελατών…",
    "Η φόρτωση καθυστερεί. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
    "Δοκιμή ξανά",
    "Κλείσιμο"
  ],
  "ar": [
    "جارٍ تحميل دعم العملاء…",
    "يستغرق التحميل وقتًا أطول. تحقق من اتصالك وحاول مرة أخرى.",
    "إعادة المحاولة",
    "إغلاق"
  ]
};

  function renderSupportStatus() {
    if (!supportStatus) return;
    var labels = statusLabels[currentDocsLocale() || 'en'] || statusLabels.en;
    supportStatus.hidden = supportFrameReady;
    supportStatus.dataset.state = supportFrameFailed ? 'error' : 'loading';
    supportMessage.textContent = labels[supportFrameFailed ? 1 : 0];
    supportRetry.textContent = labels[2];
    supportRetry.hidden = !supportFrameFailed;
    supportClose.textContent = labels[3];
  }

  function startSupportDeadline() {
    if (supportDeadline !== null) window.clearTimeout(supportDeadline);
    supportFrameFailed = false;
    renderSupportStatus();
    supportDeadline = window.setTimeout(function () {
      supportDeadline = null;
      if (!supportFrameReady) { supportFrameFailed = true; renderSupportStatus(); }
    }, 12000);
  }

  function ensureSupportStatus(container, frame) {
    if (supportFrame === frame) { renderSupportStatus(); return; }
    supportFrame = frame;
    supportFrameReady = false;
    supportFrameFailed = false;
    supportStatus = document.createElement('div');
    supportStatus.className = 'sixmm-support-status';
    supportStatus.setAttribute('role', 'status');
    supportStatus.setAttribute('aria-live', 'polite');
    var spinner = document.createElement('span');
    spinner.className = 'sixmm-support-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    supportMessage = document.createElement('p');
    supportRetry = document.createElement('button');
    supportRetry.type = 'button';
    supportRetry.addEventListener('click', function () {
      if (supportFrameReady) return;
      startSupportDeadline();
      // Retry only on explicit request. Never reload an active conversation.
      frame.src = frame.src;
    });
    supportClose = document.createElement('button');
    supportClose.type = 'button';
    supportClose.addEventListener('click', function () { callWidget('close'); });
    [spinner, supportMessage, supportRetry, supportClose].forEach(function (node) { supportStatus.appendChild(node); });
    container.appendChild(supportStatus);
    frame.addEventListener('error', function () {
      if (supportFrame !== frame || supportFrameReady) return;
      supportFrameFailed = true;
      renderSupportStatus();
    });
    startSupportDeadline();
  }

  function onSupportFrameMessage(event) {
    if (!supportFrame || event.source !== supportFrame.contentWindow) return;
    var origin;
    try { origin = new URL(supportFrame.src).origin; } catch (_) { return; }
    // This existing SDK message is emitted by the widget's React theme effect
    // after its interface mounts. An iframe load event alone is not app ready.
    if (event.origin !== origin || !event.data || event.data.type !== 'cs-widget-browser-theme') return;
    supportFrameReady = true;
    if (supportDeadline !== null) window.clearTimeout(supportDeadline);
    supportDeadline = null;
    renderSupportStatus();
  }

  function syncWidgetAccessibility() {
    var bubble = document.getElementById('cs-widget-bubble');
    var container = document.getElementById('cs-widget-container');
    var launcher = document.getElementById('sixmm-support-launcher');
    if (launcher) launcher.setAttribute('aria-label', supportLabels[currentDocsLocale() || 'en'] || supportLabels.en);
    if (!bubble || !container) return;
    var frame = container.querySelector('iframe');
    if (frame) ensureSupportStatus(container, frame);
    if (launcher) launcher.remove();
    if (openWhenReady && window.CSWidget && typeof window.CSWidget.open === 'function') {
      openWhenReady = false;
      window.CSWidget.open();
    }
    var open = container.style.display !== 'none';
    var label = supportLabels[currentDocsLocale() || 'en'] || supportLabels.en;
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', open ? '-1' : '0');
    bubble.setAttribute('aria-label', label);
    bubble.setAttribute('aria-controls', 'cs-widget-container');
    bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (frame) frame.setAttribute('title', label);
    if (bubble.dataset.sixmmKeyboardSupport !== 'true') {
      bubble.dataset.sixmmKeyboardSupport = 'true';
      bubble.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!event.repeat) bubble.click();
      });
    }
    if (observedWidgetContainer !== container) {
      observedWidgetContainer = container;
      new MutationObserver(syncWidgetAccessibility).observe(container, {
        attributes: true, attributeFilter: ['style']
      });
    }
  }

  function prepareWidgetSwap(event) {
    var incoming = event.newDocument;
    if (!incoming || !incoming.body || !incoming.head) return;

    var container = document.getElementById('cs-widget-container');
    retainedModalStyles = null;
    if (container && container.style.display !== 'none') {
      retainedModalStyles = {};
      ['body', 'documentElement'].forEach(function (part) {
        retainedModalStyles[part] = modalProperties.map(function (property) {
          var style = document[part].style;
          return [property, style.getPropertyValue(property), style.getPropertyPriority(property)];
        });
        applyModalStyles(incoming[part], retainedModalStyles[part]);
      });
    }
    var nodes = [
      document.getElementById('cs-widget-bubble'),
      document.getElementById('cs-widget-container'),
      document.getElementById('cs-bubble-style'),
      document.querySelector('script[data-sixmm-support-widget="true"]'),
      document.getElementById('cs-widget-overlay'),
      document.getElementById('sixmm-support-launcher'),
    ];
    retainedWidgetNodes = [];
    nodes.forEach(function (node, index) {
      if (!node) return;
      var key = 'sixmm-support-' + index;
      var inHead = node.parentNode === document.head;
      var target = inHead ? incoming.head : incoming.body;
      node.setAttribute('data-astro-transition-persist', key);
      retainedWidgetNodes.push({ node: node, key: key, inHead: inHead });

      // Astro only preserves nodes that have a matching incoming placeholder.
      // Its state-preserving move keeps an open iframe connected where supported.
      var placeholder = incoming.querySelector(
        '[data-astro-transition-persist="' + key + '"]',
      );
      if (!placeholder) {
        placeholder = incoming.createElement(node.tagName.toLowerCase());
        placeholder.setAttribute('data-astro-transition-persist', key);
        target.appendChild(placeholder);
      }
    });
  }

  function applyModalStyles(element, entries) {
    entries.forEach(function (entry) {
      if (entry[1]) element.style.setProperty(entry[0], entry[1], entry[2]);
    });
  }

  function restoreWidgetAfterSwap() {
    retainedWidgetNodes.forEach(function (entry) {
      if (entry.node.isConnected) return;
      // Fallback for hosts that did not preserve the marked nodes during a swap.
      var target = entry.inHead ? document.head : document.body;
      target.appendChild(entry.node);
    });
    if (retainedModalStyles) {
      ['body', 'documentElement'].forEach(function (part) {
        applyModalStyles(document[part], retainedModalStyles[part]);
      });
      retainedModalStyles = null;
    }
    if (widgetRequested) loadWidget();
    else ensureLauncher();
    syncWidgetAccessibility();
    if (pendingWidgetDocsLocale !== null) {
      confirmPendingWidgetDocsNavigation();
    } else {
      if (widgetRequested) syncWidgetLanguageFromHost(20, false);
    }
    if (widgetRequested) syncWidgetThemeFromHost(20, false);
  }

  function normalizeLanguage(lang) {
    return typeof lang === 'string'
      ? lang.trim().replace(/_/g, '-').toLowerCase()
      : '';
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
      : '';
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
    lastPathname = window.location.pathname;
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
    new MutationObserver(syncWidgetAccessibility).observe(document.body, {
      childList: true
    });
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
})();
