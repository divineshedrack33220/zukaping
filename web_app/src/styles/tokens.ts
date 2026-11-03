/**
 * Design tokens copied 1:1 from the Flutter app.
 *
 * Sources:
 *  - mobile_app/lib/config/app_theme.dart
 *  - the per-screen values in docs/flutter-spec/*.md
 */

export const PRIMARY = '#026AFD';
export const ERROR = '#FF453A';
export const SUCCESS = '#34C759';
export const AMBER = '#FFC107';

export interface Palette {
  /** Theme.of(context).brightness == Brightness.dark */
  isDark: boolean;
  primary: string;
  /** Scaffold background */
  scaffold: string;
  /** AppBar background */
  appBar: string;
  /** Elevated card background (#FAFAFA / #1C1C1E) */
  card: string;
  /** Filled input / soft chip background (#F5F5F5 / #1C1C1E) */
  surface: string;
  /** Slightly stronger fill (#EEEEEE / #2C2C2E) */
  surfaceStrong: string;
  /** Hairline border (#EEEEEE / #2C2C2E) */
  border: string;
  /** Stronger border (#E0E0E0 / #3A3A3C) */
  borderStrong: string;
  /** Body copy (#000000 / #FFFFFF) */
  text: string;
  /** Secondary copy (#666666 / #BDBDBD) */
  textSecondary: string;
  /** Hint copy (#9E9E9E both) */
  textHint: string;
  /** Bottom nav background (#FFFFFF / #1C1C1E) */
  nav: string;
  /** Input fill for the Flutter text-field overrides (#F5F5F5 / #1C1C1E) */
  inputFill: string;
  /** Input border (#BDBDBD / #2C2C2E) */
  inputBorder: string;
  /** Dark backdrop behind modals */
  scrim: string;
  /** White/black inverse */
  inverse: string;
  /** Black/white inverse text */
  onInverse: string;
}

export const lightPalette: Palette = {
  isDark: false,
  primary: PRIMARY,
  scaffold: '#FFFFFF',
  appBar: '#FFFFFF',
  card: '#FAFAFA',
  surface: '#F5F5F5',
  surfaceStrong: '#EEEEEE',
  border: '#EEEEEE',
  borderStrong: '#E0E0E0',
  text: '#000000',
  textSecondary: '#666666',
  textHint: '#9E9E9E',
  nav: '#FFFFFF',
  inputFill: '#F5F5F5',
  inputBorder: '#BDBDBD',
  scrim: 'rgba(0,0,0,0.5)',
  inverse: '#000000',
  onInverse: '#FFFFFF',
};

export const darkPalette: Palette = {
  isDark: true,
  primary: PRIMARY,
  scaffold: '#121212',
  appBar: '#121212',
  card: '#1C1C1E',
  surface: '#1C1C1E',
  surfaceStrong: '#2C2C2E',
  border: '#2C2C2E',
  borderStrong: '#3A3A3C',
  text: '#FFFFFF',
  textSecondary: '#BDBDBD',
  textHint: '#9E9E9E',
  nav: '#1C1C1E',
  inputFill: '#1C1C1E',
  inputBorder: '#2C2C2E',
  scrim: 'rgba(0,0,0,0.6)',
  inverse: '#FFFFFF',
  onInverse: '#000000',
};

export const getPalette = (mode: 'light' | 'dark'): Palette =>
  mode === 'dark' ? darkPalette : lightPalette;

/**
 * Bottom clearance for screens that scroll under the fixed nav bar: the bar is
 * 60px tall and its centre create button overhangs another 24px, so a row that
 * stops at 60px still disappears behind the button.
 */
export const NAV_CLEARANCE = 'calc(84px + env(safe-area-inset-bottom))';

/** Material icon colors used by the Flutter status matrix. */
export const STATUS_COLORS: Record<string, string> = {
  available: '#026AFD',
  busy: '#FFEB3B',
  ghost: 'rgba(158,158,158,0.5)',
  super: '#7C4DFF',
  offline: '#9E9E9E',
};

/** Status gradient pairs (story rail rings). */
export const STATUS_RINGS: Record<
  string,
  { start: string; end: string; icon: string; badge: string }
> = {
  available: { start: '#026AFD', end: '#90CAF9', icon: 'flash', badge: '#026AFD' },
  busy: { start: '#FFC107', end: '#FFF176', icon: 'remove', badge: '#FFC107' },
  ghost: { start: '#BDBDBD', end: '#EEEEEE', icon: 'visibility_off', badge: '#9E9E9E' },
  super: { start: '#E040FB', end: '#B39DDB', icon: 'star', badge: '#9C27B0' },
};
