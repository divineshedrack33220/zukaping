import { Box } from '@mui/material';
import { PRIMARY } from '../../styles/tokens';

interface ScanFabProps {
  /** People found by the last scan; 0 hides the badge. */
  count: number;
  onScan: () => void;
}

/** The brand pin-and-smiley, redrawn as a knockout so it reads on the blue fill. */
const PinSmiley = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 1.8c-4.09 0-7.4 3.31-7.4 7.4 0 5.55 7.4 13.2 7.4 13.2s7.4-7.65 7.4-13.2c0-4.09-3.31-7.4-7.4-7.4Z"
      fill="#FFFFFF"
    />
    <circle cx="10.15" cy="7.5" r="1.02" fill={PRIMARY} />
    <circle cx="13.85" cy="7.5" r="1.02" fill={PRIMARY} />
    <path
      d="M9.7 9.9c.62 1.35 1.35 2.02 2.3 2.02s1.68-.67 2.3-2.02"
      stroke={PRIMARY}
      strokeWidth="1.35"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

/**
 * The 56 px scan button. It pulses on its own instead of waiting for the
 * overlay, so the one control that means "find people" looks alive on a quiet
 * feed.
 */
export const ScanFab = ({ count, onScan }: ScanFabProps) => (
  <Box
    role="button"
    aria-label="Scan nearby"
    tabIndex={0}
    onClick={onScan}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') onScan();
    }}
    sx={{
      position: 'absolute',
      bottom: 90,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: '50%',
      bgcolor: PRIMARY,
      boxShadow: '0 6px 20px rgba(2,106,253,0.35)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer',
      zIndex: 10,
      transition: 'transform 140ms ease-out',
      '&:active': { transform: 'scale(0.9)' },
      '&:focus-visible': { outline: '3px solid rgba(2,106,253,0.45)', outlineOffset: 3 },
    }}
  >
    {[0, 1].map((ring) => (
      <Box
        key={ring}
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px solid rgba(2,106,253,0.55)',
          pointerEvents: 'none',
          animation: `scan-fab-ripple 2800ms cubic-bezier(0.2,0.6,0.3,1) ${ring * 1400}ms infinite`,
        }}
      />
    ))}
    <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
      <PinSmiley />
      {count > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: -14,
            right: -16,
            minWidth: 20,
            minHeight: 20,
            px: '5px',
            borderRadius: '10px',
            bgcolor: '#F44336',
            display: 'grid',
            placeItems: 'center',
            border: '2px solid #FFFFFF',
          }}
        >
          <Box
            component="span"
            sx={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}
          >
            {count > 99 ? '99+' : count}
          </Box>
        </Box>
      )}
    </Box>
    <style>{`
      @keyframes scan-fab-ripple {
        0% { transform: scale(1); opacity: 0.85; }
        70% { opacity: 0; }
        100% { transform: scale(1.9); opacity: 0; }
      }
    `}</style>
  </Box>
);
