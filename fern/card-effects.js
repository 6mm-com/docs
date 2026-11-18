(function () {
  if (window.__sixmmCardEffects) return;
  window.__sixmmCardEffects = true;

  var languageGroups = ".sixmm-language-menu-enhanced .fern-language-selector-radio-group, .sixmm-mobile-language-dialog-options";
  var groupSelector = ".fern-card-group, .sixmm-stat-grid, .fern-layout-footer .fern-footer-nav, " + languageGroups;
  var cardSelector = ".fern-card, .sixmm-stat-grid > div";
  var groups = new Map();
  var hover = window.matchMedia("(hover: hover) and (pointer: fine)");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var activeGroup = null;
  var hoveredCard = null;
  var pointer = null;
  var frame = 0;
  var scanFrame = 0;
  var radius = 300;
  var observedBody = null;
  var bodyObserver = null;
  var measuredRects = [];

  function enabled() {
    return window.innerWidth > 768 && hover.matches && !reducedMotion.matches;
  }

  function reset() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    measuredRects.length = 0;
    if (activeGroup) {
      (groups.get(activeGroup) || []).forEach(function (card) {
        card.style.setProperty("--sixmm-card-intensity", "0");
      });
    }
    if (hoveredCard) hoveredCard.removeAttribute("data-sixmm-card-hovered");
    hoveredCard = null;
    activeGroup = null;
  }

  function register(card, effectClass) {
    var group = card.closest(groupSelector) || card;
    var className = effectClass === "sixmm-language-option-effect" ? effectClass : "sixmm-content-card";
    if (!card.classList.contains(className)) card.classList.add(className);
    if (!groups.has(group)) groups.set(group, []);
    var cards = groups.get(group);
    if (cards.indexOf(card) === -1) cards.push(card);
  }

  function scan() {
    scanFrame = 0;
    groups.forEach(function (_, group) {
      if (!group.isConnected) {
        if (activeGroup === group) reset();
        groups.delete(group);
      }
    });
    document.querySelectorAll("article").forEach(function (article) {
      article.querySelectorAll(cardSelector).forEach(function (card) {
        // Header, sidebar and search controls never become effect targets.
        if (card.closest("nav, aside, header, .fern-footer-nav")) return;
        register(card);
      });
    });
    // Only the footer's page-switching cards opt in; feedback and edit controls do not.
    document.querySelectorAll(".fern-layout-footer .fern-footer-nav > a").forEach(register);
    document.querySelectorAll(
      ".sixmm-language-menu-enhanced .fern-language-dropdown-item, .sixmm-mobile-language-dialog-option"
    ).forEach(function (option) { register(option, "sixmm-language-option-effect"); });
    groups.forEach(function (cards) {
      // Compact private group lists without allocating replacements on every scan.
      var count = 0;
      for (var index = 0; index < cards.length; index++) {
        if (cards[index].isConnected) cards[count++] = cards[index];
      }
      cards.length = count;
    });
  }

  function scheduleScan() {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  }

  function render() {
    frame = 0;
    if (!pointer || !activeGroup || !enabled()) return;
    var glowRadius = activeGroup.matches(languageGroups) ? 160 : radius;
    var cards = groups.get(activeGroup) || [];
    // Measure the whole group before style writes can invalidate its geometry.
    measuredRects.length = cards.length;
    for (var index = 0; index < cards.length; index++) {
      measuredRects[index] = cards[index].getBoundingClientRect();
    }
    cards.forEach(function (card, index) {
      var rect = measuredRects[index];
      if (!rect.width || !rect.height) return;
      var distance = Math.max(0, Math.hypot(
        pointer.x - rect.left - rect.width / 2,
        pointer.y - rect.top - rect.height / 2
      ) - Math.max(rect.width, rect.height) / 2);
      var near = glowRadius * 0.5;
      var far = glowRadius * 0.75;
      var intensity = distance <= near ? 1 : Math.max(0, (far - distance) / (far - near));
      card.style.setProperty("--sixmm-card-x", (pointer.x - rect.left) + "px");
      card.style.setProperty("--sixmm-card-y", (pointer.y - rect.top) + "px");
      card.style.setProperty("--sixmm-card-intensity", intensity.toFixed(3));
    });
  }

  function move(event) {
    if (!enabled() || event.pointerType === "touch") { reset(); return; }
    var target = event.target instanceof Element ? event.target : null;
    var card = target && target.closest(".sixmm-content-card, .sixmm-language-option-effect");
    var group = target && (target.closest(groupSelector) || card);
    if (!group || !groups.has(group)) { reset(); return; }
    if (activeGroup !== group) { reset(); activeGroup = group; }
    if (hoveredCard !== card) {
      if (hoveredCard) hoveredCard.removeAttribute("data-sixmm-card-hovered");
      hoveredCard = card;
      if (card) card.setAttribute("data-sixmm-card-hovered", "true");
    }
    if (!pointer) pointer = {};
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!frame) frame = requestAnimationFrame(render);
  }

  function containsElement(nodes) {
    return Array.prototype.some.call(nodes, function (node) { return node.nodeType === 1; });
  }

  function observeBody() {
    if (observedBody === document.body) return;
    if (bodyObserver) bodyObserver.disconnect();
    else bodyObserver = new MutationObserver(function (records) {
      // Text and comment changes cannot add or remove card targets.
      if (records.some(function (record) {
        return containsElement(record.addedNodes) || containsElement(record.removedNodes);
      })) {
        scheduleScan();
      }
    });
    observedBody = document.body;
    bodyObserver.observe(observedBody, { childList: true, subtree: true });
  }

  function start() {
    scan();
    observeBody();
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", reset, { passive: true });
    document.addEventListener("scroll", reset, { passive: true, capture: true });
    document.addEventListener("visibilitychange", function () { if (document.hidden) reset(); });
    document.addEventListener("astro:page-load", function () {
      observeBody();
      scheduleScan();
    });
    document.addEventListener("astro:before-swap", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset, { passive: true });
    hover.addEventListener("change", reset);
    reducedMotion.addEventListener("change", reset);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
