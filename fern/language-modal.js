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
    return (
      selectors.find(function (selector) {
        return selector.isConnected && selector.offsetParent !== null;
      }) ||
      selectors.find(function (selector) {
        return selector.isConnected;
      })
    );
  }

  function visibleThemeTrigger() {
    var triggers = Array.from(
      document.querySelectorAll(".sixmm-theme-trigger"),
    );
    return (
      triggers.find(function (trigger) {
        return trigger.isConnected && trigger.offsetParent !== null;
      }) ||
      triggers.find(function (trigger) {
        return trigger.isConnected;
      })
    );
  }

  function syncThemeTriggerAppearance(theme) {
    Array.from(document.querySelectorAll(".sixmm-theme-trigger")).forEach(
      function (trigger) {
        var svg = trigger.querySelector(
          "svg.lucide-sun, svg.lucide-moon, svg.lucide-monitor",
        );
        if (svg) {
          svg.setAttribute(
            "class",
            "lucide " + (theme === "dark" ? "lucide-moon" : "lucide-sun"),
          );
          svg.innerHTML =
            theme === "dark"
              ? '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>'
              : '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>';
        }
        Array.from(trigger.childNodes).forEach(function (node) {
          if (node.nodeType === 3 && node.textContent.trim()) {
            node.textContent = theme === "dark" ? "Dark" : "Light";
          }
        });
        trigger.setAttribute(
          "aria-label",
          theme === "dark" ? "Dark" : "Light",
        );
      },
    );
  }

  function navigateDocsTheme(theme) {
    if (theme !== "light" && theme !== "dark") return false;

    syncThemeTriggerAppearance(theme);
    var trigger = visibleThemeTrigger();
    if (!trigger) return false;
    trigger.click();

    var attempts = 0;
    function selectOption() {
      var iconSelector =
        theme === "dark" ? "svg.lucide-moon" : "svg.lucide-sun";
      var option = Array.from(
        document.querySelectorAll(
          '[role="menuitemradio"], [role="menuitem"]',
        ),
      ).find(function (candidate) {
        var label = (candidate.textContent || "").trim().toLowerCase();
        return (
          candidate.isConnected &&
          candidate !== trigger &&
          (label === theme || Boolean(candidate.querySelector(iconSelector)))
        );
      });

      if (option) {
        option.click();
        return;
      }
      attempts += 1;
      if (attempts < 20) window.requestAnimationFrame(selectOption);
    }
    window.requestAnimationFrame(selectOption);
    return true;
  }

  function navigateDocsLocale(locale) {
    if (!Object.prototype.hasOwnProperty.call(localeLabels, locale)) return;

    var selector = visibleSelector();
    if (!selector) return;
    selector.click();

    var attempts = 0;
    function selectOption() {
      enhanceMenus();
      var option = Array.from(
        document.querySelectorAll(
          '.fern-language-dropdown-content [role="menuitemradio"]',
        ),
      ).find(function (candidate) {
        return optionLocale(candidate) === locale;
      });

      if (option) {
        option.click();
        return;
      }
      attempts += 1;
      if (attempts < 20) window.requestAnimationFrame(selectOption);
    }
    window.requestAnimationFrame(selectOption);
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
