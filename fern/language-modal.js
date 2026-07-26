(function () {
  var nativeLocaleLabels = {
    "": "English",
    ja: "日本語",
    ru: "Русский",
    "es-419": "Español (Latinoamérica)",
    it: "Italiano",
    fr: "Français",
    de: "Deutsch",
    zh: "简体中文",
    "zh-TW": "繁體中文",
    "pt-BR": "Português (Brasil)",
    id: "Bahasa Indonesia",
    pl: "Polski",
    vi: "Tiếng Việt",
    uk: "Українська",
    "pt-PT": "Português (Internacional)",
    "es-ES": "Español (Internacional)",
    "es-AR": "Español (Argentina)",
    ar: "العربية",
  };
  var extraLocales = [
    { code: "en-SG", label: "English (Asia)", prefix: "" },
    { code: "uz-UZ", label: "O‘zbek", prefix: "uz" },
    { code: "fil-PH", label: "Filipino", prefix: "fil" },
    { code: "az-AZ", label: "Azərbaycan", prefix: "az" },
  ];
  var menuOrder = [
    "native:",
    "extra:en-SG",
    "native:ja",
    "native:ru",
    "native:es-419",
    "native:it",
    "native:fr",
    "native:de",
    "native:zh",
    "native:zh-TW",
    "native:pt-BR",
    "native:id",
    "native:pl",
    "native:vi",
    "native:uk",
    "native:pt-PT",
    "native:es-ES",
    "native:es-AR",
    "extra:uz-UZ",
    "native:ar",
    "extra:fil-PH",
    "extra:az-AZ",
  ];
  var routePrefixes = Object.keys(nativeLocaleLabels)
    .concat(
      extraLocales.map(function (locale) {
        return locale.prefix;
      }),
    )
    .filter(Boolean);
  var standaloneSectionLabels = {
    uz: "O‘zbek",
    fil: "Filipino",
    az: "Azərbaycan dili",
  };
  var scheduled = false;

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

  function syncStandaloneSidebar() {
    var activeStandaloneLabel =
      standaloneSectionLabels[currentRoute().prefix] || "";
    var standaloneLabels = Object.keys(standaloneSectionLabels).map(
      function (route) {
        return standaloneSectionLabels[route];
      },
    );

    Array.from(
      document.querySelectorAll(
        "#fern-sidebar-scroll-area ul.fern-sidebar-group.space-y-6",
      ),
    ).forEach(function (group) {
      Array.from(group.children).forEach(function (section) {
        var heading = section.querySelector(
          ":scope > .fern-sidebar-heading > .fern-sidebar-heading-content",
        );
        var label = heading ? (heading.textContent || "").trim() : "";
        var isStandalone = standaloneLabels.indexOf(label) >= 0;
        var shouldHide = activeStandaloneLabel
          ? label !== activeStandaloneLabel
          : isStandalone;
        section.classList.toggle(
          "sixmm-hidden-sidebar-section",
          shouldHide,
        );
      });
    });
  }

  function enhanceTriggers() {
    Array.from(document.querySelectorAll(".fern-language-selector")).forEach(
      function (selector) {
        if (selector.classList.contains("sixmm-language-globe")) return;

        selector.classList.add("sixmm-language-globe");
        selector.setAttribute("aria-label", "Choose language");
        selector.title = "Choose language";
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
    link.tabIndex = -1;

    var content = document.createElement("div");
    content.className = "flex w-full items-start gap-2";
    var label = document.createElement("div");
    label.className =
      "fern-language-dropdown-item-label sixmm-extra-language-label";
    label.textContent = locale.label;
    content.appendChild(label);
    link.appendChild(content);
    return link;
  }

  function nativePrefixFromOption(option) {
    var pathname = new URL(option.href, window.location.origin).pathname;
    var firstSegment = pathname.split("/").filter(Boolean)[0] || "";
    return Object.prototype.hasOwnProperty.call(
      nativeLocaleLabels,
      firstSegment,
    )
      ? firstSegment
      : "";
  }

  function syncNativeOptions(group) {
    Array.from(group.querySelectorAll('[role="menuitemradio"]')).forEach(
      function (option) {
        if (option.dataset.extraLocale) return;

        var prefix = nativePrefixFromOption(option);
        var label = nativeLocaleLabels[prefix];
        option.dataset.sixmmLocaleKey = "native:" + prefix;

        var labelElement = option.querySelector(
          ".fern-language-dropdown-item-label",
        );
        if (labelElement && labelElement.textContent !== label) {
          labelElement.textContent = label;
        }
      },
    );
  }

  function syncExtraOptions(group, route) {

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
      var option = existing || createExtraOption(locale, route);
      var isActive = route.prefix === locale.prefix && locale.prefix !== "";

      option.href = extraLocaleHref(locale, route.pagePath);
      option.dataset.state = isActive ? "checked" : "unchecked";
      option.dataset.sixmmLocaleKey = "extra:" + locale.code;
      option.setAttribute("aria-checked", isActive ? "true" : "false");

      var label = option.querySelector(".sixmm-extra-language-label");
      if (label && label.textContent !== locale.label) {
        label.textContent = locale.label;
      }

      if (!existing) {
        group.appendChild(option);
      }
    });
  }

  function reorderOptions(group) {
    var options = Array.from(
      group.querySelectorAll('[role="menuitemradio"]'),
    );
    var byKey = {};
    options.forEach(function (option) {
      byKey[option.dataset.sixmmLocaleKey] = option;
    });

    var ordered = menuOrder
      .map(function (key) {
        return byKey[key];
      })
      .filter(Boolean);
    var alreadyOrdered =
      ordered.length === options.length &&
      ordered.every(function (option, index) {
        return options[index] === option;
      });
    if (alreadyOrdered) return;

    ordered.forEach(function (option) {
      group.appendChild(option);
    });
  }

  function syncMenuOptions(menu) {
    var group = menu.querySelector(".fern-language-selector-radio-group");
    if (!group) return;

    var route = currentRoute();
    syncNativeOptions(group);
    syncExtraOptions(group, route);
    syncNativeOptions(group);
    reorderOptions(group);
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
      syncMenuOptions(menu);
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
    syncStandaloneSidebar();
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
