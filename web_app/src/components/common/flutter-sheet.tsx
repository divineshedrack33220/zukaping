import { ReactNode } from 'react';
import { Box, Drawer } from '@mui/material';
import { usePalette } from '../../contexts/app-theme.context';

interface FlutterSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Flutter modal sheets default to a 24 px top radius. */
  radius?: number;
  maxHeight?: string;
  background?: string;
  padding?: number | string;
  /** Flutter sheets that draw their own 48×5 grab handle pass `false`. */
  handle?: boolean;
}

/** `showModalBottomSheet` clone, constrained to the 430 px handset frame. */
export const FlutterSheet = ({
  open,
  onClose,
  children,
  radius = 24,
  maxHeight = '92dvh',
  background,
  padding,
  handle = true,
}: FlutterSheetProps) => {
  const c = usePalette();
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 430,
          mx: 'auto',
          maxHeight,
          bgcolor: background ?? c.scaffold,
          color: c.text,
          borderTopLeftRadius: `${radius}px`,
          borderTopRightRadius: `${radius}px`,
          overflowY: 'auto',
          p: padding,
          backgroundImage: 'none',
          '&::before': handle
            ? {
                content: '""',
                display: 'block',
                width: 40,
                height: 4,
                borderRadius: 2,
                bgcolor: c.isDark ? '#3A3A3C' : '#E0E0E0',
                margin: '10px auto 0',
              }
            : undefined,
        },
      }}
      sx={{ zIndex: 1300 }}
    >
      <Box>{children}</Box>
    </Drawer>
  );
};
