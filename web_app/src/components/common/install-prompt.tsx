import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Box } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import IosShareIcon from '@mui/icons-material/IosShare';
import AndroidShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { usePalette } from '../../contexts/app-theme.context';
import { AppLogo } from './app-logo';
import { FlutterSheet } from './flutter-sheet';
import { PRIMARY } from '../../styles/tokens';
import {
  dismissInstallPrompt,
  getInstallState,
  runInstall,
  subscribeInstall,
  type Platform,
} from '../../utils/pwa-install';

/** `Share → Add to Home Screen`, spelled out for the browsers that hide it. */
const STEPS: Record<Platform, { icon: ReactNode; title: string; body: string }[]> = {
  ios: [
    {
      icon: <IosShareIcon sx={{ fontSize: 18 }} />,
      title: 'Tap Share',
      body: 'It sits in the bar along the bottom of Safari.',
    },
    {
      icon: <span style={{ fontSize: 15, fontWeight: 700 }}>+</span>,
      title: 'Choose Add to Home Screen',
      body: 'Scroll the menu down to find it.',
    },
    {
      icon: <span style={{ fontSize: 15, fontWeight: 700 }}>✓</span>,
      title: 'Tap Add',
      body: 'Zukaping lands on your home screen.',
    },
  ],
  android: [
    {
      icon: <MoreVertIcon sx={{ fontSize: 18 }} />,
      title: 'Open the menu',
      body: 'The three dots at the top right.',
    },
    {
      icon: <AndroidShareIcon sx={{ fontSize: 18 }} />,
      title: 'Tap Add to Home screen',
      body: 'Chrome will ask you to confirm.',
    },
    {
      icon: <span style={{ fontSize: 15, fontWeight: 700 }}>✓</span>,
      title: 'Tap Add',
      body: 'Zukaping lands on your home screen.',
    },
  ],
  desktop: [
    {
      icon: <MoreVertIcon sx={{ fontSize: 18 }} />,
      title: 'Open the browser menu',
      body: 'Top right, next to your profile.',
    },
    {
      icon: <AndroidShareIcon sx={{ fontSize: 18 }} />,
      title: 'Choose Install Zukaping',
      body: 'Some browsers put the icon in the address bar.',
    },
  ],
};

const PERKS = [
  { icon: <BoltIcon sx={{ fontSize: 17 }} />, text: 'Opens from your home screen' },
  { icon: <FullscreenIcon sx={{ fontSize: 17 }} />, text: 'Full screen, no browser bar' },
  { icon: <span style={{ fontSize: 14, fontWeight: 700 }}>↻</span>, text: 'Starts faster next time' },
];

/**
 * Install offer. Chrome hands us an event we can trigger, so the button is a
 * real one-tap install; everywhere else the sheet walks the visitor through the
 * browser menu instead of pretending it can do it for them.
 */
export const InstallPrompt = () => {
  const c = usePalette();
  const state = useSyncExternalStore(subscribeInstall, getInstallState, getInstallState);
  const [manual, setManual] = useState(false);

  const showSteps = manual || !state.canPrompt;
  const steps = STEPS[state.platform];

  return (
    <FlutterSheet
      open={state.visible && !state.installed}
      onClose={dismissInstallPrompt}
      background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      radius={24}
      handle={false}
    >
      <Box
        sx={{
          position: 'relative',
          px: '24px',
          pt: '22px',
          pb: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <Box
          role="button"
          aria-label="Not now"
          tabIndex={0}
          onClick={dismissInstallPrompt}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') dismissInstallPrompt();
          }}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: c.surface,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            color: c.textSecondary,
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            sx={{
              width: 62,
              height: 62,
              borderRadius: '18px',
              bgcolor: c.isDark ? '#232326' : '#F2F6FF',
              border: `1px solid ${c.border}`,
              boxShadow: c.isDark
                ? '0 10px 24px rgba(0,0,0,0.45)'
                : '0 10px 24px rgba(2,106,253,0.14)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <AppLogo size={42} />
          </Box>
        </Box>

        <Box
          sx={{
            mt: '12px',
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center',
            color: c.text,
          }}
        >
          Take Zukaping with you
        </Box>
        <Box
          sx={{
            mt: '6px',
            fontSize: 14.5,
            lineHeight: 1.45,
            textAlign: 'center',
            color: c.textSecondary,
          }}
        >
          One install and Zukaping opens from your home screen — no browser tabs, no hunting for
          the link.
        </Box>

        {!showSteps && (
        <Box
          sx={{
            mt: '14px',
            p: '12px',
            borderRadius: '16px',
            bgcolor: c.surface,
            border: `1px solid ${c.border}`,
          }}
        >
          {PERKS.map((perk, index) => (
            <Box
              key={perk.text}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                py: index === 1 ? '8px' : '3px',
                color: c.text,
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: '50%',
                  bgcolor: c.isDark ? 'rgba(2,106,253,0.18)' : 'rgba(2,106,253,0.1)',
                  color: PRIMARY,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {perk.icon}
              </Box>
              <Box sx={{ fontSize: 14, lineHeight: 1.35 }}>{perk.text}</Box>
            </Box>
          ))}
        </Box>
        )}

        {showSteps ? (
          <Box sx={{ mt: '14px' }}>
            <Box
              sx={{
                mb: '10px',
                fontSize: 13,
                lineHeight: 1.4,
                textAlign: 'center',
                color: c.textHint,
              }}
            >
              Home screen launch · full screen · opens faster next time
            </Box>
            {steps.map((step, index) => (
              <Box key={step.title} sx={{ display: 'flex', gap: '10px', py: '6px' }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: c.surfaceStrong,
                    color: c.text,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontSize: 14.5, fontWeight: 600, color: c.text, lineHeight: 1.35 }}>
                    {step.title}
                  </Box>
                  <Box sx={{ fontSize: 13, color: c.textHint, lineHeight: 1.35 }}>{step.body}</Box>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Box
            role="button"
            tabIndex={0}
            onClick={() => void runInstall()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') void runInstall();
            }}
            sx={{
              mt: '16px',
              height: 52,
              borderRadius: '26px',
              bgcolor: PRIMARY,
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(2,106,253,0.28)',
              userSelect: 'none',
            }}
          >
            Install app
          </Box>
        )}

        <Box
          role="button"
          tabIndex={0}
          onClick={() => (showSteps ? dismissInstallPrompt() : setManual(true))}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            if (showSteps) dismissInstallPrompt();
            else setManual(true);
          }}
          sx={{
            mt: showSteps ? '12px' : '4px',
            py: '8px',
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 600,
            color: showSteps ? c.textSecondary : PRIMARY,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {showSteps ? 'Not now' : 'Show me how instead'}
        </Box>
      </Box>
    </FlutterSheet>
  );
};
