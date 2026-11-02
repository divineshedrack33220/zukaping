import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { wsService } from '../services/ws.service';

const PHRASES = [
  'Connect in Realtime',
  'Meet nearby people instantly',
  'Real-time social discovery',
  'Hang out now',
];

/**
 * `SplashScreen` (mobile_app/lib/screens/splash_screen.dart).
 * White page, 120 px logo fading/scaling in, rotating tagline, 48 px
 * double-ring loader. Auth check after 2 s, 5 s hard fallback.
 */
export const SplashScreen = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const mounted = useRef(true);
  const navigated = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Tagline rotation: 3 s visible → 500 ms fade out → next + fade in.
  useEffect(() => {
    let hideTimer: number;
    let showTimer: number;
    let loopTimer: number;

    const schedule = () => {
      hideTimer = window.setTimeout(() => {
        if (!mounted.current) return;
        setVisible(false);
        showTimer = window.setTimeout(() => {
          if (!mounted.current) return;
          setPhraseIndex((index) => (index + 1) % PHRASES.length);
          setVisible(true);
          loopTimer = window.setTimeout(schedule, 3000);
        }, 500);
      }, 3000);
    };
    schedule();

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(showTimer);
      window.clearTimeout(loopTimer);
    };
  }, []);

  const go = (path: string) => {
    if (navigated.current) return;
    navigated.current = true;
    navigate(path, { replace: true });
  };

  useEffect(() => {
    let fallback: number | undefined;

    const check = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      if (!mounted.current) return;
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        go('/onboarding');
        return;
      }
      try {
        const profile = await apiService.getProfile();
        if (profile?.id) {
          wsService.connect(token);
          go('/feed');
        } else {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          go('/onboarding');
        }
      } catch {
        const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
        if (userId) {
          wsService.connect(token);
          go('/feed');
        } else {
          go('/onboarding');
        }
      }
      // Flutter arms the 5 s fallback only once the token/profile check has
      // completed (splash_screen.dart:133-138), not at mount.
      fallback = window.setTimeout(() => go('/onboarding'), 5000);
    };

    void check();
    return () => {
      if (fallback !== undefined) window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phrase = PHRASES[phraseIndex];
  const words = phrase.split(' ');
  const highlight = Math.min(3, words.length);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: '100dvh',
        bgcolor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          px: 3,
          py: '10px',
        }}
      >
        <Box
          component="img"
          src="/logo.png"
          alt="Zukaping"
          sx={{
            width: 120,
            height: 120,
            objectFit: 'contain',
            opacity: 0,
            transform: 'scale(0.8)',
            animation:
              'splash-logo 1500ms ease-in forwards, splash-scale 1500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards',
            '@keyframes splash-logo': { from: { opacity: 0 }, to: { opacity: 1 } },
            '@keyframes splash-scale': {
              from: { transform: 'scale(0.8)' },
              to: { transform: 'scale(1)' },
            },
          }}
        />

        <Box sx={{ height: 40 }} />

        <Box
          sx={{
            fontSize: 20,
            lineHeight: 1.45,
            letterSpacing: '0.3px',
            color: '#666666',
            textAlign: 'center',
            opacity: visible ? 0.9 : 0,
            transition: 'opacity 500ms ease',
            minHeight: 29,
          }}
        >
          {words.map((word, index) => (
            <Box
              component="span"
              key={`${word}-${index}`}
              sx={
                index < highlight
                  ? { fontWeight: 700, color: '#026AFD' }
                  : { fontWeight: 400 }
              }
            >
              {`${word} `}
            </Box>
          ))}
        </Box>

        <Box sx={{ height: 40 }} />

        <Box
          sx={{
            width: 48,
            height: 48,
            position: 'relative',
          }}
        >
          {/* `_LoaderPainter` (splash_screen.dart:255-280): static concentric
              rings, stroke 2 straddling r=12 (outer Ø26) and r=18 (outer Ø38). */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 26,
              height: 26,
              marginLeft: '-13px',
              marginTop: '-13px',
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: '2px solid #026AFD',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 38,
              height: 38,
              marginLeft: '-19px',
              marginTop: '-19px',
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: '2px solid rgba(2,106,253,0.5)',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
