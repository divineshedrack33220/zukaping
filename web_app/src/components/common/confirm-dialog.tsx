import { ReactNode } from 'react';
import { Box, Dialog, Typography } from '@mui/material';
import { usePalette } from '../../contexts/app-theme.context';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  content?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Flutter price / delete-photo dialogs override the M3 28 radius with 20. */
  radius?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Material `AlertDialog` clone: dark `#1C1C1E`, 24 px headline, 14 px body,
 * right-aligned text actions (`#026AFD`, destructive `#F44336`).
 */
export const ConfirmDialog = ({
  open,
  title,
  content,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  radius = 28,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const c = usePalette();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 360,
          borderRadius: `${radius}px`,
          bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
          color: c.text,
          p: '24px',
          backgroundImage: 'none',
        },
      }}
      sx={{ borderRadius: radius }}
    >
      <Typography
        sx={{
          fontSize: 24,
          fontWeight: 400,
          lineHeight: 1.33,
          color: c.text,
        }}
      >
        {title}
      </Typography>
      {content != null && (
        <Box
          sx={{
            mt: '16px',
            fontSize: 14,
            lineHeight: 1.43,
            color: c.textSecondary,
            '& p': { margin: 0 },
          }}
        >
          {content}
        </Box>
      )}
      <Box
        sx={{
          mt: '24px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '8px',
          mx: '-8px',
          mb: '-10px',
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          onClick={onCancel}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onCancel();
          }}
          sx={{
            px: '12px',
            py: '10px',
            borderRadius: '8px',
            fontSize: 14,
            fontWeight: 500,
            color: '#026AFD',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { bgcolor: 'rgba(2,106,253,0.08)' },
          }}
        >
          {cancelLabel}
        </Box>
        <Box
          role="button"
          tabIndex={0}
          onClick={onConfirm}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onConfirm();
          }}
          sx={{
            px: '12px',
            py: '10px',
            borderRadius: '8px',
            fontSize: 14,
            fontWeight: danger ? 700 : 500,
            color: danger ? '#F44336' : '#026AFD',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': {
              bgcolor: danger ? 'rgba(244,67,54,0.08)' : 'rgba(2,106,253,0.08)',
            },
          }}
        >
          {confirmLabel}
        </Box>
      </Box>
    </Dialog>
  );
};
