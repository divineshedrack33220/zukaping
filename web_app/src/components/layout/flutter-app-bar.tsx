import { ReactNode } from 'react';
import { Box } from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import { useNavigate } from 'react-router-dom';
import { usePalette } from '../../contexts/app-theme.context';

interface FlutterAppBarProps {
  title?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  backgroundColor?: string;
  height?: number;
  /** Flutter AppBar elevation 0 (no shadow) — optionally add hairline. */
  borderBottom?: boolean;
}

/**
 * Material `AppBar` clone: 56 dp tall, centred title (M3 titleLarge 22/400),
 * 56 dp leading slot, elevation 0.
 */
export const FlutterAppBar = ({
  title,
  leading,
  actions,
  showBack = false,
  onBack,
  backgroundColor,
  height = 56,
  borderBottom = false,
}: FlutterAppBarProps) => {
  const c = usePalette();
  const navigate = useNavigate();

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        height,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: backgroundColor ?? c.appBar,
        color: c.text,
        borderBottom: borderBottom ? `1px solid ${c.border}` : 'none',
        zIndex: 20,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {leading ??
          (showBack ? (
            <Box
              role="button"
              aria-label="Back"
              tabIndex={0}
              onClick={() => (onBack ? onBack() : navigate(-1))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (onBack ? onBack() : navigate(-1));
              }}
              sx={{
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ArrowBackIosNewRoundedIcon sx={{ fontSize: 20 }} />
            </Box>
          ) : null)}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          left: 56,
          right: 56,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {typeof title === 'string' ? (
          <Box
            component="h1"
            sx={{
              m: 0,
              fontSize: 22,
              fontWeight: 400,
              lineHeight: '28px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'inherit',
            }}
          >
            {title}
          </Box>
        ) : (
          title
        )}
      </Box>

      <Box
        sx={{
          minWidth: 56,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
      >
        {actions}
      </Box>
    </Box>
  );
};
