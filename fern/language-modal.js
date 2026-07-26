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
    { code: "pt", label: "Português (Internacional)", widget: "pt", aliases: ["pt", "pt-pt"] },
    { code: "es", label: "Español (Internacional)", widget: "es", aliases: ["es", "es-es"] },
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
  window.__sixmmDocsLocales = locales;
  var scheduled = false;
  var localeNavigationId = 0;
  var themeNavigationId = 0;

  function optionLocale(option) {
    var pathname = new URL(option.href, window.location.origin).pathname;
    var firstSegment = pathname.split("/").filter(Boolean)[0] || "";
    return Object.prototype.hasOwnProperty.call(localeLabels, firstSegment)
      ? firstSegment
      : "";
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

    var options = Array.from(
      group.querySelectorAll('[role="menuitemradio"]'),
    );
    var byLocale = {};

    options.forEach(function (option) {
      var locale = optionLocale(option);
      option.dataset.sixmmLocale = locale;
      byLocale[locale] = option;

      var label = option.querySelector(".fern-language-dropdown-item-label");
      if (label && label.textContent !== localeLabels[locale]) {
        label.textContent = localeLabels[locale];
      }
    });

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

  function currentPathLocale() {
    var firstSegment =
      window.location.pathname.split("/").filter(Boolean)[0] || "";
    return Object.prototype.hasOwnProperty.call(localeLabels, firstSegment)
      ? firstSegment
      : "";
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
      return Array.from(
        menu.querySelectorAll('[role="menuitemradio"], a[href]'),
      ).find(function (candidate) {
        var link =
          candidate.matches && candidate.matches("a[href]")
            ? candidate
            : candidate.querySelector("a[href]");
        return link && optionLocale(link) === locale ? link : false;
      });
    }, 4000);
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

  async function navigateDocsLocale(locale) {
    if (!Object.prototype.hasOwnProperty.call(localeLabels, locale)) {
      return false;
    }
    if (currentPathLocale() === locale) return true;

    var navigationId = ++localeNavigationId;
    for (var attempt = 0; attempt < 2; attempt += 1) {
      var selector = await waitFor(visibleSelector, 4000);
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
      option.click();
      var changed = await waitFor(function () {
        return currentPathLocale() === locale ? true : null;
      }, 4000);
      if (navigationId !== localeNavigationId) return false;
      if (changed) return true;
    }
    return false;
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
