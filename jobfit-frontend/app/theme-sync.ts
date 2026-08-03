'use client';

import { CHANGE_EVENT, DEFAULT_THEME_KEY, getThemePreset, STORAGE_KEY } from './theme-config';

export function applyTheme(themeKey: string) {
  const preset = getThemePreset(themeKey);
  document.documentElement.dataset.theme = preset.key;
  document.documentElement.dataset.themeMode = preset.mode;
  document.documentElement.dataset.fontStyle = preset.fontStyle;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: preset }));
}

export function loadInitialTheme() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (stored) {
    return getThemePreset(stored);
  }

  if (preferredDark) {
    return getThemePreset('midnight');
  }

  return getThemePreset(DEFAULT_THEME_KEY);
}
