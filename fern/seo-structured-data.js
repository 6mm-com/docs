(function () {
  var normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath !== "/" && normalizedPath !== "/home") {
    return;
  }

  if (document.querySelector('script[data-sixmm-website-schema="true"]')) {
    return;
  }

  var structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "6MM Docs",
    alternateName: ["6MM Documentation", "docs.6mm.com"],
    url: "https://docs.6mm.com/",
  };
  var script = document.createElement("script");

  script.type = "application/ld+json";
  script.dataset.sixmmWebsiteSchema = "true";
  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
})();
