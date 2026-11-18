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
