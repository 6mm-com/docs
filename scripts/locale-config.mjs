export const generatorVersion = 4;

export const locales = [
  { code: "en", label: "English", default: true, widgetAliases: ["en", "en-us", "en-gb", "en-Asia", "en-sg"] },
  { code: "ja", label: "日本語", sourceLanguage: "en", targetLanguage: "ja", widgetAliases: ["ja", "ja-jp"] },
  { code: "ru", label: "Русский", sourceLanguage: "en", targetLanguage: "ru", widgetAliases: ["ru", "ru-ru"] },
  { code: "es-419", label: "Español (Latinoamérica)", sourceLanguage: "en", targetLanguage: "es-MX", widgetAliases: ["es-419", "es-AR"] },
  { code: "it", label: "Italiano", sourceLanguage: "en", targetLanguage: "it", widgetAliases: ["it", "it-it"] },
  { code: "fr", label: "Français", sourceLanguage: "en", targetLanguage: "fr", widgetAliases: ["fr", "fr-fr"] },
  { code: "de", label: "Deutsch", sourceLanguage: "en", targetLanguage: "de", widgetAliases: ["de", "de-de"] },
  { code: "zh-CN", label: "简体中文", manual: true, widgetAliases: ["zh", "zh-cn", "zh-hans"] },
  { code: "zh-TW", label: "繁體中文", sourceLanguage: "en", targetLanguage: "zh-TW", widgetAliases: ["zh-tw", "zh-hant"] },
  { code: "pt-BR", label: "Português (Brasil)", sourceLanguage: "en", targetLanguage: "pt-BR", widgetAliases: ["pt-br"] },
  { code: "id", label: "Bahasa Indonesia", sourceLanguage: "en", targetLanguage: "id", widgetAliases: ["id", "id-id"] },
  { code: "pl", label: "Polski", sourceLanguage: "en", targetLanguage: "pl", widgetAliases: ["pl", "pl-pl"] },
  { code: "vi", label: "Tiếng Việt", sourceLanguage: "en", targetLanguage: "vi", widgetAliases: ["vi", "vi-vn"] },
  { code: "uk", label: "Українська", sourceLanguage: "en", targetLanguage: "uk", widgetAliases: ["uk", "uk-ua"] },
  { code: "pt-PT", label: "Português (Internacional)", sourceLanguage: "en", targetLanguage: "pt-PT", widget: "pt", widgetAliases: ["pt", "pt-pt"] },
  { code: "es-ES", label: "Español (Internacional)", sourceLanguage: "en", targetLanguage: "es-ES", widget: "es", widgetAliases: ["es", "es-es"] },
  { code: "tr", label: "Türkçe", sourceLanguage: "en", targetLanguage: "tr", widget: "en", widgetFallback: true, widgetAliases: ["tr", "tr-tr"] },
  { code: "ko", label: "한국어", sourceLanguage: "en", targetLanguage: "ko", widget: "en", widgetFallback: true, widgetAliases: ["ko", "ko-kr"] },
  { code: "el", label: "Ελληνικά", sourceLanguage: "en", targetLanguage: "el", widget: "en", widgetFallback: true, widgetAliases: ["el", "el-gr"] },
  { code: "ar", label: "العربية", sourceLanguage: "en", targetLanguage: "ar", widgetAliases: ["ar", "ar-sa"] },
];

export const expectedLocales = locales.map((locale) => locale.code);
export const nativeLocaleCodes = locales.map((locale) => locale.code);
export const generatedLocaleSpecs = locales.filter(
  (locale) => !locale.default && !locale.manual,
);

export const browserLocales = locales.map(locale => ({
  code: locale.default ? "" : locale.code,
  label: locale.label,
  ...(locale.default ? { htmlLang: locale.code } : {}),
  widget: locale.widget || locale.code,
  ...(locale.widgetFallback ? { widgetFallback: true } : {}),
  aliases: locale.widgetAliases.map(alias => alias.toLowerCase()),
}));

// Only cross-region and generic language aliases that need redirect checks.
export const widgetLocaleAliases = Object.fromEntries(
  ["en-Asia", "es-AR", "pt", "es"].map(alias => [
    alias, locales.find(locale => locale.widgetAliases.includes(alias)).code,
  ]),
);
