import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { usePalette } from '../../contexts/app-theme.context';

/**
 * Phone-sized app surface. Flutter runs full-bleed; on a desktop browser we
 * keep a 430 px handset-width column centred on a neutral canvas so the pixel
 * metrics of the Flutter layout are preserved.
 */
export const MobileFrame = ({ children }: { children: ReactNode }) => {
  const c = usePalette();
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        width: '100%',
        bgcolor: { xs: c.scaffold, sm: c.isDark ? '#000000' : '#EDEDED' },
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 430,
          minHeight: '100dvh',
          bgcolor: c.scaffold,
          color: c.text,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: { xs: 'none', sm: '0 0 40px rgba(0,0,0,0.45)' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
