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
  if (supportStatus.hidden !== supportFrameReady) supportStatus.hidden = supportFrameReady;
  var state = supportFrameFailed ? 'error' : 'loading';
  if (supportStatus.dataset.state !== state) supportStatus.dataset.state = state;
  var message = labels[supportFrameFailed ? 1 : 0];
  if (supportMessage.textContent !== message) supportMessage.textContent = message;
  if (supportRetry.textContent !== labels[2]) supportRetry.textContent = labels[2];
  if (supportRetry.hidden !== !supportFrameFailed) supportRetry.hidden = !supportFrameFailed;
  if (supportClose.textContent !== labels[3]) supportClose.textContent = labels[3];
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
  if (supportStatus) supportStatus.remove();
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

function setAttributeIfChanged(element, name, value) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function syncWidgetAccessibility() {
  var bubble = document.getElementById('cs-widget-bubble');
  var container = document.getElementById('cs-widget-container');
  var launcher = document.getElementById('sixmm-support-launcher');
  if (launcher) setAttributeIfChanged(launcher, 'aria-label', supportLabels[currentDocsLocale() || 'en'] || supportLabels.en);
  if (!bubble || !container) {
    if (widgetContainerObserver) widgetContainerObserver.disconnect();
    observedWidgetContainer = null;
    return;
  }
  var frame = container.querySelector('iframe');
  if (frame) ensureSupportStatus(container, frame);
  if (launcher) launcher.remove();
  if (openWhenReady && window.CSWidget && typeof window.CSWidget.open === 'function') {
    openWhenReady = false;
    window.CSWidget.open();
  }
  var open = container.style.display !== 'none';
  var label = supportLabels[currentDocsLocale() || 'en'] || supportLabels.en;
  setAttributeIfChanged(bubble, 'role', 'button');
  setAttributeIfChanged(bubble, 'tabindex', open ? '-1' : '0');
  setAttributeIfChanged(bubble, 'aria-label', label);
  setAttributeIfChanged(bubble, 'aria-controls', 'cs-widget-container');
  setAttributeIfChanged(bubble, 'aria-expanded', open ? 'true' : 'false');
  if (frame) setAttributeIfChanged(frame, 'title', label);
  if (bubble.dataset.sixmmKeyboardSupport !== 'true') {
    bubble.dataset.sixmmKeyboardSupport = 'true';
    bubble.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!event.repeat) bubble.click();
    });
  }
  if (observedWidgetContainer !== container) {
    if (widgetContainerObserver) widgetContainerObserver.disconnect();
    else widgetContainerObserver = new MutationObserver(syncWidgetAccessibility);
    observedWidgetContainer = container;
    widgetContainerObserver.observe(container, {
      attributes: true, attributeFilter: ['style']
    });
  }
}

function observeWidgetBody() {
  if (observedWidgetBody === document.body) return;
  if (widgetBodyObserver) widgetBodyObserver.disconnect();
  else widgetBodyObserver = new MutationObserver(syncWidgetAccessibility);
  observedWidgetBody = document.body;
  widgetBodyObserver.observe(observedWidgetBody, { childList: true });
}
