export type ThemeMode = 'light' | 'dark';

export type ThemePreset = {
  key: string;
  label: string;
  mode: ThemeMode;
  swatch: string;
  fontStyle: 'modern' | 'editorial' | 'tech';
};

export const STORAGE_KEY = 'cognitwist-theme';
export const CHANGE_EVENT = 'cognitwist-theme-change';

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'linen',
    label: 'Linen',
    mode: 'light',
    swatch: 'from-[#0f766e] via-[#d7f3ef] to-[#c26c3a]',
    fontStyle: 'modern',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    mode: 'dark',
    swatch: 'from-[#22c55e] via-[#0f172a] to-[#22d3ee]',
    fontStyle: 'tech',
  },
  {
    key: 'aurora',
    label: 'Aurora',
    mode: 'dark',
    swatch: 'from-[#c084fc] via-[#1d4ed8] to-[#34d399]',
    fontStyle: 'modern',
  },
  {
    key: 'editorial',
    label: 'Editorial',
    mode: 'light',
    swatch: 'from-[#7c2d12] via-[#f1e4cf] to-[#1d4ed8]',
    fontStyle: 'editorial',
  },
];

export const DEFAULT_THEME_KEY = 'linen';

export function getThemePreset(themeKey: string | null | undefined) {
  return THEME_PRESETS.find((theme) => theme.key === themeKey) || THEME_PRESETS[0];
}
