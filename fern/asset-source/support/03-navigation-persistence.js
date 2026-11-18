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
  observeWidgetBody();
  retainedWidgetNodes.forEach(function (entry) {
    if (entry.node.isConnected) return;
    // Fallback for hosts that did not preserve the marked nodes during a swap.
    var target = entry.inHead ? document.head : document.body;
    target.appendChild(entry.node);
  });
  // These references belong only to the completed swap, not later SDK mounts.
  retainedWidgetNodes = [];
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
