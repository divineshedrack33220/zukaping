import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { getPalette, Palette } from '../styles/tokens';

export type ThemeMode = 'light' | 'dark';

interface AppThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  palette: Palette;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'theme_mode';

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  // Flutter starts with ThemeMode.dark.
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#121212' : '#FFFFFF');
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const toggle = useCallback(
    () => setModeState((current) => (current === 'dark' ? 'light' : 'dark')),
    []
  );

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      palette: getPalette(mode),
      setMode,
      toggle,
    }),
    [mode, setMode, toggle]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = () => {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside <AppThemeProvider>');
  return ctx;
};

/** Shortcut used by every screen: `const c = usePalette();` */
export const usePalette = () => useAppTheme().palette;
