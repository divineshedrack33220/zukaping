import { ReactNode, forwardRef } from 'react';
import { Box } from '@mui/material';
import { usePalette } from '../../contexts/app-theme.context';

interface FlutterInputProps {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'tel';
  multiline?: boolean;
  rows?: number;
  radius?: number;
  /** Input fill override (defaults to the Flutter themed fill). */
  fill?: string;
  border?: string;
  focusedBorder?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: number;
  paddingX?: number;
  paddingY?: number;
  suffix?: ReactNode;
  prefix?: ReactNode;
  maxLength?: number;
  readOnly?: boolean;
  onTap?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Renders the Material floating label above the border. */
  label?: string;
  backgroundColor?: string;
  autoFocus?: boolean;
  name?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

/**
 * Flutter `TextField`/`TextFormField` clone: 12 px radius default,
 * 1 px enabled border, 2 px #026AFD focus border, 16 px horizontal padding.
 */
export const FlutterInput = forwardRef<HTMLInputElement, FlutterInputProps>(
  (
    {
      value,
      onChange,
      hint,
      type = 'text',
      multiline = false,
      rows = 4,
      radius = 12,
      fill,
      border,
      focusedBorder = '#026AFD',
      textColor,
      fontSize = 16,
      fontWeight = 400,
      paddingX = 16,
      paddingY = 12,
      suffix,
      prefix,
      maxLength,
      readOnly = false,
      onTap,
      onFocus,
      onBlur,
      label,
      backgroundColor,
      autoFocus,
      name,
      inputMode,
    },
    ref
  ) => {
    const c = usePalette();
    const borderColor = border ?? (c.isDark ? '#2C2C2E' : '#E0E0E0');
    const fillColor = fill ?? (c.isDark ? '#1C1C1E' : '#F5F5F5');
    const color = textColor ?? c.text;

    return (
      <Box sx={{ position: 'relative', width: '100%' }}>
        {label && (
          <Box
            component="label"
            sx={{
              position: 'absolute',
              top: -8,
              left: 12,
              px: '4px',
              bgcolor: backgroundColor ?? c.scaffold,
              color: c.textHint,
              fontSize: 12,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            {label}
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: multiline ? 'flex-start' : 'center',
            width: '100%',
            bgcolor: fillColor,
            borderRadius: `${radius}px`,
            border: `1px solid ${borderColor}`,
            transition: 'border-color 120ms ease',
            px: `${paddingX}px`,
            py: `${paddingY}px`,
            '&:focus-within': {
              border: `2px solid ${focusedBorder}`,
              px: `${paddingX - 1}px`,
              py: `${paddingY - 1}px`,
            },
          }}
          onClick={onTap}
        >
          {prefix && <Box sx={{ mr: '8px', display: 'flex', color: c.textHint }}>{prefix}</Box>}
          {multiline ? (
            <Box
              ref={ref as any}
              component="textarea"
              name={name}
              rows={rows}
              value={value}
              maxLength={maxLength}
              readOnly={readOnly}
              placeholder={hint}
              onChange={(event) => onChange(event.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              sx={{
                flex: 1,
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                bgcolor: 'transparent',
                color,
                fontFamily: 'inherit',
                fontSize,
                fontWeight,
                lineHeight: 1.4,
                p: 0,
                m: 0,
                '&::placeholder': { color: c.textHint, opacity: 1 },
              }}
            />
          ) : (
            <Box
              ref={ref}
              component="input"
              name={name}
              type={type}
              inputMode={inputMode ?? (type === 'number' ? 'numeric' : type === 'email' ? 'email' : undefined)}
              value={value}
              maxLength={maxLength}
              readOnly={readOnly}
              placeholder={hint}
              autoFocus={autoFocus}
              onChange={(event) => onChange(event.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              sx={{
                flex: 1,
                width: '100%',
                border: 'none',
                outline: 'none',
                bgcolor: 'transparent',
                color,
                fontFamily: 'inherit',
                fontSize,
                fontWeight,
                lineHeight: 1.5,
                p: 0,
                m: 0,
                '&::placeholder': { color: c.textHint, opacity: 1 },
              }}
            />
          )}
          {suffix && <Box sx={{ ml: '8px', display: 'flex', color: c.textHint }}>{suffix}</Box>}
        </Box>
      </Box>
    );
  }
);

FlutterInput.displayName = 'FlutterInput';
