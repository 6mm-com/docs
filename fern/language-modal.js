(function () {
  var locales = [
    { code: "", label: "English", htmlLang: "en", widget: "en", aliases: ["en", "en-us", "en-gb", "en-asia", "en-sg"] },
    { code: "ja", label: "日本語", widget: "ja", aliases: ["ja", "ja-jp"] },
    { code: "ru", label: "Русский", widget: "ru", aliases: ["ru", "ru-ru"] },
    { code: "es-419", label: "Español (Latinoamérica)", widget: "es-419", aliases: ["es-419", "es-ar"] },
    { code: "it", label: "Italiano", widget: "it", aliases: ["it", "it-it"] },
    { code: "fr", label: "Français", widget: "fr", aliases: ["fr", "fr-fr"] },
    { code: "de", label: "Deutsch", widget: "de", aliases: ["de", "de-de"] },
    { code: "zh-CN", label: "简体中文", widget: "zh-CN", aliases: ["zh", "zh-cn", "zh-hans"] },
    { code: "zh-TW", label: "繁體中文", widget: "zh-TW", aliases: ["zh-tw", "zh-hant"] },
    { code: "pt-BR", label: "Português (Brasil)", widget: "pt-BR", aliases: ["pt-br"] },
    { code: "id", label: "Bahasa Indonesia", widget: "id", aliases: ["id", "id-id"] },
    { code: "pl", label: "Polski", widget: "pl", aliases: ["pl", "pl-pl"] },
    { code: "vi", label: "Tiếng Việt", widget: "vi", aliases: ["vi", "vi-vn"] },
    { code: "uk", label: "Українська", widget: "uk", aliases: ["uk", "uk-ua"] },
    { code: "pt-PT", label: "Português (Internacional)", widget: "pt", aliases: ["pt", "pt-pt"] },
    { code: "es-ES", label: "Español (Internacional)", widget: "es", aliases: ["es", "es-es"] },
    { code: "uz", label: "O‘zbek", widget: "uz", aliases: ["uz", "uz-uz"] },
    { code: "ar", label: "العربية", widget: "ar", aliases: ["ar", "ar-sa"] },
    { code: "fil", label: "Filipino", widget: "fil", aliases: ["fil", "fil-ph"] },
    { code: "az", label: "Azərbaycan", widget: "az", aliases: ["az", "az-az"] },
  ];
  var localeLabels = {};
  locales.forEach(function (locale) {
    localeLabels[locale.code] = locale.label;
  });
  var localeOrder = locales.map(function (locale) {
    return locale.code;
  });
  var standaloneLocaleCodes = ["uz", "fil", "az"];
  var standaloneSectionLabels = {
    uz: "O‘zbek",
    fil: "Filipino",
    az: "Azərbaycan",
  };
  window.__sixmmDocsLocales = locales;
  var scheduled = false;
  var localeNavigationId = 0;
  var themeNavigationId = 0;
  var nativeLocaleClick = null;
  var localeNavigationTimeout = 10000;

  function normalizedText(element) {
    return (element && element.textContent ? element.textContent : "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function isStandaloneLocale(locale) {
    return standaloneLocaleCodes.indexOf(locale) >= 0;
  }

  function currentRoute() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var firstSegment = segments[0] || "";
    var locale = Object.prototype.hasOwnProperty.call(
      localeLabels,
      firstSegment,
    )
      ? firstSegment
      : "";
    if (locale) segments.shift();
    return {
      locale: locale,
      pagePath: "/" + (segments.join("/") || "home"),
    };
  }

  function localizedPath(locale, pagePath) {
    return (locale ? "/" + locale : "") + pagePath;
  }

  function linkPathname(link) {
    return new URL(link.href, window.location.origin).pathname;
  }

  function localeFromHref(option) {
    var pathname = linkPathname(option);
    var firstSegment = pathname.split("/").filter(Boolean)[0] || "";
    return Object.prototype.hasOwnProperty.call(localeLabels, firstSegment)
      ? firstSegment
      : "";
  }

  function nativeOptionLocale(option) {
    var existing = option.dataset.sixmmLocale;
    if (existing !== undefined && !isStandaloneLocale(existing)) {
      return existing;
    }

    var label = normalizedText(
      option.querySelector(".fern-language-dropdown-item-label") || option,
    );
    var byLabel = locales.find(function (locale) {
      return !isStandaloneLocale(locale.code) && locale.label === label;
    });
    return byLabel ? byLabel.code : localeFromHref(option);
  }

  function enhanceTriggers() {
    Array.from(document.querySelectorAll(".fern-language-selector")).forEach(
      function (selector) {
        selector.classList.add("sixmm-language-globe");
        selector.setAttribute("aria-label", "Choose language");
        selector.removeAttribute("title");

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
        themeButton.setAttribute(
          "aria-label",
          (themeButton.textContent || "").trim() || "Theme",
        );
        themeButton.removeAttribute("title");
      },
    );
  }

  function syncMenu(menu) {
    var group = menu.querySelector(".fern-language-selector-radio-group");
    if (!group) return;

    var route = currentRoute();
    var options = Array.from(
      group.querySelectorAll('[role="menuitemradio"]'),
    );
    var byLocale = {};

    options.forEach(function (option) {
      if (option.dataset.sixmmStandaloneLocale) return;
      var locale = nativeOptionLocale(option);
      option.dataset.sixmmLocale = locale;
      byLocale[locale] = option;
      option.href = localizedPath(locale, route.pagePath);
      option.dataset.state = route.locale === locale ? "checked" : "unchecked";
      option.setAttribute(
        "aria-checked",
        route.locale === locale ? "true" : "false",
      );

      var label = option.querySelector(".fern-language-dropdown-item-label");
      if (label && label.textContent !== localeLabels[locale]) {
        label.textContent = localeLabels[locale];
      }
    });

    standaloneLocaleCodes.forEach(function (locale) {
      var option = group.querySelector(
        '[data-sixmm-standalone-locale="' + locale + '"]',
      );
      if (!option) {
        option = document.createElement("a");
        option.className =
          "[&_svg]:size-icon fern-dropdown-item fern-language-dropdown-item sixmm-extra-language-option";
        option.dataset.sixmmStandaloneLocale = locale;
        option.dataset.sixmmLocale = locale;
        option.setAttribute("role", "menuitemradio");
        option.tabIndex = -1;

        var content = document.createElement("div");
        content.className = "flex w-full items-start gap-2";
        var label = document.createElement("div");
        label.className =
          "fern-language-dropdown-item-label sixmm-extra-language-label";
        label.textContent = localeLabels[locale];
        content.appendChild(label);
        option.appendChild(content);
        group.appendChild(option);
      }

      option.href = localizedPath(locale, route.pagePath);
      option.dataset.state = route.locale === locale ? "checked" : "unchecked";
      option.setAttribute(
        "aria-checked",
        route.locale === locale ? "true" : "false",
      );
      byLocale[locale] = option;
    });

    options = Array.from(group.querySelectorAll('[role="menuitemradio"]'));
    var ordered = localeOrder
      .map(function (locale) {
        return byLocale[locale];
      })
      .filter(Boolean);
    var alreadyOrdered =
      ordered.length === options.length &&
      ordered.every(function (option, index) {
        return option === options[index];
      });
    if (!alreadyOrdered) {
      ordered.forEach(function (option) {
        group.appendChild(option);
      });
    }
  }

  function guardLocaleMenu(menu) {
    if (menu.dataset.sixmmLocaleGuard === "true") return;
    menu.dataset.sixmmLocaleGuard = "true";
    menu.addEventListener(
      "click",
      function (event) {
        var option =
          event.target && event.target.closest
            ? event.target.closest('[role="menuitemradio"]')
            : null;
        if (!option || option === nativeLocaleClick) return;
        var locale = option.dataset.sixmmLocale;
        if (locale === undefined) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        navigateDocsLocale(locale);
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
      guardLocaleMenu(menu);
      syncMenu(menu);
    });
  }

  function visibleSelector() {
    var selectors = Array.from(
      document.querySelectorAll(".fern-language-selector"),
    );
    return selectors.find(isVisible);
  }

  function visibleThemeTrigger() {
    var triggers = Array.from(
      document.querySelectorAll(
        ".sixmm-theme-trigger, .fern-language-selector + button",
      ),
    );
    return triggers.find(function (trigger) {
      return (
        isVisible(trigger) &&
        Boolean(
          trigger.querySelector(
            "svg.lucide-sun, svg.lucide-moon, svg.lucide-monitor",
          ),
        )
      );
    });
  }

  function isVisible(element) {
    return Boolean(
      element &&
        element.isConnected &&
        (element.offsetParent !== null ||
          (typeof element.getClientRects === "function" &&
            element.getClientRects().length > 0)),
    );
  }

  function controlledMenu(trigger) {
    var menuId = trigger && trigger.getAttribute("aria-controls");
    if (menuId) {
      var controlled = document.getElementById(menuId);
      if (controlled && isVisible(controlled)) return controlled;
    }
    return Array.from(
      document.querySelectorAll(
        '.fern-language-dropdown-content, [role="menu"][data-state="open"]',
      ),
    ).find(isVisible);
  }

  function waitFor(resolveValue, timeout) {
    return new Promise(function (resolve) {
      var finished = false;
      var observer = new MutationObserver(check);
      var timer = window.setTimeout(function () {
        finish(null);
      }, timeout);

      function finish(value) {
        if (finished) return;
        finished = true;
        observer.disconnect();
        window.clearTimeout(timer);
        resolve(value);
      }

      function check() {
        var value = resolveValue();
        if (value) finish(value);
      }

      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      check();
    });
  }

  function notifyLocaleNavigation(type, detail) {
    if (
      typeof window.dispatchEvent !== "function" ||
      typeof window.CustomEvent !== "function"
    ) {
      return;
    }
    window.dispatchEvent(
      new window.CustomEvent("sixmm-docs-locale-navigation-" + type, {
        detail: detail,
      }),
    );
  }

  function tabLabelForPage(pagePath) {
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
    var activeLabel = standaloneSectionLabels[route.locale] || "";
    document.documentElement.classList.toggle(
      "sixmm-standalone-locale",
      Boolean(activeLabel),
    );
    document.documentElement.classList.toggle(
      "sixmm-standalone-home",
      Boolean(activeLabel) && route.pagePath === "/home",
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
        var label = normalizedText(heading);
        var isStandalone = Object.values(standaloneSectionLabels).includes(
          label,
        );
        section.classList.toggle(
          "sixmm-hidden-sidebar-section",
          activeLabel ? label !== activeLabel : isStandalone,
        );
      });
    });

    if (!activeLabel) return;
    var activeTabLabel = tabLabelForPage(route.pagePath);
    Array.from(document.querySelectorAll('[role="tab"]')).forEach(
      function (tab) {
        var isActive = normalizedText(tab) === activeTabLabel;
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.dataset.state = isActive ? "active" : "inactive";
        tab.tabIndex = isActive ? 0 : -1;
      },
    );
  }

  function currentDocumentTheme() {
    var root = document.documentElement;
    if (root.classList.contains("dark")) return "dark";
    if (root.classList.contains("light")) return "light";
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function themeAppearanceMatches(theme) {
    var trigger = visibleThemeTrigger();
    var iconSelector =
      theme === "dark" ? "svg.lucide-moon" : "svg.lucide-sun";
    return Boolean(
      currentDocumentTheme() === theme &&
        trigger &&
        trigger.querySelector(iconSelector),
    );
  }

  function waitForLocaleOption(trigger, locale) {
    return waitFor(function () {
      enhanceMenus();
      var menu = controlledMenu(trigger);
      if (!menu) return null;
      return menu.querySelector(
        '[role="menuitemradio"][data-sixmm-locale="' + locale + '"]',
      );
    }, localeNavigationTimeout);
  }

  function waitForThemeOption(trigger, theme) {
    return waitFor(function () {
      var menu = controlledMenu(trigger);
      if (!menu) return null;
      var iconSelector =
        theme === "dark" ? "svg.lucide-moon" : "svg.lucide-sun";
      return Array.from(
        menu.querySelectorAll(
          '[role="menuitemradio"], [role="menuitem"], button',
        ),
      ).find(function (candidate) {
        var label = (candidate.textContent || "").trim().toLowerCase();
        return label === theme || Boolean(candidate.querySelector(iconSelector));
      });
    }, 4000);
  }

  function fernLinkForPath(pathname) {
    return Array.from(
      document.querySelectorAll(
        '#fern-sidebar-scroll-area a[href], a[role="tab"][href]',
      ),
    ).find(function (link) {
      return link.isConnected && linkPathname(link) === pathname;
    });
  }

  async function clickFernLink(link, pathname, navigationId) {
    if (!link || navigationId !== localeNavigationId) return false;
    link.click();
    var changed = await waitFor(function () {
      return window.location.pathname === pathname ? true : null;
    }, localeNavigationTimeout);
    return navigationId === localeNavigationId && Boolean(changed);
  }

  function tabLandingPath(pagePath) {
    if (pagePath === "/home") return "/home";
    if (pagePath.indexOf("/solutions/") === 0) {
      return "/solutions/overview";
    }
    if (
      pagePath.indexOf("/trading/") === 0 ||
      pagePath.indexOf("/getting-started/") === 0
    ) {
      return "/trading/overview";
    }
    if (pagePath.indexOf("/developer-api/") === 0) {
      return "/developer-api/overview";
    }
    if (pagePath.indexOf("/sdk/") === 0) return "/sdk/overview";
    if (
      pagePath.indexOf("/security/") === 0 ||
      pagePath.indexOf("/security-compliance/") === 0 ||
      pagePath.indexOf("/legal/") === 0
    ) {
      return "/security-compliance/overview";
    }
    return "/resources/overview";
  }

  async function navigateNativeLocale(locale, navigationId) {
    var route = currentRoute();
    var targetPath = localizedPath(locale, route.pagePath);
    if (window.location.pathname === targetPath) return true;

    for (var attempt = 0; attempt < 2; attempt += 1) {
      var selector = await waitFor(visibleSelector, localeNavigationTimeout);
      if (navigationId !== localeNavigationId) return false;
      if (!selector) return false;
      if (
        selector.getAttribute("aria-expanded") !== "true" &&
        selector.dataset.state !== "open"
      ) {
        selector.click();
      }

      var option = await waitForLocaleOption(selector, locale);
      if (navigationId !== localeNavigationId) return false;
      if (!option) continue;
      nativeLocaleClick = option;
      try {
        option.click();
      } finally {
        nativeLocaleClick = null;
      }
      var changed = await waitFor(function () {
        return window.location.pathname === targetPath ? true : null;
      }, localeNavigationTimeout);
      if (navigationId !== localeNavigationId) return false;
      if (changed) return true;
    }
    return false;
  }

  async function navigateToBasePage(pagePath, navigationId) {
    if (window.location.pathname === pagePath) return true;

    var direct = fernLinkForPath(pagePath);
    if (direct && (await clickFernLink(direct, pagePath, navigationId))) {
      return true;
    }

    var landingPath = tabLandingPath(pagePath);
    var tab = await waitFor(function () {
      return fernLinkForPath(landingPath);
    }, localeNavigationTimeout);
    if (!tab) return false;
    if (
      window.location.pathname !== landingPath &&
      !(await clickFernLink(tab, landingPath, navigationId))
    ) {
      return false;
    }
    if (pagePath === landingPath) return true;

    var pageLink = await waitFor(function () {
      return fernLinkForPath(pagePath);
    }, localeNavigationTimeout);
    return clickFernLink(pageLink, pagePath, navigationId);
  }

  async function navigateStandaloneLocale(locale, pagePath, navigationId) {
    var targetPath = localizedPath(locale, pagePath);
    if (window.location.pathname === targetPath) return true;

    var direct = fernLinkForPath(targetPath);
    if (direct && (await clickFernLink(direct, targetPath, navigationId))) {
      return true;
    }

    var route = currentRoute();
    if (!isStandaloneLocale(route.locale) && route.locale) {
      if (!(await navigateNativeLocale("", navigationId))) return false;
    }
    if (navigationId !== localeNavigationId) return false;

    direct = fernLinkForPath(targetPath);
    if (direct && (await clickFernLink(direct, targetPath, navigationId))) {
      return true;
    }

    var resourcesPath = "/resources/overview";
    if (window.location.pathname !== resourcesPath) {
      var resourcesTab = await waitFor(function () {
        return fernLinkForPath(resourcesPath);
      }, localeNavigationTimeout);
      if (
        !resourcesTab ||
        !(await clickFernLink(resourcesTab, resourcesPath, navigationId))
      ) {
        return false;
      }
    }

    var targetLink = await waitFor(function () {
      return fernLinkForPath(targetPath);
    }, localeNavigationTimeout);
    return clickFernLink(targetLink, targetPath, navigationId);
  }

  async function navigateDocsLocale(locale) {
    if (!Object.prototype.hasOwnProperty.call(localeLabels, locale)) {
      return false;
    }

    var navigationId = ++localeNavigationId;
    var route = currentRoute();
    var success = false;
    notifyLocaleNavigation("start", {
      id: navigationId,
      locale: locale,
    });

    try {
      if (route.locale === locale) {
        success = true;
        return true;
      }
      if (isStandaloneLocale(locale)) {
        success = await navigateStandaloneLocale(
          locale,
          route.pagePath,
          navigationId,
        );
        return success;
      }
      if (isStandaloneLocale(route.locale)) {
        if (!(await navigateToBasePage(route.pagePath, navigationId))) {
          return false;
        }
      }
      success = await navigateNativeLocale(locale, navigationId);
      return success;
    } finally {
      notifyLocaleNavigation("settled", {
        id: navigationId,
        locale: locale,
        success: success,
      });
    }
  }

  async function navigateDocsTheme(theme) {
    if (theme !== "light" && theme !== "dark") return false;

    var navigationId = ++themeNavigationId;
    for (var attempt = 0; attempt < 2; attempt += 1) {
      var trigger = await waitFor(visibleThemeTrigger, 4000);
      if (navigationId !== themeNavigationId) return false;
      if (!trigger) return false;
      if (
        trigger.getAttribute("aria-expanded") !== "true" &&
        trigger.dataset.state !== "open"
      ) {
        trigger.click();
      }

      var option = await waitForThemeOption(trigger, theme);
      if (navigationId !== themeNavigationId) return false;
      if (!option) continue;
      option.click();
      var changed = await waitFor(function () {
        return themeAppearanceMatches(theme) ? true : null;
      }, 4000);
      if (navigationId !== themeNavigationId) return false;
      if (changed) return true;
    }
    return false;
  }

  function sync() {
    scheduled = false;
    enhanceTriggers();
    enhanceMenus();
    syncStandaloneLayout();
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(sync);
  }

  window.__sixmmNavigateDocsLocale = navigateDocsLocale;
  window.__sixmmNavigateDocsTheme = navigateDocsTheme;
  document.addEventListener("DOMContentLoaded", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  window.addEventListener("popstate", scheduleSync);
  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState !== "loading") scheduleSync();
})();
