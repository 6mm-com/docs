(function () {
  if (window.__sixmmDocsInterface) return;
  window.__sixmmDocsInterface = true;

  var arabic = {
    "Search": "بحث", "Ask AI": "اسأل الذكاء الاصطناعي",
    "Ask a question": "اطرح سؤالاً", "Ask this page": "اسأل عن هذه الصفحة",
    "Copy page": "نسخ الصفحة", "Copied": "تم النسخ", "Copied!": "تم النسخ!",
    "Copy to clipboard": "نسخ إلى الحافظة", "View as Markdown": "عرض بصيغة Markdown",
    "View this page as plain text": "عرض الصفحة كنص عادي",
    "Copy this page as Markdown for LLMs": "نسخ الصفحة بصيغة Markdown للنماذج اللغوية",
    "More actions": "المزيد من الإجراءات", "On this page": "في هذه الصفحة",
    "Scroll to top": "العودة إلى الأعلى", "Skip to navigation": "انتقل إلى التنقل",
    "Was this page helpful?": "هل كانت هذه الصفحة مفيدة؟",
    "Yes": "نعم", "No": "لا", "Edit this page": "تعديل هذه الصفحة",
    "Next": "التالي", "Previous": "السابق", "Powered by": "بدعم من",
    "Built with": "تم الإنشاء باستخدام", "Launch App": "افتح التطبيق",
    "Open menu": "فتح القائمة", "Close menu": "إغلاق القائمة",
    "Close search": "إغلاق البحث", "No results found": "لم يتم العثور على نتائج",
    "Suggestions": "اقتراحات", "Results": "النتائج", "Theme": "المظهر",
    "Light": "فاتح", "Dark": "داكن", "System": "النظام",
    "Assistant": "المساعد", "Maximize": "تكبير", "Minimize": "تصغير",
    "New chat": "محادثة جديدة", "Close chat": "إغلاق المحادثة",
    "Send": "إرسال", "Filters": "عوامل التصفية",
    "AI-generated answers may contain mistakes.": "قد تحتوي الإجابات التي يولدها الذكاء الاصطناعي على أخطاء.",
    "Responses are generated using AI and may contain mistakes.": "تُولَّد الإجابات باستخدام الذكاء الاصطناعي وقد تحتوي على أخطاء.",
    "Hi, I'm an AI assistant with access to documentation and other content.": "مرحباً، أنا مساعد ذكاء اصطناعي يمكنه الوصول إلى الوثائق والمحتوى الآخر.",
    "Tip: You can toggle this pane with": "نصيحة: يمكنك إظهار هذه اللوحة أو إخفاءها باستخدام",
    "Ask AI a question...": "اطرح سؤالاً على الذكاء الاصطناعي...",
    "Ask questions about this page": "اطرح أسئلة حول هذه الصفحة",
    "Connect to Cursor": "الاتصال بـ Cursor",
    "Install MCP server on Cursor": "تثبيت خادم MCP على Cursor",
    "Connect to Claude Code": "الاتصال بـ Claude Code",
    "Copy MCP server command for Claude Code": "نسخ أمر خادم MCP لـ Claude Code",
    "Report incorrect code": "الإبلاغ عن كود غير صحيح",
    "Open in ChatGPT": "افتح في ChatGPT", "Open in Claude": "افتح في Claude",
    "Open in Cursor": "افتح في Cursor", "Open in Claude Code": "افتح في Claude Code"
  };
  var observer, scheduled = false;
  function locale() {
    var first = window.location.pathname.split("/").filter(Boolean)[0] || "";
    return (window.__sixmmDocsLocales || []).some(function (entry) { return entry.code === first && first; }) ? first : "";
  }
  function translate(value) {
    var text = value.trim();
    return arabic[text] ? value.replace(text, arabic[text]) : value;
  }
  function syncEditLinks(lang) {
    document.querySelectorAll('a[href^="https://github.com/6mm-com/docs/blob/main/fern/"]').forEach(function (link) {
      var url = new URL(link.href);
      url.pathname = url.pathname.replace(
        /\/fern\/(?:translations\/[^/]+\/)?docs\//,
        "/fern/" + (lang ? "translations/" + lang + "/" : "") + "docs/"
      );
      if (link.href !== url.href) link.href = url.href;
    });
  }
  function syncArabic() {
    // Leave article content, code, language names and embedded applications
    // untouched. Text nodes preserve icons and React's existing DOM structure.
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (!parent || parent.closest('main article, pre, code, script, style, textarea, .fern-language-selector, .fern-language-dropdown-content, .sixmm-mobile-language-dialog, #cs-widget-container')) continue;
      var replacement = translate(node.nodeValue);
      if (replacement !== node.nodeValue) node.nodeValue = replacement;
    }
    document.querySelectorAll('[aria-label], [title], [placeholder]').forEach(function (element) {
      if (element.closest('main article, pre, code, #cs-widget-container')) return;
      ["aria-label", "title", "placeholder"].forEach(function (name) {
        var value = element.getAttribute(name);
        if (value === null) return;
        var replacement = translate(value);
        if (replacement !== value) element.setAttribute(name, replacement);
      });
    });
  }
  function observe() {
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["href", "aria-label", "aria-disabled", "title", "placeholder"]
    });
  }
  function sync() {
    scheduled = false;
    // Fern's header starts disabled until its React provider has hydrated.
    // Never replace server-rendered text while hydration is still pending.
    var ai = document.getElementById("fern-ask-ai-button");
    if (document.readyState !== "complete" || (ai && ai.getAttribute("aria-disabled") === "true")) return;
    observer.disconnect();
    try {
      var lang = locale();
      syncEditLinks(lang);
      if (lang === "ar") syncArabic();
    } finally { observe(); }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(sync);
  }
  observer = new MutationObserver(schedule);
  observe();
  window.addEventListener("load", schedule);
  window.addEventListener("pageshow", schedule);
  document.addEventListener("astro:page-load", schedule);
  schedule();
})();
