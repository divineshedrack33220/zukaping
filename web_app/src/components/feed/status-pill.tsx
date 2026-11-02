import { Box } from '@mui/material';
import { usePalette } from '../../contexts/app-theme.context';

interface StatusPillProps {
  label: string;
  dot: string;
  onClick: () => void;
  /** Chats renders ghost/Stealth at 60 % opacity. */
  opacity?: number;
}

/** `_buildStatusIndicator` — 12 px dot + 14/w600 label in a 20-radius pill. */
export const StatusPill = ({ label, dot, onClick, opacity = 1 }: StatusPillProps) => {
  const c = usePalette();
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Status: ${label}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
      sx={{
        mr: '16px',
        px: '12px',
        py: '6px',
        borderRadius: '20px',
        bgcolor: c.isDark ? '#1C1C1E' : '#F5F5F5',
        border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        opacity,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: dot,
          flexShrink: 0,
        }}
      />
      <Box
        component="span"
        sx={{
          ml: '8px',
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.43,
          color: c.text,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Box>
    </Box>
  );
};
