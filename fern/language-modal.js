/* Generated from fern/asset-source/js by npm run assets:build. */
(function () {
  if (window.__sixmmLanguageModalInitialized) return;
  window.__sixmmLanguageModalInitialized = true;

  function firstPathSegment(pathname) {
    return pathname.split("/").find(Boolean) || "";
  }

  function readTheme(root) {
    if (root.classList.contains("dark")) return "dark";
    if (root.classList.contains("light")) return "light";
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  // Other assets keep their own locale policy (for example, widget aliases).
  // Only the host state readers are shared across the loading phases.
  window.__sixmmDocsHost = { firstPathSegment, readTheme };

  function createHostNavigation(locales) {
    var cancelLocaleWait = null;
    var themeNavigationId = 0;

    function waitForTheme(resolveValue) {
      return new Promise(function (resolve) {
        var initial = resolveValue();
        if (initial) { resolve(initial); return; }
        var finished = false;
        var observer = new MutationObserver(check);
        var timer = window.setTimeout(function () {
          finish(null);
        }, 2500);

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

        observer.observe(document.documentElement, { attributeFilter: ["class", "data-theme"] });
      });
    }

    function localeForSegment(firstSegment) {
      var normalized = firstSegment.toLowerCase();
      var locale = locales.find(function (item) {
        return item.code && item.code.toLowerCase() === normalized;
      });
      return locale ? locale.code : "";
    }

    function localeForPathname(pathname) {
      return localeForSegment(firstPathSegment(pathname));
    }

    function currentDocsLocale() {
      return localeForPathname(window.location.pathname);
    }

    function currentRoute() {
      var segments = window.location.pathname.split("/").filter(Boolean);
      var locale = localeForSegment(segments[0] || "");
      if (locale) segments.shift();
      return {
        locale: locale,
        pagePath: segments.length ? "/" + segments.join("/") : "/",
      };
    }

    function localizedPath(locale, pagePath) {
      if (pagePath === "/") return locale ? "/" + locale : "/";
      return (locale ? "/" + locale : "") + pagePath;
    }

    function currentArticle() {
      return typeof document.querySelector === "function" ? document.querySelector("main article") : null;
    }

    function pageContentChanged(previousArticle, previousText) {
      if (!previousArticle) return true;
      var article = currentArticle();
      // Swapping the article already proves the page changed. Only read the
      // whole text when Fern reuses the original article element.
      return article !== previousArticle || article.textContent !== previousText;
    }

    function waitForLocale(pathname, previousArticle, previousText) {
      return new Promise(function (resolve) {
        function arrived() {
          return window.location.pathname === pathname && pageContentChanged(previousArticle, previousText);
        }
        if (arrived()) { resolve(true); return; }

        var observer = new MutationObserver(check);
        var timer = window.setTimeout(cancel, 15000);
        cancelLocaleWait = cancel;
        document.addEventListener("astro:page-load", check);
        // The native router normally signals the commit. The fallback watches
        // in-place text edits and direct replacements along the article's path,
        // not unrelated changes in the sidebar, widget or page attributes.
        if (previousArticle) {
          observer.observe(previousArticle, { childList: true, characterData: true, subtree: true });
          for (var ancestor = previousArticle.parentElement; ancestor; ancestor = ancestor.parentElement) {
            observer.observe(ancestor, { childList: true });
          }
        } else {
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }

        function check() {
          if (arrived()) finish(true);
        }
        function cancel() { finish(false); }
        function finish(result) {
          if (cancelLocaleWait !== cancel) return;
          cancelLocaleWait = null;
          observer.disconnect();
          window.clearTimeout(timer);
          document.removeEventListener("astro:page-load", check);
          resolve(result);
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

      if (cancelLocaleWait) cancelLocaleWait();
      var route = currentRoute();
      var hash = window.location.hash;
      // Old shared links can still point at a translated alias. Navigate to the
      // canonical section so changing languages preserves that chapter.
      if (hash && typeof document.getElementById === "function") {
        try {
          var anchor = document.getElementById(decodeURIComponent(hash.slice(1)));
          var canonical = anchor && (anchor.dataset.sixmmAnchorTarget || anchor.dataset.sixmmCanonicalAnchor);
          if (!canonical && anchor && anchor.previousElementSibling) {
            canonical = anchor.previousElementSibling.dataset.sixmmCanonicalAnchor;
          }
          if (canonical) hash = "#" + canonical;
        } catch (error) { /* Preserve malformed incoming fragments verbatim. */ }
      }
      var targetUrl =
        localizedPath(locale, route.pagePath) +
        window.location.search + hash;
      var pathname = new URL(targetUrl, window.location.origin).pathname;
      var previousArticle = currentArticle();
      var previousText = previousArticle ? previousArticle.textContent : "";

      // Use Fern's Astro router so the retained support iframe and its current
      // conversation survive a locale change. Hydration guards below keep our
      // UI enhancements from altering incoming server markup before React mounts.
      var link = document.createElement("a");
      link.href = targetUrl;
      link.hidden = true;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      return waitForLocale(pathname, previousArticle, previousText);
    }

    async function navigateDocsTheme(theme) {
      if (theme !== "light" && theme !== "dark") return false;
      if (readTheme(document.documentElement) === theme) return true;

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

      var changed = await waitForTheme(function () {
        return readTheme(document.documentElement) === theme ? true : null;
      });
      return navigationId === themeNavigationId && Boolean(changed);
    }

    return { currentRoute, localizedPath, localeForPathname, navigateDocsLocale, navigateDocsTheme };
  }

  function createSidebarPrefetch() {
    var staticSidebarId = "fern-sidebar-static";
    var earlyPrefetchSelector = 'a[data-astro-prefetch="viewport"], a[data-astro-prefetch="load"]';

    function tunePrefetchLink(link) {
      // Fern scans the static sidebar before the afterInteractive script runs.
      // Leave React-owned links to the existing post-hydration bridge.
      if (!link.closest("astro-island")) link.setAttribute("data-astro-prefetch", "hover");
    }

    function tuneStaticSidebarPrefetch(root) {
      var sidebar = root && root.getElementById && root.getElementById(staticSidebarId);
      if (sidebar) sidebar.querySelectorAll(earlyPrefetchSelector).forEach(tunePrefetchLink);
    }

    function tuneAddedSidebarLinks(records) {
      var sidebar = document.getElementById(staticSidebarId);
      if (!sidebar) return;
      var added = new Set();
      for (var index = 0; index < records.length; index++) {
        var nodes = records[index].addedNodes;
        for (var offset = 0; offset < nodes.length; offset++) {
          var node = nodes[offset];
          if (node.nodeType !== 1) continue;
          // The parser may attach the entire sidebar (or a wrapper) in one batch.
          if (node === sidebar || node.contains(sidebar)) {
            sidebar.querySelectorAll(earlyPrefetchSelector).forEach(tunePrefetchLink);
            return;
          }
          if (sidebar.contains(node)) added.add(node);
        }
      }
      added.forEach(function (node) {
        // The same batch may report both a new branch and individual children.
        for (var parent = node.parentElement; parent !== sidebar; parent = parent.parentElement) {
          if (added.has(parent)) return;
        }
        if (node.matches(earlyPrefetchSelector)) tunePrefetchLink(node);
        node.querySelectorAll(earlyPrefetchSelector).forEach(tunePrefetchLink);
      });
    }

    return { tuneStaticSidebarPrefetch, tuneAddedSidebarLinks };
  }

  var locales = [
    {"code":"","label":"English","htmlLang":"en","widget":"en","aliases":["en","en-us","en-gb","en-asia","en-sg"]},
    {"code":"ja","label":"日本語","widget":"ja","aliases":["ja","ja-jp"]},
    {"code":"ru","label":"Русский","widget":"ru","aliases":["ru","ru-ru"]},
    {"code":"es-419","label":"Español (Latinoamérica)","widget":"es-419","aliases":["es-419","es-ar"]},
    {"code":"it","label":"Italiano","widget":"it","aliases":["it","it-it"]},
    {"code":"fr","label":"Français","widget":"fr","aliases":["fr","fr-fr"]},
    {"code":"de","label":"Deutsch","widget":"de","aliases":["de","de-de"]},
    {"code":"zh-CN","label":"简体中文","widget":"zh-CN","aliases":["zh","zh-cn","zh-hans"]},
    {"code":"zh-TW","label":"繁體中文","widget":"zh-TW","aliases":["zh-tw","zh-hant"]},
    {"code":"pt-BR","label":"Português (Brasil)","widget":"pt-BR","aliases":["pt-br"]},
    {"code":"id","label":"Bahasa Indonesia","widget":"id","aliases":["id","id-id"]},
    {"code":"pl","label":"Polski","widget":"pl","aliases":["pl","pl-pl"]},
    {"code":"vi","label":"Tiếng Việt","widget":"vi","aliases":["vi","vi-vn"]},
    {"code":"uk","label":"Українська","widget":"uk","aliases":["uk","uk-ua"]},
    {"code":"pt-PT","label":"Português (Internacional)","widget":"pt","aliases":["pt","pt-pt"]},
    {"code":"es-ES","label":"Español (Internacional)","widget":"es","aliases":["es","es-es"]},
    {"code":"tr","label":"Türkçe","widget":"en","widgetFallback":true,"aliases":["tr","tr-tr"]},
    {"code":"ko","label":"한국어","widget":"en","widgetFallback":true,"aliases":["ko","ko-kr"]},
    {"code":"el","label":"Ελληνικά","widget":"en","widgetFallback":true,"aliases":["el","el-gr"]},
    {"code":"ar","label":"العربية","widget":"ar","aliases":["ar","ar-sa"]},
  ];

  var localeLabels = {};
  var interfaceLabels = {
    "": {
      chooseLanguage: "Choose language",
      closeLanguage: "Close language selector",
    },
    ja: {
      chooseLanguage: "言語を選択",
      closeLanguage: "言語選択を閉じる",
    },
    ru: {
      chooseLanguage: "Выберите язык",
      closeLanguage: "Закрыть выбор языка",
    },
    "es-419": {
      chooseLanguage: "Seleccionar idioma",
      closeLanguage: "Cerrar selector de idioma",
    },
    it: {
      chooseLanguage: "Scegli la lingua",
      closeLanguage: "Chiudi selezione lingua",
    },
    fr: {
      chooseLanguage: "Choisir la langue",
      closeLanguage: "Fermer le sélecteur de langue",
    },
    de: {
      chooseLanguage: "Sprache auswählen",
      closeLanguage: "Sprachauswahl schließen",
    },
    "zh-CN": {
      chooseLanguage: "选择语言",
      closeLanguage: "关闭语言选择器",
    },
    "zh-TW": {
      chooseLanguage: "選擇語言",
      closeLanguage: "關閉語言選擇器",
    },
    "pt-BR": {
      chooseLanguage: "Selecionar idioma",
      closeLanguage: "Fechar seletor de idioma",
    },
    id: {
      chooseLanguage: "Pilih bahasa",
      closeLanguage: "Tutup pemilih bahasa",
    },
    pl: {
      chooseLanguage: "Wybierz język",
      closeLanguage: "Zamknij wybór języka",
    },
    vi: {
      chooseLanguage: "Chọn ngôn ngữ",
      closeLanguage: "Đóng trình chọn ngôn ngữ",
    },
    uk: {
      chooseLanguage: "Виберіть мову",
      closeLanguage: "Закрити вибір мови",
    },
    "pt-PT": {
      chooseLanguage: "Selecionar idioma",
      closeLanguage: "Fechar seletor de idioma",
    },
    "es-ES": {
      chooseLanguage: "Seleccionar idioma",
      closeLanguage: "Cerrar selector de idioma",
    },
    tr: {
      chooseLanguage: "Dil seçin",
      closeLanguage: "Dil seçiciyi kapat",
    },
    ko: {
      chooseLanguage: "언어 선택",
      closeLanguage: "언어 선택기 닫기",
    },
    el: {
      chooseLanguage: "Επιλογή γλώσσας",
      closeLanguage: "Κλείσιμο επιλογής γλώσσας",
    },
    ar: {
      chooseLanguage: "اختيار اللغة",
      closeLanguage: "إغلاق محدد اللغة",
    },
  };
  var localeOrder = locales.map(function (locale) {
    localeLabels[locale.code] = locale.label;
    return locale.code;
  });
  var syncScheduled = false;
  var mobileLocaleDialog = null;
  var mobileLocaleTrigger = null;

  window.__sixmmDocsLocales = locales;
  var { currentRoute, localizedPath, localeForPathname, navigateDocsLocale, navigateDocsTheme } =
    createHostNavigation(locales);
  var { tuneStaticSidebarPrefetch, tuneAddedSidebarLinks } = createSidebarPrefetch();

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

  function setMenuAttribute(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function syncLocaleMenu(menu, route) {
    var group = menu.querySelector(".fern-language-selector-radio-group");
    if (!group) return;

    var byLocale = {};
    var options = group.querySelectorAll('[role="menuitemradio"]');
    options.forEach(
      function (option) {
        var locale = localeForOption(option);
        if (locale === null) return;

        var selected = route.locale === locale;
        setMenuAttribute(option, "data-sixmm-locale", locale);
        setMenuAttribute(option, "href", localizedPath(locale, route.pagePath));
        setMenuAttribute(option, "data-state", selected ? "checked" : "unchecked");
        setMenuAttribute(option,
          "aria-checked",
          selected ? "true" : "false",
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
        event.stopImmediatePropagation();
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

  function isMobileViewport() {
    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 1023px)").matches;
    }
    return typeof window.innerWidth === "number" && window.innerWidth <= 1023;
  }

  function closeMobileLocaleDialog(restoreFocus) {
    if (!mobileLocaleDialog) return;
    var dialog = mobileLocaleDialog;
    var trigger = mobileLocaleTrigger;
    mobileLocaleDialog = null;
    mobileLocaleTrigger = null;
    dialog.remove();
    document.documentElement.classList.remove(
      "sixmm-mobile-language-dialog-open",
    );
    if (
      restoreFocus !== false &&
      trigger &&
      trigger.isConnected &&
      isMobileViewport()
    ) {
      trigger.focus({ preventScroll: true });
    }
  }

  function openMobileLocaleDialog(trigger) {
    if (mobileLocaleDialog) return;

    var route = currentRoute();
    var labels = interfaceLabels[route.locale] || interfaceLabels[""];
    var root = document.createElement("div");
    root.className = "sixmm-mobile-language-dialog";
    root.dataset.sixmmLocale = route.locale;

    var backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "sixmm-mobile-language-dialog-backdrop";
    backdrop.setAttribute(
      "aria-label",
      labels.closeLanguage,
    );
    backdrop.addEventListener("click", closeMobileLocaleDialog);

    var panel = document.createElement("div");
    panel.className = "sixmm-mobile-language-dialog-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "sixmm-mobile-language-title");

    var header = document.createElement("div");
    header.className = "sixmm-mobile-language-dialog-header";

    var heading = document.createElement("h2");
    heading.id = "sixmm-mobile-language-title";
    heading.textContent = labels.chooseLanguage;

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "sixmm-mobile-language-dialog-close";
    closeButton.setAttribute(
      "aria-label",
      labels.closeLanguage,
    );
    closeButton.textContent = "×";
    closeButton.addEventListener("click", closeMobileLocaleDialog);

    var options = document.createElement("div");
    options.className = "sixmm-mobile-language-dialog-options";

    locales.forEach(function (locale) {
      var option = document.createElement("button");
      option.type = "button";
      option.className = "sixmm-mobile-language-dialog-option";
      option.dataset.sixmmLocale = locale.code;
      option.textContent = locale.label;
      if (route.locale === locale.code) {
        option.dataset.state = "checked";
        option.setAttribute("aria-current", "true");
      }
      option.addEventListener("click", function () {
        closeMobileLocaleDialog(false);
        navigateDocsLocale(locale.code);
      });
      options.appendChild(option);
    });

    header.appendChild(heading);
    header.appendChild(closeButton);
    panel.appendChild(header);
    panel.appendChild(options);
    root.appendChild(backdrop);
    root.appendChild(panel);
    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileLocaleDialog();
        return;
      }
      if (event.key === "Tab") {
        var focusable = panel.querySelectorAll('button:not([disabled])');
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    mobileLocaleTrigger = trigger;
    mobileLocaleDialog = root;
    document.documentElement.classList.add(
      "sixmm-mobile-language-dialog-open",
    );
    document.body.appendChild(root);
    closeButton.focus({ preventScroll: true });
  }

  function guardMobileLocaleTrigger(selector) {
    if (selector.dataset.sixmmMobileLocaleGuard === "true") return;
    selector.dataset.sixmmMobileLocaleGuard = "true";

    selector.addEventListener(
      "pointerdown",
      function (event) {
        if (!isMobileViewport()) return;
        event.stopImmediatePropagation();
      },
      true,
    );
    selector.addEventListener(
      "click",
      function (event) {
        if (!isMobileViewport()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openMobileLocaleDialog(selector);
      },
      true,
    );
  }

  function enhanceLocaleMenus(route, labels) {
    document.querySelectorAll(".fern-language-dropdown-content").forEach(function (menu) {
      if (!menu.classList.contains("sixmm-language-menu-enhanced")) {
        menu.classList.add("sixmm-language-menu-enhanced");
        var heading = document.createElement("div");
        heading.className = "sixmm-native-language-heading";
        menu.insertBefore(heading, menu.firstChild);
      }
      var heading = menu.querySelector(".sixmm-native-language-heading");
      if (heading && heading.textContent !== labels.chooseLanguage) {
        heading.textContent = labels.chooseLanguage;
      }
      setMenuAttribute(menu, "aria-label", labels.chooseLanguage);
      guardLocaleMenu(menu);
      syncLocaleMenu(menu, route);
    });
  }

  function ensureControlClass(element, name) {
    if (!element.classList.contains(name)) element.classList.add(name);
  }

  function enhanceSettingsControls(route, labels) {
    var currentLabel = localeLabels[route.locale] || localeLabels[""];

    document.querySelectorAll(
      'button[aria-label="Open menu"], button[aria-label="Close menu"]',
    ).forEach(function (menuButton) {
      if (!isHydratedControl(menuButton)) return;
      if (!menuButton.classList.contains("sixmm-mobile-menu-trigger")) {
        menuButton.classList.add("sixmm-mobile-menu-trigger");
      }
    });

    document.querySelectorAll(".fern-language-selector").forEach(
      function (selector) {
        if (!isHydratedControl(selector)) return;
        guardMobileLocaleTrigger(selector);
        setMenuAttribute(selector, "aria-label", labels.chooseLanguage);
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

        ensureControlClass(themeButton, "sixmm-theme-trigger");
        if (
          parent.tagName === "DIV" &&
          parent.classList.contains("lg:hidden")
        ) {
          ensureControlClass(parent, "sixmm-mobile-settings-bar");
          ensureControlClass(themeButton, "sixmm-mobile-theme-trigger");
        }
        setMenuAttribute(themeButton,
          "aria-label",
          (themeButton.textContent || "").trim() || "Theme",
        );
        themeButton.removeAttribute("title");
      },
    );
  }

  function syncLocaleTabs(route) {
    if (
      mobileLocaleDialog &&
      (!isMobileViewport() ||
        mobileLocaleDialog.dataset.sixmmLocale !== route.locale)
    ) {
      closeMobileLocaleDialog(false);
    }
    var locale = route.locale || "en";
    if (document.documentElement.dataset.sixmmDocsLocale !== locale) {
      document.documentElement.dataset.sixmmDocsLocale = locale;
    }
  }

  window.__sixmmNavigateDocsLocale = navigateDocsLocale;
  window.__sixmmNavigateDocsTheme = navigateDocsTheme;

  function syncInterface() {
    syncScheduled = false;
    var route = currentRoute();
    var labels = interfaceLabels[route.locale] || interfaceLabels[""];
    enhanceSettingsControls(route, labels);
    enhanceLocaleMenus(route, labels);
    syncLocaleTabs(route);
  }
  function isHydratedControl(element) {
    if (typeof element.closest !== "function") return true;
    var island = element.closest("astro-island");
    while (island) {
      if (!island.hasAttribute("data-fern-hydrated")) return false;
      island = island.parentElement && island.parentElement.closest("astro-island");
    }
    return true;
  }

  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    window.requestAnimationFrame(syncInterface);
  }

  // This script loads before interactive content. Set the pathname-derived
  // locale immediately so standalone navigation tabs never flash on first paint.
  syncLocaleTabs(currentRoute());
  var parsingSidebar = document.readyState === "loading";
  tuneStaticSidebarPrefetch(document);
  document.addEventListener("DOMContentLoaded", function () {
    parsingSidebar = false;
    tuneStaticSidebarPrefetch(document);
    scheduleSync();
  });
  document.addEventListener("astro:before-swap", function (event) {
    tuneStaticSidebarPrefetch(event.newDocument);
  });
  document.addEventListener("fern:island-hydrated", scheduleSync);
  document.addEventListener("astro:page-load", scheduleSync);
  window.addEventListener("pageshow", function () {
    closeMobileLocaleDialog(false);
    scheduleSync();
  });
  window.addEventListener("popstate", function () {
    closeMobileLocaleDialog(false);
    scheduleSync();
  });
  window.addEventListener("resize", function () {
    if (!isMobileViewport()) closeMobileLocaleDialog(false);
  });
  new MutationObserver(function (records) {
    if (parsingSidebar) tuneAddedSidebarLinks(records);
    var controls = '.fern-language-selector, .fern-language-dropdown-content, .sixmm-theme-trigger, .fern-header-mobile-menu-button';
    if (records.some(function (record) {
      var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target && target.closest(controls)) return true;
      return Array.prototype.some.call(record.addedNodes, function (node) {
        return node.nodeType === 1 && (node.matches(controls) || node.querySelector(controls));
      });
    })) scheduleSync();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState !== "loading") scheduleSync();
})();
