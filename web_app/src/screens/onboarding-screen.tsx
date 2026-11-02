import { ReactNode, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface PageData {
  title: string;
  description: string;
  color: string;
}

const PAGES: PageData[] = [
  {
    title: 'Connect Instantly',
    description:
      'Experience lightning-fast messaging with a premium glassmorphic interface designed for clarity.',
    color: '#026AFD',
  },
  {
    title: 'Nearby Magic',
    description:
      'Find interesting people exactly where you are. Real-time proximity discovery at your fingertips.',
    color: '#6C63FF',
  },
  {
    title: 'Safe & Secure',
    description:
      'Your privacy is our priority. Advanced blocking and encryption keep your conversations yours.',
    color: '#00C896',
  },
];

/* ------------------------- animated illustrations ------------------------ */

/**
 * Element-for-element ports of `_IllustrationPainter`
 * (onboarding_screen.dart:294-535): each page draws inside the 260 px
 * circle with SVG primitives, and the painter's `progress` (0→1 over 4 s,
 * onboarding_screen.dart:236-239) is reproduced with 4 s CSS loops.
 */
const HubIllustration = ({ color }: { color: string }) => (
  <Box
    component="svg"
    viewBox="0 0 260 260"
    sx={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      /* painter loop: rings expand over 4 s, bubbles drift ±10 px sinusoidally */
      '@keyframes onb-ring': {
        from: { r: '0px', opacity: 0.4 },
        to: { r: '110px', opacity: 0 },
      },
      '@keyframes onb-drift': {
        '0%': { transform: 'translateY(0px)' },
        '12.5%': { transform: 'translateY(7.07px)' },
        '25%': { transform: 'translateY(10px)' },
        '37.5%': { transform: 'translateY(7.07px)' },
        '50%': { transform: 'translateY(0px)' },
        '62.5%': { transform: 'translateY(-7.07px)' },
        '75%': { transform: 'translateY(-10px)' },
        '87.5%': { transform: 'translateY(-7.07px)' },
        '100%': { transform: 'translateY(0px)' },
      },
    }}
  >
    {/* 3 concentric signal rings — r 0→110, opacity 0.4→0, phase-shifted ⅓
        (painter: `ringProgress = (progress + i / 3) % 1`), stroke stays 2 */}
    {[0, 1, 2].map((i) => (
      <Box
        component="circle"
        key={`onb-ring-${i}`}
        cx={130}
        cy={130}
        r={110}
        fill="none"
        stroke={color}
        strokeWidth={2}
        sx={{
          animation: 'onb-ring 4s linear infinite',
          animationDelay: `${(-(i * 4) / 3).toFixed(4)}s`,
        }}
      />
    ))}

    {/* connection lines */}
    <line x1={130} y1={130} x2={80} y2={165} stroke={color} strokeOpacity={0.25} strokeWidth={1.5} />
    <line x1={130} y1={130} x2={175} y2={80} stroke={color} strokeOpacity={0.25} strokeWidth={1.5} />

    {/* central core */}
    <circle cx={130} cy={130} r={12} fill={color} />
    <circle cx={130} cy={130} r={6} fill="#FFFFFF" />

    {/* left chat bubble drifting ±10 px (`sin(progress·2π)·10`) */}
    <Box
      component="g"
      sx={{
        animation: 'onb-drift 4s linear infinite',
      }}
    >
      <rect
        x={40}
        y={90}
        width={64}
        height={32}
        rx={10}
        fill="#FFFFFF"
        fillOpacity={0.92}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1.8}
      />
      <path
        d="M80 122 L90 122 L85 128 Z"
        fill="#FFFFFF"
        fillOpacity={0.92}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1.8}
      />
      <circle cx={72} cy={106} r={3} fill={color} />
    </Box>

    {/* right chat bubble (`cos(progress·2π)·10` = ¼-cycle later) */}
    <Box
      component="g"
      sx={{
        animation: 'onb-drift 4s linear infinite',
        animationDelay: '-1s',
      }}
    >
      <rect
        x={155}
        y={140}
        width={64}
        height={32}
        rx={10}
        fill="#FFFFFF"
        fillOpacity={0.92}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1.8}
      />
      <path
        d="M170 140 L180 140 L175 134 Z"
        fill="#FFFFFF"
        fillOpacity={0.92}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1.8}
      />
      <circle cx={187} cy={156} r={3} fill={color} />
    </Box>
  </Box>
);

