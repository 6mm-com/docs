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
  var localeOrder = locales.map(function (locale) {
    localeLabels[locale.code] = locale.label;
    return locale.code;
  });
  var localeNavigationId = 0;
  var themeNavigationId = 0;
  var syncScheduled = false;

  window.__sixmmDocsLocales = locales;

  function isVisible(element) {
    return Boolean(
      element &&
        element.isConnected &&
        (element.offsetParent !== null ||
          (typeof element.getClientRects === "function" &&
            element.getClientRects().length > 0)),
    );
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

  function localeForPathname(pathname) {
    var firstSegment = pathname.split("/").filter(Boolean)[0] || "";
    var normalized = firstSegment.toLowerCase();
    var locale = locales.find(function (item) {
      return item.code && item.code.toLowerCase() === normalized;
    });
    return locale ? locale.code : "";
  }

  function currentDocsLocale() {
    return localeForPathname(window.location.pathname);
  }

  function currentRoute() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var locale = localeForPathname(window.location.pathname);
    if (locale) segments.shift();
    return {
      locale: locale,
      pagePath: "/" + (segments.join("/") || "home"),
    };
  }

  function localizedPath(locale, pagePath) {
    return (locale ? "/" + locale : "") + pagePath;
  }

  function localeForOption(option) {
    if (option.dataset.sixmmLocale !== undefined) {
      return option.dataset.sixmmLocale;
    }

    var labelElement = option.querySelector(
      ".fern-language-dropdown-item-label",
    );
    var label = (labelElement ? labelElement.textContent : option.textContent)
      .trim()
      .replace(/\s+/g, " ");
    var byLabel = locales.find(function (locale) {
      return locale.label === label;
    });
    if (byLabel) return byLabel.code;

    if (!option.href) return null;
    var pathname = new URL(option.href, window.location.origin).pathname;
    var pathnameLocale = localeForPathname(pathname);
    if (pathnameLocale) return pathnameLocale;

    return label === localeLabels[""] ? "" : null;
  }

  function syncLocaleMenu(menu) {
    var group = menu.querySelector(".fern-language-selector-radio-group");
    if (!group) return;

    var route = currentRoute();
    var byLocale = {};
    Array.from(group.querySelectorAll('[role="menuitemradio"]')).forEach(
      function (option) {
        var locale = localeForOption(option);
        if (locale === null) return;

        option.dataset.sixmmLocale = locale;
        option.href = localizedPath(locale, route.pagePath);
        option.dataset.state = route.locale === locale ? "checked" : "unchecked";
        option.setAttribute(
          "aria-checked",
          route.locale === locale ? "true" : "false",
        );

        var label = option.querySelector(
          ".fern-language-dropdown-item-label",
        );
        if (label && label.textContent !== localeLabels[locale]) {
          label.textContent = localeLabels[locale];
        }
        byLocale[locale] = option;
      },
    );

    var options = Array.from(
      group.querySelectorAll('[role="menuitemradio"]'),
    );
    var ordered = localeOrder
      .map(function (locale) {
        return byLocale[locale];
      })
      .filter(Boolean);
    options.forEach(function (option) {
      if (ordered.indexOf(option) < 0) ordered.push(option);
    });
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
            ? event.target.closest('[role="menuitemradio"][data-sixmm-locale]')
            : null;
        if (
          !option ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        menu.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
        navigateDocsLocale(option.dataset.sixmmLocale);
      },
      true,
    );
  }

  function enhanceLocaleMenus() {
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
      syncLocaleMenu(menu);
    });
  }

  function enhanceSettingsControls() {
    var route = currentRoute();
    var currentLabel = localeLabels[route.locale] || localeLabels[""];
    Array.from(document.querySelectorAll(".fern-language-selector")).forEach(
      function (selector) {
        selector.setAttribute("aria-label", "Choose language");
        selector.removeAttribute("title");
        var visibleLabel = selector.querySelector(
          ".language-dropdown-trigger .truncate",
        );
        if (visibleLabel && visibleLabel.textContent !== currentLabel) {
          visibleLabel.textContent = currentLabel;
        }

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
        if (
          parent.tagName === "DIV" &&
          parent.classList.contains("lg:hidden")
        ) {
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

  function syncLocaleTabs() {
    var route = currentRoute();
    document.documentElement.dataset.sixmmDocsLocale =
      route.locale || "en";
  }

  function looksLikeNextRouter(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        typeof value.push === "function" &&
        typeof value.replace === "function" &&
        typeof value.prefetch === "function",
    );
  }

  function fernRouter() {
    var links = document.querySelectorAll("a[href]");
    for (var linkIndex = 0; linkIndex < links.length; linkIndex += 1) {
      var link = links[linkIndex];
      var fiberKey = Object.getOwnPropertyNames(link).find(function (key) {
        return key.indexOf("__reactFiber$") === 0;
      });
      var fiber = fiberKey ? link[fiberKey] : null;
      var depth = 0;

      while (fiber && depth < 64) {
        var context = fiber.dependencies
          ? fiber.dependencies.firstContext
          : null;
        while (context) {
          if (looksLikeNextRouter(context.memoizedValue)) {
            return context.memoizedValue;
          }
          context = context.next;
        }
        fiber = fiber.return;
        depth += 1;
      }
    }
    return null;
  }

  function pageContentState() {
    if (typeof document.querySelector !== "function") {
      return { article: null, text: "" };
    }
    var article = document.querySelector("main article");
    return {
      article: article,
      text: article ? article.textContent : "",
    };
  }

  function pageContentChanged(previous) {
    var next = pageContentState();
    return (
      !previous.article ||
      next.article !== previous.article ||
      next.text !== previous.text
    );
  }

  async function replaceFernRoute(router, targetUrl, navigationId) {
    var pathname = new URL(targetUrl, window.location.origin).pathname;
    if (
      window.location.pathname +
        window.location.search +
        window.location.hash ===
      targetUrl
    ) {
      return true;
    }
    var previousContent = pageContentState();
    router.replace(targetUrl, { scroll: false });
    var changed = await waitFor(function () {
      if (window.location.pathname !== pathname) return null;
      return pageContentChanged(previousContent) ? true : null;
    }, 15000);
    return navigationId === localeNavigationId && Boolean(changed);
  }

  async function navigateDocsLocale(locale) {
    if (
      !locales.some(function (item) {
        return item.code === locale;
      })
    ) {
      return false;
    }
    if (currentDocsLocale() === locale) return true;

    var navigationId = ++localeNavigationId;
    var route = currentRoute();
    var targetPath = localizedPath(locale, route.pagePath);
    var targetUrl =
      targetPath + window.location.search + window.location.hash;

    // Fern does not expose a public locale API. Read the Next.js router already
    // attached to Fern's mounted links and navigate directly without opening
    // the language menu or reloading the support widget.
    var router = await waitFor(fernRouter, 2500);
    if (!router || navigationId !== localeNavigationId) return false;

    if (typeof router.prefetch === "function") router.prefetch(targetPath);
    return replaceFernRoute(router, targetUrl, navigationId);
  }

  function currentTheme() {
    var root = document.documentElement;
    if (root.classList.contains("dark")) return "dark";
    if (root.classList.contains("light")) return "light";
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  async function navigateDocsTheme(theme) {
    if (theme !== "light" && theme !== "dark") return false;
    if (currentTheme() === theme) return true;

    var navigationId = ++themeNavigationId;
    var previousTheme;
    try {
      previousTheme = window.localStorage.getItem("theme");
      window.localStorage.setItem("theme", theme);
      // Fern uses next-themes with its default "theme" storage key. Its
      // Provider listens for this cross-context event and applies the theme
      // through React state, independent of responsive menus or DOM controls.
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "theme",
          oldValue: previousTheme,
          newValue: theme,
          url: window.location.href,
        }),
      );
    } catch (error) {
      return false;
    }

    var changed = await waitFor(function () {
      return currentTheme() === theme ? true : null;
    }, 2500);
    return navigationId === themeNavigationId && Boolean(changed);
  }

  window.__sixmmNavigateDocsLocale = navigateDocsLocale;
  window.__sixmmNavigateDocsTheme = navigateDocsTheme;

  function syncInterface() {
    syncScheduled = false;
    enhanceSettingsControls();
    enhanceLocaleMenus();
    syncLocaleTabs();
  }

  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    window.requestAnimationFrame(syncInterface);
  }

  // This script loads before interactive content. Set the pathname-derived
  // locale immediately so standalone navigation tabs never flash on first paint.
  syncLocaleTabs();
  document.addEventListener("DOMContentLoaded", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  window.addEventListener("popstate", scheduleSync);
  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState !== "loading") scheduleSync();
})();
