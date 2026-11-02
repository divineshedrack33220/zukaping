import { useEffect, useRef } from 'react';
import { Box, Dialog } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';

interface FullScreenViewerProps {
  open: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * Flutter `_FullscreenViewer` / `_PhotoLightbox`: black page, swipeable
 * `PageView`, `BoxFit.contain`, 40 px close circle at top-right.
 */
export const FullScreenViewer = ({
  open,
  images,
  initialIndex = 0,
  onClose,
}: FullScreenViewerProps) => {
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      // Wait for the dialog to mount before snapping to the start page.
      const id = window.setTimeout(() => {
        const el = scroller.current;
        if (el) el.scrollLeft = initialIndex * el.clientWidth;
      }, 30);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open, initialIndex]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: '#000000',
          backgroundImage: 'none',
        },
      }}
    >
      <Box
        ref={scroller}
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {images.map((url, i) => (
          <Box
            key={`${url}-${i}`}
            sx={{
              minWidth: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Box
              component="img"
              src={url}
              alt=""
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(event) => {
                const target = event.currentTarget;
                target.style.display = 'none';
                target.nextElementSibling?.setAttribute('data-visible', 'true');
              }}
            />
            <BrokenImageIcon
              data-visible="false"
              sx={{
                display: 'none',
                fontSize: 80,
                color: '#9E9E9E',
                '&[data-visible="true"]': { display: 'block' },
              }}
            />
          </Box>
        ))}
      </Box>

      <Box
        role="button"
        aria-label="Close"
        onClick={onClose}
        sx={{
          position: 'fixed',
          top: 40,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: 'rgba(0,0,0,0.54)',
          border: '1px solid rgba(255,255,255,0.24)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 2,
        }}
      >
        <CloseIcon sx={{ fontSize: 24, color: '#FFFFFF' }} />
      </Box>
    </Dialog>
  );
};