/**
 * `pageIndex == 1` — nearby radar (onboarding_screen.dart:409-470):
 * 3 thin static rings, full crosshairs, one rotating sweep line and three
 * pulsing user dots in their own colours (two pulse cycles per 4 s loop).
 */
const RadarIllustration = ({ color }: { color: string }) => (
  <Box
    component="svg"
    viewBox="0 0 260 260"
    sx={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      '@keyframes onb-radar-sweep': {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' },
      },
      '@keyframes onb-user-pulse': {
        from: { r: '10px', opacity: 0.6 },
        to: { r: '18px', opacity: 0 },
      },
    }}
  >
    {/* thin static rings — r 30 / 65 / 100, 1 px, opacity 0.15 */}
    {[30, 65, 100].map((radius) => (
      <circle
        key={`radar-circle-${radius}`}
        cx={130}
        cy={130}
        r={radius}
        fill="none"
        stroke={color}
        strokeOpacity={0.15}
        strokeWidth={1}
      />
    ))}

    {/* full crosshairs */}
    <line x1={20} y1={130} x2={240} y2={130} stroke={color} strokeOpacity={0.15} strokeWidth={1} />
    <line x1={130} y1={20} x2={130} y2={240} stroke={color} strokeOpacity={0.15} strokeWidth={1} />

    {/* sweep line — 2.2 px, opacity 0.7, one revolution per loop */}
    <Box
      component="g"
      sx={{
        animation: 'onb-radar-sweep 4s linear infinite',
        transformBox: 'view-box',
        transformOrigin: '130px 130px',
      }}
    >
      <line x1={130} y1={130} x2={230} y2={130} stroke={color} strokeOpacity={0.7} strokeWidth={2.2} />
    </Box>

    {/* pulsing nearby users — pulseVal = (progress·2 + i·0.3) % 1 */}
    {[
      { x: 95, y: 90, dot: '#026AFD' },
      { x: 180, y: 155, dot: '#FFFF00' },
      { x: 75, y: 180, dot: '#6C63FF' },
    ].map((user, i) => (
      <g key={user.dot}>
        <Box
          component="circle"
          cx={user.x}
          cy={user.y}
          r={10}
          fill="none"
          stroke={user.dot}
          strokeWidth={1.5}
          sx={{
            animation: 'onb-user-pulse 2s linear infinite',
            animationDelay: `${(-0.6 * i).toFixed(4)}s`,
          }}
        />
        <circle cx={user.x} cy={user.y} r={5} fill={user.dot} />
      </g>
    ))}

    {/* central pulse marker Ø14 */}
    <circle cx={130} cy={130} r={7} fill={color} />
  </Box>
);

const ShieldIllustration = ({ color }: { color: string }) => (
  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
    <Box
      component="svg"
      viewBox="0 0 120 140"
      sx={{
        width: 120,
        height: 140,
        filter: `drop-shadow(0 8px 16px ${color}44)`,
        animation: 'onb-shield 4s ease-in-out infinite',
        '@keyframes onb-shield': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      }}
    >
      <path
        d="M60 4 L112 24 V66 C112 100 88 124 60 136 C32 124 8 100 8 66 V24 Z"
        fill={`${color}22`}
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M60 20 L98 35 V66 C98 92 80 112 60 122 C40 112 22 92 22 66 V35 Z"
        fill={`${color}14`}
        stroke={`${color}55`}
        strokeWidth="1.5"
      />
      <rect x="44" y="60" width="32" height="26" rx="5" fill={color} />
      <path d="M50 60 V52 a10 10 0 0 1 20 0 V60" fill="none" stroke={color} strokeWidth="4" />
      <circle cx="60" cy="72" r="3.5" fill="#FFFFFF" />
    </Box>
    {[
      { left: 42, top: 62, size: 8 },
      { left: 198, top: 88, size: 10 },
      { left: 172, top: 186, size: 7 },
      { left: 62, top: 192, size: 6 },
    ].map((dot, index) => (
      <Box
        key={`${dot.left}-${dot.top}`}
        sx={{
          position: 'absolute',
          left: dot.left,
          top: dot.top,
          width: dot.size,
          height: dot.size,
          borderRadius: '50%',
          bgcolor: `${color}66`,
          animation: 'onb-sparkle 4s ease-in-out infinite',
          animationDelay: `${index * 0.7}s`,
          '@keyframes onb-sparkle': {
            '0%,100%': { opacity: 0.2, transform: 'scale(0.8)' },
            '50%': { opacity: 1, transform: 'scale(1.4)' },
          },
        }}
      />
    ))}
  </Box>
);

