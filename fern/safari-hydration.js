(function () {
  // Safari's older module loader can resolve concurrent imports before shared
  // top-level-await dependencies finish evaluating. Astro then receives an
  // undefined renderer and silently leaves its islands as inert server HTML.
  // Keep this workaround out of Chromium/Firefox and out of healthy islands.
  var ua = navigator.userAgent;
  if (!/AppleWebKit\//.test(ua) || !/Version\/[\d.]+.*Safari\//.test(ua) ||
      /Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Firefox|Android/.test(ua)) return;
  if (window.__sixmmSafariHydrationGuard) return;
  window.__sixmmSafariHydrationGuard = true;

  // Start the shared renderer before component imports. Safari 26 can poison
  // the module graph when Astro imports both branches concurrently; retrying
  // the same cached namespace afterwards cannot repair its undefined exports.
  // Gate Astro's existing start method, retaining its props, slots and lifecycle.
  var rendererLoads = new Map();
  function prepareIslandClass(Island) {
    var prototype = Island && Island.prototype;
    if (!prototype || typeof prototype.start !== 'function' ||
        typeof prototype.importWithRetry !== 'function') return;
    var start = prototype.start;
    prototype.start = function () {
      var island = this;
      var args = arguments;
      var url = island.getAttribute('renderer-url');
      if (!url) return start.apply(island, args);
      var ready = rendererLoads.get(url);
      if (!ready) {
        ready = Promise.resolve().then(function () { return island.importWithRetry(url); });
        rendererLoads.set(url, ready);
        ready.catch(function () { rendererLoads.delete(url); });
      }
      return ready.catch(function () {}).then(function () {
        if (island.isConnected) return start.apply(island, args);
      });
    };
  }
  var registry = window.customElements;
  if (registry) {
    var Island = registry.get('astro-island');
    if (Island) prepareIslandClass(Island);
    else {
      var define = registry.define;
      var defineIsland = function (name, constructor) {
        if (name === 'astro-island') prepareIslandClass(constructor);
        var result = define.apply(this, arguments);
        if (name === 'astro-island' && registry.define === defineIsland) registry.define = define;
        return result;
      };
      registry.define = defineIsland;
    }
  }

  var reloadKey = 'sixmm:safari-hydration-reload';
  var reloadCooldown = 5 * 60 * 1000;
  var timer;
  var revision = 0;
  var retried = new WeakSet();
  var notice;
  var criticalSelector = 'astro-island[component-url*="CustomHeaderIsland"], ' +
    'astro-island[component-url*="HeaderContentIsland"], ' +
    'astro-island[component-url*="HeaderTabsIsland"]';

  function broken(island) {
    // Component is assigned only after Astro's parallel imports resolve. An
    // unassigned Component is ordinary loading, not evidence of this bug.
    return island.isConnected && island.hasAttribute('ssr') &&
      !island.hasAttribute('data-fern-hydrated') &&
      Boolean(island.Component) && island.hydrator === undefined &&
      Boolean(island.getAttribute('renderer-url'));
  }

  function criticalFailure() {
    return Array.from(document.querySelectorAll(criticalSelector)).some(broken);
  }

  function removeNotice() {
    if (notice) notice.remove();
    notice = null;
  }

  function showNotice() {
    if (notice && notice.isConnected) return;
    var chinese = /^zh\b/i.test(document.documentElement.lang);
    notice = document.createElement('div');
    notice.className = 'sixmm-hydration-notice';
    notice.setAttribute('role', 'alert');
    var message = document.createElement('span');
    message.textContent = chinese
      ? '页面交互未能加载，请重新载入后继续。'
      : 'Page controls could not load. Reload to continue.';
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = chinese ? '重新载入' : 'Reload page';
    // A native listener remains usable even when React has not mounted.
    retry.addEventListener('click', function () { window.location.reload(); });
    notice.appendChild(message);
    notice.appendChild(retry);
    document.body.appendChild(notice);
  }

  function recoverPage() {
    // Never create a reload loop. If storage is unavailable, require an
    // explicit retry instead of losing the budget on the next document.
    try {
      var now = Date.now();
      var previous = Number(window.sessionStorage.getItem(reloadKey));
      if (previous && now - previous < reloadCooldown) {
        showNotice();
        return;
      }
      window.sessionStorage.setItem(reloadKey, String(now));
    } catch (error) {
      showNotice();
      return;
    }
    window.location.reload();
  }

  function check() {
    timer = null;
    if (document.readyState !== 'complete' || document.hidden) return;
    if (!criticalFailure()) {
      removeNotice();
      return;
    }
    if (navigator.onLine === false) {
      showNotice();
      return;
    }
    var currentRevision = revision;
    var currentUrl = window.location.href;
    // Retry through Astro's own loader, preserving its props/slots and normal
    // hydration lifecycle. Do not replace DOM, React handlers or module URLs.
    Array.from(document.querySelectorAll('astro-island[ssr]')).forEach(function (island) {
      if (!broken(island) || retried.has(island) || typeof island.start !== 'function') return;
      retried.add(island);
      try {
        Promise.resolve(island.start()).catch(function () {});
      } catch (error) { /* The bounded recovery below handles failed retries. */ }
    });
    timer = window.setTimeout(function () {
      timer = null;
      if (revision !== currentRevision || window.location.href !== currentUrl || document.hidden) return;
      if (!criticalFailure()) {
        removeNotice();
      } else if (navigator.onLine === false) {
        showNotice();
      } else {
        recoverPage();
      }
    }, 1500);
  }

  function cancel() {
    revision += 1;
    window.clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    cancel();
    timer = window.setTimeout(check, 2500);
  }

  window.addEventListener('load', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('online', schedule);
  document.addEventListener('astro:before-preparation', cancel);
  document.addEventListener('astro:page-load', schedule);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancel();
    else schedule();
  });
  document.addEventListener('fern:island-hydrated', function () {
    if (!criticalFailure()) removeNotice();
  });
  if (document.readyState === 'complete') schedule();
})();
