(function () {
  var localeOptions = [
    { code: "en", label: "English", prefix: "" },
    { code: "en-SG", label: "English (Asia)", prefix: "" },
    { code: "ja", label: "日本語", prefix: "ja" },
    { code: "ru", label: "Русский", prefix: "ru" },
    { code: "es-419", label: "Español (Latinoamérica)", prefix: "es-419" },
    { code: "it", label: "Italiano", prefix: "it" },
    { code: "fr", label: "Français", prefix: "fr" },
    { code: "de", label: "Deutsch", prefix: "de" },
    { code: "zh", label: "简体中文", prefix: "zh" },
    { code: "zh-TW", label: "繁體中文", prefix: "zh-TW" },
    { code: "pt-BR", label: "Português (Brasil)", prefix: "pt-BR" },
    { code: "id", label: "Bahasa Indonesia", prefix: "id" },
    { code: "pl", label: "Polski", prefix: "pl" },
    { code: "vi", label: "Tiếng Việt", prefix: "vi" },
    { code: "uk", label: "Українська", prefix: "uk" },
    {
      code: "pt-PT",
      label: "Português (Internacional)",
      prefix: "pt-PT",
    },
    {
      code: "es-ES",
      label: "Español (Internacional)",
      prefix: "es-ES",
    },
    { code: "es-AR", label: "Español (Argentina)", prefix: "es-AR" },
    { code: "uz-UZ", label: "O‘zbek", prefix: "uz" },
    { code: "ar", label: "العربية", prefix: "ar", dir: "rtl" },
    { code: "fil-PH", label: "Filipino", prefix: "fil" },
    { code: "az-AZ", label: "Azərbaycan dili", prefix: "az" },
  ];
  var routePrefixes = localeOptions
    .map(function (locale) {
      return locale.prefix;
    })
    .filter(Boolean);
  var trigger;
  var overlay;
  var dialog;
  var grid;
  var lastFocusedElement;
  var bodyOverflow;
  var mountScheduled = false;

  function globeIcon() {
    return (
      '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none">' +
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M3.4 9h17.2M3.4 15h17.2M12 3c2.35 2.45 3.55 5.45 3.55 9S14.35 18.55 12 21M12 3C9.65 5.45 8.45 8.45 8.45 12S9.65 18.55 12 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      "</svg>"
    );
  }

  function closeIcon() {
    return (
      '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none">' +
      '<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>"
    );
  }

  function currentRoute() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var firstSegment = segments[0] || "";
    var prefix = routePrefixes.indexOf(firstSegment) >= 0 ? firstSegment : "";

    if (prefix) segments.shift();

    return {
      code:
        prefix === "uz"
          ? "uz-UZ"
          : prefix === "fil"
            ? "fil-PH"
            : prefix === "az"
              ? "az-AZ"
              : prefix || "en",
      pagePath: "/" + (segments.join("/") || "home"),
    };
  }

  function localeHref(locale, pagePath) {
    return (locale.prefix ? "/" + locale.prefix : "") + pagePath;
  }

  function syncLinks() {
    if (!grid) return;

    var route = currentRoute();
    Array.from(grid.querySelectorAll(".sixmm-language-option")).forEach(
      function (link) {
        var code = link.dataset.localeCode;
        var locale = localeOptions.find(function (item) {
          return item.code === code;
        });
        var isActive = code === route.code;

        link.href = localeHref(locale, route.pagePath);
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      },
    );
  }

  function createModal() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "sixmm-language-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div id="sixmm-language-dialog" class="sixmm-language-dialog" role="dialog" aria-modal="true" aria-labelledby="sixmm-language-title">' +
      '<div class="sixmm-language-heading">' +
      '<h2 id="sixmm-language-title">Choose language</h2>' +
      '<button class="sixmm-language-close" type="button" aria-label="Close language selector">' +
      closeIcon() +
      "</button>" +
      "</div>" +
      '<div class="sixmm-language-grid"></div>' +
      "</div>";

    document.body.appendChild(overlay);
    dialog = overlay.querySelector(".sixmm-language-dialog");
    grid = overlay.querySelector(".sixmm-language-grid");

    localeOptions.forEach(function (locale) {
      var link = document.createElement("a");
      link.className = "sixmm-language-option";
      link.dataset.localeCode = locale.code;
      link.lang = locale.code;
      link.textContent = locale.label;
      if (locale.dir) link.dir = locale.dir;
      grid.appendChild(link);
    });

    overlay
      .querySelector(".sixmm-language-close")
      .addEventListener("click", closeModal);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeModal();
    });
    grid.addEventListener("click", function (event) {
      if (event.target.closest(".sixmm-language-option")) closeModal(false);
    });
  }

  function openModal() {
    createModal();
    syncLinks();
    lastFocusedElement = document.activeElement;
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlay.hidden = false;
    document.documentElement.classList.add("sixmm-language-modal-open");
    trigger.setAttribute("aria-expanded", "true");

    var activeLink = grid.querySelector(".is-active");
    (activeLink || grid.querySelector("a")).focus();
  }

  function closeModal(restoreFocus) {
    if (!overlay || overlay.hidden) return;

    overlay.hidden = true;
    document.documentElement.classList.remove("sixmm-language-modal-open");
    document.body.style.overflow = bodyOverflow || "";
    if (trigger) trigger.setAttribute("aria-expanded", "false");

    if (restoreFocus !== false && lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  function onKeydown(event) {
    if (!overlay || overlay.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== "Tab") return;

    var focusable = Array.from(
      dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]'),
    ).filter(function (element) {
      return element.offsetParent !== null;
    });
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function createTrigger() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "sixmm-language-trigger";
    button.setAttribute("aria-label", "Choose language");
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "sixmm-language-dialog");
    button.setAttribute("aria-expanded", "false");
    button.title = "Choose language";
    button.innerHTML = globeIcon();
    button.addEventListener("click", openModal);
    return button;
  }

  function mountTrigger() {
    mountScheduled = false;

    var nativeSelector = document.querySelector(".fern-language-selector");
    if (!nativeSelector || !nativeSelector.parentElement) return;

    if (!trigger || !trigger.isConnected) {
      trigger = createTrigger();
      nativeSelector.parentElement.insertBefore(trigger, nativeSelector);
    } else if (trigger.nextElementSibling !== nativeSelector) {
      nativeSelector.parentElement.insertBefore(trigger, nativeSelector);
    }

    document.documentElement.classList.add("sixmm-language-modal-ready");
  }

  function scheduleMount() {
    if (mountScheduled) return;
    mountScheduled = true;
    window.requestAnimationFrame(mountTrigger);
  }

  document.addEventListener("keydown", onKeydown);
  document.addEventListener("DOMContentLoaded", function () {
    createModal();
    scheduleMount();
  });
  window.addEventListener("pageshow", scheduleMount);
  window.addEventListener("popstate", function () {
    syncLinks();
    closeModal(false);
    scheduleMount();
  });

  new MutationObserver(scheduleMount).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState !== "loading") {
    createModal();
    scheduleMount();
  }
})();
