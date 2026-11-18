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
