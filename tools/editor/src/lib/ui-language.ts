export type UiLanguage = 'en' | 'ru';

const UI_LANGUAGE_KEY = 'panda:ui-language:v1';

export function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'en' || value === 'ru';
}

export function loadUiLanguagePreference(): UiLanguage {
  if (typeof window === 'undefined') return 'en';
  const raw = window.localStorage.getItem(UI_LANGUAGE_KEY);
  return isUiLanguage(raw) ? raw : 'en';
}

export function persistUiLanguagePreference(language: UiLanguage): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(UI_LANGUAGE_KEY, language);
}

export function createUiText(language: UiLanguage) {
  return (english: string, russian: string): string => (language === 'ru' ? russian : english);
}

export function languageFlag(language: UiLanguage): string {
  return language === 'ru' ? '🇷🇺' : '🇬🇧';
}

export function languageLabel(language: UiLanguage): string {
  return language === 'ru' ? 'Русский' : 'English';
}

export function otherLanguage(language: UiLanguage): UiLanguage {
  return language === 'ru' ? 'en' : 'ru';
}
