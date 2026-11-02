import React, { useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { usePalette } from '../../contexts/app-theme.context';
import { FlutterSheet } from './flutter-sheet';
import { PRIMARY } from '../../styles/tokens';

interface ImageSourceSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (files: File[]) => void;
  title?: string;
  multiple?: boolean;
}

export const ImageSourceSheet: React.FC<ImageSourceSheetProps> = ({
  open,
  onClose,
  onPick,
  title = 'Upload Photo',
  multiple = false,
}) => {
  const c = usePalette();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onPick([file]);
      onClose();
    }
    // reset input so picking same file or re-triggering works
    e.target.value = '';
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onPick(files);
      onClose();
    }
    e.target.value = '';
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const triggerGallery = () => {
    galleryInputRef.current?.click();
  };

  return (
    <FlutterSheet
      open={open}
      onClose={onClose}
      background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      handle={false}
      padding={0}
    >
      <Box sx={{ px: '20px', pt: '12px', pb: '24px' }}>
        {/* Grab handle */}
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: '2px',
            bgcolor: c.isDark ? '#3A3A3C' : '#E0E0E0',
            mx: 'auto',
            mb: '16px',
          }}
        />

        {/* Title */}
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            textAlign: 'center',
            color: c.text,
            mb: '20px',
          }}
        >
          {title}
        </Typography>

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleCameraChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={handleGalleryChange}
        />

        {/* Options */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', mb: '20px' }}>
          {/* Camera Option */}
          <Box
            role="button"
            onClick={triggerCamera}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              p: '16px',
              borderRadius: '16px',
              bgcolor: c.isDark ? '#2C2C2E' : '#F5F7FA',
              border: `1px solid ${c.isDark ? '#3A3A3C' : '#E8EDF2'}`,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: c.isDark ? '#353538' : '#EDF2F7',
              },
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(2,106,253,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PhotoCameraRoundedIcon sx={{ fontSize: 26, color: PRIMARY }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: c.text }}>
                Take Photo
              </Typography>
              <Typography sx={{ fontSize: 13, color: c.isDark ? '#9E9E9E' : '#757575', mt: 0.25 }}>
                Use your device camera
              </Typography>
            </Box>
          </Box>

          {/* Gallery Option */}
          <Box
            role="button"
            onClick={triggerGallery}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              p: '16px',
              borderRadius: '16px',
              bgcolor: c.isDark ? '#2C2C2E' : '#F5F7FA',
              border: `1px solid ${c.isDark ? '#3A3A3C' : '#E8EDF2'}`,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: c.isDark ? '#353538' : '#EDF2F7',
              },
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(2,106,253,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PhotoLibraryRoundedIcon sx={{ fontSize: 26, color: PRIMARY }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: c.text }}>
                Choose from Gallery
              </Typography>
              <Typography sx={{ fontSize: 13, color: c.isDark ? '#9E9E9E' : '#757575', mt: 0.25 }}>
                Select from your photo library or files
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Cancel Button */}
        <Button
          fullWidth
          variant="outlined"
          onClick={onClose}
          startIcon={<CloseRoundedIcon />}
          sx={{
            height: 48,
            borderRadius: '14px',
            borderColor: c.isDark ? '#3A3A3C' : '#E0E0E0',
            color: c.text,
            fontSize: 15,
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': {
              borderColor: c.isDark ? '#48484A' : '#BDBDBD',
              bgcolor: c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            },
          }}
        >
          Cancel
        </Button>
      </Box>
    </FlutterSheet>
  );
};

interface ImageSourceRequest {
  onPick: (files: File[]) => void;
  title?: string;
  multiple?: boolean;
}

/**
 * Asks which source the image should come from before opening a picker, so a
 * screen only needs `requestImage()` at its trigger and `{sheet}` in its JSX.
 */
export const useImageSourceSheet = (): {
  requestImage: (request: ImageSourceRequest) => void;
  sheet: React.ReactElement | null;
} => {
  const [pending, setPending] = useState<ImageSourceRequest | null>(null);

  const choose = (files: File[]) => {
    const request = pending;
    setPending(null);
    request?.onPick(files);
  };

  const sheet = pending ? (
    <ImageSourceSheet
      open
      title={pending.title ?? 'Upload Photo'}
      multiple={pending.multiple ?? false}
      onClose={() => setPending(null)}
      onPick={choose}
    />
  ) : null;

  return { requestImage: setPending, sheet };
};
