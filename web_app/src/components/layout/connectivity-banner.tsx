import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';

/**
 * `NetworkWrapper` from mobile_app/lib/widgets/network_wrapper.dart.
 *
 * Flutter stacks the banner above an `Expanded` child, so rendering this
 * component before the screen content reproduces the push-down behaviour.
 */
export const ConnectivityBanner = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const moveTimer = useRef<number | undefined>(undefined);
  // The selector announces the host it picked on the very first request; only a
  // later switch is news worth interrupting the user for.
  const initialChoice = useRef(true);

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
      window.clearTimeout(moveTimer.current);
    };
  }, []);

  useEffect(() => {
    const onServerChange = (event: Event) => {
      if (initialChoice.current) {
        initialChoice.current = false;
        return;
      }
      const label = (event as CustomEvent).detail?.label || 'another server';
      setMovedTo(label);
      window.clearTimeout(moveTimer.current);
      moveTimer.current = window.setTimeout(() => setMovedTo(null), 5000);
    };
    window.addEventListener('server:changed', onServerChange);
    return () => {
      window.removeEventListener('server:changed', onServerChange);
      window.clearTimeout(moveTimer.current);
    };
  }, []);

  if (online && !showReconnected && !movedTo) return null;

  const offline = !online;
  const moved = Boolean(movedTo);

  return (
    <Box
      sx={{
        flexShrink: 0,
        bgcolor: offline ? '#FF453A' : moved ? '#FF9500' : '#34C759',
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
      ) : moved ? (
        <AutorenewRoundedIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
      ) : (
        <BoltRoundedIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
      )}
      <Box
        component="span"
        sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.2px', lineHeight: '16px' }}
      >
        {offline
          ? 'Offline Mode — Browsing Cached Data'
          : moved
            ? `Connected to ${movedTo} instead`
            : 'Back Online — Syncing Zukaping...'}
      </Box>
    </Box>
  );
};
