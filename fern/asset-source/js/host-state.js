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
