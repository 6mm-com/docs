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

  function enabled() {
    return window.innerWidth > 768 && hover.matches && !reducedMotion.matches;
  }

  function reset() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
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
    card.classList.add(effectClass === "sixmm-language-option-effect" ? effectClass : "sixmm-content-card");
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
    groups.forEach(function (cards, group) {
      groups.set(group, cards.filter(function (card) { return card.isConnected; }));
    });
  }

  function scheduleScan() {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  }

  function render() {
    frame = 0;
    if (!pointer || !activeGroup || !enabled()) return;
    var glowRadius = activeGroup.matches(languageGroups) ? 160 : radius;
    (groups.get(activeGroup) || []).forEach(function (card) {
      var rect = card.getBoundingClientRect();
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
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(render);
  }

  function start() {
    scan();
    new MutationObserver(function (records) {
      if (records.some(function (record) { return record.addedNodes.length || record.removedNodes.length; })) {
        scheduleScan();
      }
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", reset, { passive: true });
    document.addEventListener("scroll", reset, { passive: true, capture: true });
    document.addEventListener("visibilitychange", function () { if (document.hidden) reset(); });
    document.addEventListener("astro:page-load", scheduleScan);
    document.addEventListener("astro:before-swap", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset, { passive: true });
    hover.addEventListener("change", reset);
    reducedMotion.addEventListener("change", reset);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
