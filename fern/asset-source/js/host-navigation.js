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
