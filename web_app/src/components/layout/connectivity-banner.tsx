import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';

/**
 * `NetworkWrapper` from mobile_app/lib/widgets/network_wrapper.dart.
 *
 * Flutter stacks the banner above an `Expanded` child, so rendering this
 * component before the screen content reproduces the push-down behaviour.
 */
export const ConnectivityBanner = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const goOffline = () => {
      setOnline(false);
      setShowReconnected(false);
    };
    const goOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setShowReconnected(false), 3000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (online && !showReconnected) return null;

  const offline = !online;

  return (
    <Box
      sx={{
        flexShrink: 0,
        bgcolor: offline ? '#FF453A' : '#34C759',
        color: '#FFFFFF',
        pt: 'env(safe-area-inset-top)',
        px: '16px',
        py: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {offline ? (
        <WifiOffRoundedIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
      ) : (
        <BoltRoundedIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
      )}
      <Box
        component="span"
        sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.2px', lineHeight: '16px' }}
      >
        {offline ? 'Offline Mode — Browsing Cached Data' : 'Back Online — Syncing Zukaping...'}
      </Box>
    </Box>
  );
};
