import { createTheme, Theme } from '@mui/material/styles';
import { ERROR, PRIMARY, getPalette } from './styles/tokens';

/**
 * MUI themes that mirror `mobile_app/lib/config/app_theme.dart` exactly.
 * Dark is the Flutter default (themeNotifier starts on ThemeMode.dark).
 */
export const buildFlutterTheme = (mode: 'light' | 'dark'): Theme => {
  const p = getPalette(mode);

  return createTheme({
    palette: {
      mode,
      primary: { main: PRIMARY, contrastText: '#FFFFFF' },
      secondary: { main: PRIMARY, contrastText: '#FFFFFF' },
      error: { main: ERROR },
      background: { default: p.scaffold, paper: p.scaffold },
      text: { primary: p.text, secondary: p.textSecondary },
      divider: p.border,
    },
    typography: {
      // Flutter sets no fontFamily: it uses Roboto (Android) / SF (iOS).
      fontFamily:
        'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': { boxSizing: 'border-box' },
          html: { WebkitTapHighlightColor: 'transparent' },
          body: { backgroundColor: p.scaffold, overscrollBehaviorY: 'none' },
          '::-webkit-scrollbar': { width: 0, height: 0 },
          '::-webkit-scrollbar-thumb': { background: 'transparent' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 26,
            minHeight: 56,
            fontSize: 16,
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
            '&.Mui-disabled': {
              backgroundColor: p.surfaceStrong,
              color: p.textHint,
              boxShadow: 'none',
            },
          },
          containedPrimary: { backgroundColor: PRIMARY, color: '#FFFFFF' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: p.inputFill,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: p.inputBorder },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: p.inputBorder },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: PRIMARY,
              borderWidth: 2,
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: { color: p.text, fontSize: 16, '&::placeholder': { color: p.textHint } },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: 'rgba(0,0,0,0.85)', fontSize: 12, borderRadius: 4 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 28, backgroundColor: p.scaffold, backgroundImage: 'none' },
        },
      },
      MuiSnackbar: {
        styleOverrides: {
          root: { borderRadius: 20 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: p.surfaceStrong },
          bar: { backgroundColor: PRIMARY },
        },
      },
    },
  });
};

export const lightTheme = buildFlutterTheme('light');
export const darkTheme = buildFlutterTheme('dark');
export { PRIMARY };
