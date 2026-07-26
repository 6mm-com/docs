(function () {
  var nativeLocaleLabels = {
    "": "English",
    ja: "日本語",
    ru: "Русский",
    it: "Italiano",
    fr: "Français",
    de: "Deutsch",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    id: "Bahasa Indonesia",
    pl: "Polski",
    vi: "Tiếng Việt",
    uk: "Українська",
    ar: "العربية",
  };
  var extraLocales = [
    {
      code: "en-Asia",
      htmlLang: "en-SG",
      label: "English (Asia)",
      prefix: "en-Asia",
    },
    { code: "es-419", label: "Español (Latinoamérica)", prefix: "es-419" },
    { code: "pt-BR", label: "Português (Brasil)", prefix: "pt-BR" },
    { code: "pt", label: "Português (Internacional)", prefix: "pt" },
    { code: "es", label: "Español (Internacional)", prefix: "es" },
    { code: "es-AR", label: "Español (Argentina)", prefix: "es-AR" },
    { code: "uz", label: "O‘zbek", prefix: "uz" },
    { code: "fil", label: "Filipino", prefix: "fil" },
    { code: "az", label: "Azərbaycan", prefix: "az" },
  ];
  var menuOrder = [
    "native:",
    "extra:en-Asia",
    "native:ja",
    "native:ru",
    "extra:es-419",
    "native:it",
    "native:fr",
    "native:de",
    "native:zh-CN",
    "native:zh-TW",
    "extra:pt-BR",
    "native:id",
    "native:pl",
    "native:vi",
    "native:uk",
    "extra:pt",
    "extra:es",
    "extra:es-AR",
    "extra:uz",
    "native:ar",
    "extra:fil",
    "extra:az",
  ];
  var routePrefixes = Object.keys(nativeLocaleLabels)
    .concat(
      extraLocales.map(function (locale) {
        return locale.prefix;
      }),
    )
    .filter(Boolean);
  var standaloneSectionLabels = {
    "en-Asia": "English (Asia)",
    "es-419": "Español (Latinoamérica)",
    "pt-BR": "Português (Brasil)",
    pt: "Português (Internacional)",
    es: "Español (Internacional)",
    "es-AR": "Español (Argentina)",
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

  function standaloneTabLabel(pagePath) {
    if (pagePath === "/home") return "Home";
    if (pagePath.indexOf("/solutions/") === 0) return "Solutions";
    if (
      pagePath.indexOf("/trading/") === 0 ||
      pagePath.indexOf("/getting-started/") === 0
    ) {
      return "Trading";
    }
    if (pagePath.indexOf("/developer-api/") === 0) return "Developers";
    if (pagePath.indexOf("/sdk/") === 0) return "SDKs";
    if (
      pagePath.indexOf("/security/") === 0 ||
      pagePath.indexOf("/security-compliance/") === 0 ||
      pagePath.indexOf("/legal/") === 0
    ) {
      return "Security & Compliance";
    }
    return "Resources & Support";
  }

  function syncStandaloneLayout() {
    var route = currentRoute();
    var isStandalone = Object.prototype.hasOwnProperty.call(
      standaloneSectionLabels,
      route.prefix,
    );
    document.documentElement.classList.toggle(
      "sixmm-standalone-locale",
      isStandalone,
    );
    document.documentElement.classList.toggle(
      "sixmm-standalone-home",
      isStandalone && route.pagePath === "/home",
    );
    if (!isStandalone) return;

    var activeLabel = standaloneTabLabel(route.pagePath);
    Array.from(document.querySelectorAll('[role="tab"]')).forEach(
      function (tab) {
        var tabLabel = (tab.innerText || tab.textContent || "")
          .trim()
          .replace(/\s+/g, " ");
        var isActive = tabLabel === activeLabel;
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.dataset.state = isActive ? "active" : "inactive";
        tab.tabIndex = isActive ? 0 : -1;
      },
    );
  }

  function enhanceTriggers() {
    Array.from(document.querySelectorAll(".fern-language-selector")).forEach(
      function (selector) {
        if (selector.classList.contains("sixmm-language-globe")) return;

        selector.classList.add("sixmm-language-globe");
        selector.setAttribute("aria-label", "Choose language");
        selector.removeAttribute("title");
      },
    );
  }

  function enhanceMobileSettingsBars() {
    Array.from(document.querySelectorAll(".fern-language-selector")).forEach(
      function (selector) {
        var parent = selector.parentElement;
        var themeButton = selector.nextElementSibling;
        if (
          !parent ||
          !themeButton ||
          themeButton.tagName !== "BUTTON" ||
          !themeButton.querySelector(
            "svg.lucide-sun, svg.lucide-moon, svg.lucide-monitor",
          )
        ) {
          return;
        }

        themeButton.classList.add("sixmm-theme-trigger");
        if (parent.tagName === "DIV") {
          parent.classList.add("sixmm-mobile-settings-bar");
          themeButton.classList.add("sixmm-mobile-theme-trigger");
        }

        var themeLabel = (themeButton.textContent || "").trim() || "Theme";
        themeButton.setAttribute("aria-label", themeLabel);
        themeButton.removeAttribute("title");
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
    link.lang = locale.htmlLang || locale.code;
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

  function localizedHref(prefix, pagePath) {
    return (prefix ? "/" + prefix : "") + pagePath;
  }

  function syncNativeOptions(group, route) {
    Array.from(group.querySelectorAll('[role="menuitemradio"]')).forEach(
      function (option) {
        if (option.dataset.extraLocale) return;

        var prefix = nativePrefixFromOption(option);
        var label = nativeLocaleLabels[prefix];
        option.dataset.sixmmLocaleKey = "native:" + prefix;
        option.href = localizedHref(prefix, route.pagePath);

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
    var isStandalone =
      ["en-Asia", "es-419", "pt-BR", "pt", "es", "es-AR", "uz", "fil", "az"].indexOf(route.prefix) >= 0;
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
    syncNativeOptions(group, route);
    syncExtraOptions(group, route);
    syncNativeOptions(group, route);
    reorderOptions(group);
  }

  function guardLocaleNavigation(menu) {
    if (menu.dataset.sixmmRouteGuard === "true") return;
    menu.dataset.sixmmRouteGuard = "true";
    menu.addEventListener(
      "click",
      function (event) {
        var option =
          event.target && event.target.closest
            ? event.target.closest('[role="menuitemradio"]')
            : null;
        if (!option) return;

        var route = currentRoute();
        var isStandalone =
          [
            "en-Asia",
            "es-419",
            "pt-BR",
            "pt",
            "es",
            "es-AR",
            "uz",
            "fil",
            "az",
          ].indexOf(route.prefix) >= 0;
        if (!option.dataset.extraLocale && !isStandalone) return;

        var href = option.getAttribute("href");
        if (!href) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.location.assign(href);
      },
      true,
    );
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
      guardLocaleNavigation(menu);
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
    enhanceMobileSettingsBars();
    enhanceMenus();
    syncStandaloneSidebar();
    syncStandaloneLayout();
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
