export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'kh.theme'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

export function readThemeMode(fallback: ThemeMode = 'light'): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function writeThemeMode(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore storage failures.
  }
}

export function applyThemeMode(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme
}
