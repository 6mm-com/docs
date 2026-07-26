(function () {
  var nativeLocaleLabels = {
    "": "English",
    ja: "日本語",
    ru: "Русский",
    "es-419": "Español (Latinoamérica)",
    it: "Italiano",
    fr: "Français",
    de: "Deutsch",
    zh: "中文",
    "zh-TW": "繁體中文",
    "pt-BR": "Português (BR)",
    id: "Bahasa Indonesia",
    pl: "Polski",
    vi: "Tiếng Việt",
    uk: "Українська",
    "pt-PT": "Português (Portugal)",
    "es-ES": "Español (España)",
    "es-AR": "Español (Argentina)",
    ar: "العربية",
  };
  var extraLocales = [
    { code: "en-SG", label: "English (Asia)", prefix: "" },
    { code: "uz-UZ", label: "O‘zbek", prefix: "uz" },
    { code: "fil-PH", label: "Filipino", prefix: "fil" },
    { code: "az-AZ", label: "Azərbaycan dili", prefix: "az" },
  ];
  var routePrefixes = Object.keys(nativeLocaleLabels)
    .concat(
      extraLocales.map(function (locale) {
        return locale.prefix;
      }),
    )
    .filter(Boolean);
  var scheduled = false;

  function globeIcon() {
    return (
      '<span class="sixmm-language-trigger-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none">' +
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M3.4 9h17.2M3.4 15h17.2M12 3c2.35 2.45 3.55 5.45 3.55 9S14.35 18.55 12 21M12 3C9.65 5.45 8.45 8.45 8.45 12S9.65 18.55 12 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      "</svg>" +
      "</span>"
    );
  }

  function currentRoute() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var firstSegment = segments[0] || "";
    var prefix = routePrefixes.indexOf(firstSegment) >= 0 ? firstSegment : "";
    if (prefix) segments.shift();

    return {
      prefix: prefix,
      pagePath: "/" + (segments.join("/") || "home"),
    };
  }

  function getVisibleNativeSelector() {
    var selectors = Array.from(
      document.querySelectorAll(".fern-language-selector"),
    );
    return (
      selectors.find(function (element) {
        return element.isConnected && element.offsetParent !== null;
      }) ||
      selectors.find(function (element) {
        return element.isConnected;
      })
    );
  }

  function enhanceTriggers() {
    Array.from(document.querySelectorAll(".fern-language-selector")).forEach(
      function (selector) {
        if (selector.classList.contains("sixmm-language-globe")) return;

        selector.classList.add("sixmm-language-globe");
        selector.setAttribute("aria-label", "Choose language");
        selector.title = "Choose language";
        selector.insertAdjacentHTML("beforeend", globeIcon());
      },
    );
  }

  function extraLocaleHref(locale, pagePath) {
    return (locale.prefix ? "/" + locale.prefix : "") + pagePath;
  }

  function createExtraOption(locale, route) {
    var link = document.createElement("a");
    var isActive = route.prefix === locale.prefix && locale.prefix !== "";
    link.className =
      "[&_svg]:size-icon fern-dropdown-item fern-language-dropdown-item sixmm-extra-language-option";
    link.href = extraLocaleHref(locale, route.pagePath);
    link.lang = locale.code;
    link.dataset.extraLocale = locale.code;
    link.dataset.state = isActive ? "checked" : "unchecked";
    link.setAttribute("role", "menuitemradio");
    link.setAttribute("aria-checked", isActive ? "true" : "false");
    link.textContent = locale.label;
    return link;
  }

  function syncExtraOptions(menu) {
    var route = currentRoute();
    var group = menu.querySelector(".fern-language-selector-radio-group");
    if (!group) return;

    var isStandalone = ["uz", "fil", "az"].indexOf(route.prefix) >= 0;
    if (isStandalone) {
      var englishOption = Array.from(
        group.querySelectorAll('[role="menuitemradio"]'),
      ).find(function (option) {
        return (option.textContent || "").trim() === "English";
      });
      if (englishOption) {
        englishOption.dataset.state = "unchecked";
        englishOption.setAttribute("aria-checked", "false");
      }
    }

    extraLocales.forEach(function (locale) {
      var existing = group.querySelector(
        '[data-extra-locale="' + locale.code + '"]',
      );
      var replacement = createExtraOption(locale, route);
      if (existing) {
        existing.replaceWith(replacement);
      } else {
        group.appendChild(replacement);
      }
    });
  }

  function enhanceMenus() {
    Array.from(
      document.querySelectorAll(".fern-language-dropdown-content"),
    ).forEach(function (menu) {
      if (!menu.classList.contains("sixmm-language-menu-enhanced")) {
        menu.classList.add("sixmm-language-menu-enhanced");
        var heading = document.createElement("div");
        heading.className = "sixmm-native-language-heading";
        heading.textContent = "Choose language";
        menu.insertBefore(heading, menu.firstChild);
      }
      syncExtraOptions(menu);
    });
  }

  function normalizedText(element) {
    return (element.textContent || "").trim().replace(/\s+/g, " ");
  }

  function navigateWithNativeLocale(route, fallbackHref) {
    var label = nativeLocaleLabels[route];
    var selector = getVisibleNativeSelector();
    if (!label || !selector) {
      window.location.assign(fallbackHref);
      return;
    }

    selector.click();
    var attempts = 0;

    function selectLocale() {
      var option = Array.from(
        document.querySelectorAll(
          '.fern-language-dropdown-content [role="menuitemradio"]',
        ),
      ).find(function (element) {
        return normalizedText(element) === label;
      });

      if (option) {
        option.click();
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        window.requestAnimationFrame(selectLocale);
      } else {
        window.location.assign(fallbackHref);
      }
    }

    window.requestAnimationFrame(selectLocale);
  }

  function sync() {
    scheduled = false;
    enhanceTriggers();
    enhanceMenus();
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(sync);
  }

  window.__sixmmNavigateDocsLocale = navigateWithNativeLocale;
  document.addEventListener("DOMContentLoaded", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  window.addEventListener("popstate", scheduleSync);

  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState !== "loading") scheduleSync();
})();
