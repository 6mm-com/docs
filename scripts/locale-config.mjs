export const generatorVersion = 4;

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
  { code: "tr", label: "Türkçe", sourceLanguage: "en", targetLanguage: "tr" },
  { code: "ko", label: "한국어", sourceLanguage: "en", targetLanguage: "ko" },
  { code: "el", label: "Ελληνικά", sourceLanguage: "en", targetLanguage: "el" },
  { code: "ar", label: "العربية", sourceLanguage: "en", targetLanguage: "ar" },
];

export const expectedLocales = locales.map((locale) => locale.code);
export const nativeLocaleCodes = locales.map((locale) => locale.code);
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
