import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { usePalette } from '../../contexts/app-theme.context';

/** CSS approximation of `Shimmer.fromColors` (period 1500 ms, L→R). */
export const Shimmer = ({ children }: { children: ReactNode }) => {
  const c = usePalette();
  return (
    <Box
      sx={{
        position: 'relative',
        '& .shimmer-block': {
          background: `linear-gradient(90deg, ${c.isDark ? '#2C2C2E' : '#EEEEEE'} 25%, ${
            c.isDark ? '#1C1C1E' : '#F5F5F5'
          } 37%, ${c.isDark ? '#2C2C2E' : '#EEEEEE'} 63%)`,
          backgroundSize: '400% 100%',
          animation: 'flutter-shimmer 1500ms linear infinite',
        },
        '@keyframes flutter-shimmer': {
          '0%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      }}
    >
      {children}
    </Box>
  );
};

interface ShimmerBoxProps {
  width?: number | string;
  height: number;
  radius?: number;
  sx?: object;
}

export const ShimmerBox = ({ width = '100%', height, radius = 4, sx }: ShimmerBoxProps) => (
  <Box className="shimmer-block" sx={{ width, height, borderRadius: `${radius}px`, ...sx }} />
);