const ILLUSTRATIONS: ((props: { color: string }) => ReactNode)[] = [
  HubIllustration,
  RadarIllustration,
  ShieldIllustration,
];

/**
 * `OnboardingScreen` (mobile_app/lib/screens/onboarding_screen.dart).
 * Always white, 3 swipeable pages, animated 260 px illustration,
 * progress bars at safe-top + 20 and bottom action stack.
 */
export const OnboardingScreen = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const touchStart = useRef<number | null>(null);

  const data = PAGES[page];

  const next = () => {
    if (page < PAGES.length - 1) {
      setPage(page + 1);
    } else {
      try {
        localStorage.setItem('has_seen_onboarding', 'true');
      } catch {}
      navigate('/signup');
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: '100dvh',
        bgcolor: '#FFFFFF',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current == null) return;
        const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStart.current;
        if (delta < -40 && page < PAGES.length - 1) setPage(page + 1);
        if (delta > 40 && page > 0) setPage(page - 1);
        touchStart.current = null;
      }}
    >
      {/* animated gradient blob */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${data.color}0D 0%, #FFFFFF 50%, ${data.color}1A 100%)`,
          transition: 'background 1s ease',
        }}
      />

      {/* swipeable page track */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          transform: `translateX(-${page * 100}%)`,
          transition: 'transform 500ms cubic-bezier(0.215,0.61,0.355,1)',
        }}
      >
        {PAGES.map((item, index) => {
          const Illustration = ILLUSTRATIONS[index];
          return (
            <Box
              key={item.title}
              sx={{
                minWidth: '100%',
                width: '100%',
                px: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pb: '180px',
                pt: '100px',
              }}
            >
              <Box
                sx={{
                  width: 260,
                  height: 260,
                  flexShrink: 0,
                  borderRadius: '50%',
                  bgcolor: `${item.color}0F`,
                  boxShadow: `0 0 0 5px ${item.color}08, 0 0 20px ${item.color}08`,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Illustration color={item.color} />
              </Box>

              <Box sx={{ height: 50 }} />

              <Box
                component="h1"
                sx={{
                  m: 0,
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: '-1px',
                  color: '#1A1A2E',
                  textAlign: 'center',
                  lineHeight: 1.15,
                }}
              >
                {item.title}
              </Box>

              <Box sx={{ height: 20 }} />

              <Box
                sx={{
                  fontSize: 16,
                  color: '#757575',
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                {item.description}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* progress bars */}
      <Box
        sx={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 20px)',
          left: 24,
          right: 24,
          display: 'flex',
        }}
      >
        {PAGES.map((item, index) => (
          <Box
            key={item.title}
            sx={{
              flex: 1,
              height: 4,
              mx: '4px',
              borderRadius: '2px',
              bgcolor: page >= index ? data.color : '#EEEEEE',
              transition: 'background-color 300ms ease',
            }}
          />
        ))}
      </Box>

      {/* bottom actions */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom) + 30px)',
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          onClick={next}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') next();
          }}
          sx={{
            width: '100%',
            height: 60,
            borderRadius: '20px',
            bgcolor: data.color,
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: 700,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background-color 300ms ease',
          }}
        >
          {page === PAGES.length - 1 ? 'Get Started' : 'Continue'}
        </Box>

        <Box sx={{ height: 20 }} />

        <Box
          sx={{ textAlign: 'center', fontSize: 14, color: '#757575', cursor: 'pointer' }}
          onClick={() => {
            try {
              localStorage.setItem('has_seen_onboarding', 'true');
            } catch {}
            navigate('/login');
          }}
        >
          Already have an account?{' '}
          <Box component="span" sx={{ color: data.color, fontWeight: 700 }}>
            Log In
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
