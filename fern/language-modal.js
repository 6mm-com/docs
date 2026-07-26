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
    { code: "tr", label: "O‘zbek", htmlLang: "uz", widget: "uz", aliases: ["uz", "uz-uz"] },
    { code: "ar", label: "العربية", widget: "ar", aliases: ["ar", "ar-sa"] },
    { code: "ms", label: "Filipino", htmlLang: "fil", widget: "fil", aliases: ["fil", "fil-ph"] },
    { code: "tr-TR", label: "Azərbaycan", htmlLang: "az", widget: "az", aliases: ["az", "az-az"] },
  ];
  var localeNavigationId = 0;
  var themeNavigationId = 0;

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

  function syncLocaleLabels() {
    Array.from(
      document.querySelectorAll(
        '.fern-language-dropdown-content [role="menuitemradio"][href]',
      ),
    ).forEach(function (option) {
      var locale = localeForPathname(
        new URL(option.href, window.location.origin).pathname,
      );
      var definition = locales.find(function (item) {
        return item.code === locale;
      });
      var label = option.querySelector(".fern-language-dropdown-item-label");
      if (definition && label && label.textContent !== definition.label) {
        label.textContent = definition.label;
      }
    });
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
    var segments = window.location.pathname.split("/").filter(Boolean);
    if (localeForPathname(window.location.pathname)) segments.shift();
    var pagePath = "/" + segments.join("/");
    if (pagePath === "/") pagePath = "/home";
    var targetPath = (locale ? "/" + locale : "") + pagePath;
    var targetUrl =
      targetPath + window.location.search + window.location.hash;

    // Fern does not expose a public locale API. Read the Next.js router already
    // attached to Fern's mounted links and navigate directly without opening
    // the language menu or reloading the support widget.
    var router = await waitFor(fernRouter, 2500);
    if (!router || navigationId !== localeNavigationId) return false;
    router.replace(targetUrl, { scroll: false });
    var changed = await waitFor(function () {
      return currentDocsLocale() === locale ? true : null;
    }, 2500);
    return navigationId === localeNavigationId && Boolean(changed);
  }

  function currentTheme() {
    var root = document.documentElement;
    if (root.classList.contains("dark")) return "dark";
    if (root.classList.contains("light")) return "light";
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function visibleThemeTrigger() {
    return Array.from(
      document.querySelectorAll(".fern-language-selector + button"),
    ).find(function (trigger) {
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

  function themeOption(menu, theme) {
    var iconSelector =
      theme === "dark" ? "svg.lucide-moon" : "svg.lucide-sun";
    return Array.from(
      menu.querySelectorAll('[role="menuitemradio"], [role="menuitem"], button'),
    ).find(function (option) {
      return (
        (option.textContent || "").trim().toLowerCase() === theme ||
        Boolean(option.querySelector(iconSelector))
      );
    });
  }

  async function navigateDocsTheme(theme) {
    if (theme !== "light" && theme !== "dark") return false;
    if (currentTheme() === theme) return true;

    var navigationId = ++themeNavigationId;
    var trigger = await waitFor(visibleThemeTrigger, 2500);
    if (!trigger || navigationId !== themeNavigationId) return false;
    if (
      trigger.getAttribute("aria-expanded") !== "true" &&
      trigger.dataset.state !== "open"
    ) {
      trigger.click();
    }

    var option = await waitFor(function () {
      var menu = controlledMenu(trigger);
      return menu ? themeOption(menu, theme) : null;
    }, 2500);
    if (!option || navigationId !== themeNavigationId) return false;

    option.click();
    var changed = await waitFor(function () {
      return currentTheme() === theme ? true : null;
    }, 2500);
    return navigationId === themeNavigationId && Boolean(changed);
  }

  window.__sixmmNavigateDocsLocale = navigateDocsLocale;
  window.__sixmmNavigateDocsTheme = navigateDocsTheme;
  document.addEventListener("DOMContentLoaded", syncLocaleLabels);
  new MutationObserver(function () {
    window.requestAnimationFrame(syncLocaleLabels);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
