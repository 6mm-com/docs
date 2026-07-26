export const generatorVersion = 3;

export const locales = [
  { code: "en", label: "English", default: true },
  { code: "ja", label: "日本語", sourceLanguage: "en", targetLanguage: "ja" },
  { code: "ru", label: "Русский", sourceLanguage: "en", targetLanguage: "ru" },
  { code: "es-419", label: "Español (Latinoamérica)", sourceLanguage: "en", targetLanguage: "es-MX" },
  { code: "it", label: "Italiano", sourceLanguage: "en", targetLanguage: "it" },
  { code: "fr", label: "Français", sourceLanguage: "en", targetLanguage: "fr" },
  { code: "de", label: "Deutsch", sourceLanguage: "en", targetLanguage: "de" },
  { code: "zh-CN", label: "简体中文", manual: true },
  { code: "zh-TW", label: "繁體中文", sourceLanguage: "en", targetLanguage: "zh-TW" },
  { code: "pt-BR", label: "Português (Brasil)", sourceLanguage: "en", targetLanguage: "pt-BR" },
  { code: "id", label: "Bahasa Indonesia", sourceLanguage: "en", targetLanguage: "id" },
  { code: "pl", label: "Polski", sourceLanguage: "en", targetLanguage: "pl" },
  { code: "vi", label: "Tiếng Việt", sourceLanguage: "en", targetLanguage: "vi" },
  { code: "uk", label: "Українська", sourceLanguage: "en", targetLanguage: "uk" },
  { code: "pt-PT", label: "Português (Internacional)", sourceLanguage: "en", targetLanguage: "pt-PT" },
  { code: "es-ES", label: "Español (Internacional)", sourceLanguage: "en", targetLanguage: "es-ES" },
  { code: "uz", label: "O‘zbek", sourceLanguage: "en", targetLanguage: "uz", standalone: true },
  { code: "ar", label: "العربية", sourceLanguage: "en", targetLanguage: "ar" },
  { code: "fil", label: "Filipino", sourceLanguage: "en", targetLanguage: "fil", standalone: true },
  { code: "az", label: "Azərbaycan", sourceLanguage: "en", targetLanguage: "az", standalone: true },
];

export const expectedLocales = locales.map((locale) => locale.code);
export const standaloneLocaleCodes = new Set(
  locales.filter((locale) => locale.standalone).map((locale) => locale.code),
);
export const nativeLocaleCodes = expectedLocales.filter(
  (locale) => !standaloneLocaleCodes.has(locale),
);
export const generatedLocaleSpecs = locales.filter(
  (locale) => !locale.default && !locale.manual,
);

// Widget locale codes that intentionally share a Docs translation.
export const widgetLocaleAliases = {
  "en-Asia": "en",
  "es-AR": "es-419",
  pt: "pt-PT",
  es: "es-ES",
};
