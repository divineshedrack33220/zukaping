import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { useImageSourceSheet } from '../components/common/image-source-sheet';
import { PRIMARY } from '../styles/tokens';

const CATEGORIES = [
  'Hangout',
  'Date',
  'Show me around',
  'Networking',
  'Casual Chat',
];

const DURATIONS = [
  { label: '30 mins', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '2 hrs', value: 120 },
];

export const CreatePostScreen: React.FC = () => {
  const navigate = useNavigate();
  const c = usePalette();
  const { showToast } = useSnackbar();

  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  const { requestImage, sheet } = useImageSourceSheet();

  const isFormValid =
    Boolean(selectedCategory) &&
    Boolean(selectedDuration) &&
    content.trim().length > 0 &&
    content.trim().length <= 120;

  const handlePickImages = (files: File[]) => {
    if (!files.length) return;

    const remainingSlots = 4 - selectedImageFiles.length;
    if (remainingSlots <= 0) {
      showToast('Maximum 4 images allowed');
      return;
    }

    const adding = files.slice(0, remainingSlots);
    const newPreviews = adding.map((f) => URL.createObjectURL(f));

    setSelectedImageFiles((prev) => [...prev, ...adding]);
    setSelectedImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImageFiles((prev) => prev.filter((_, i) => i !== index));
    setSelectedImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid || isPosting) return;

    setIsPosting(true);
    try {
      // Upload images first if any
      const uploadedUrls: string[] = [];
      for (const file of selectedImageFiles) {
        try {
          const url = await apiService.uploadImage(file);
          if (url) uploadedUrls.push(url);
        } catch {
          showToast('Failed to upload image');
          setIsPosting(false);
          return;
        }
      }

      await apiService.createPost({
        content: content.trim(),
        category: selectedCategory,
        duration: selectedDuration,
        media: uploadedUrls,
      });

      showToast('Request posted successfully!');
      navigate('/feed');
    } catch {
      showToast('Failed to post request');
    } finally {
      setIsPosting(false);
    }
  };

  const sectionTitle = (title: string) => (
    <Typography
      sx={{
        fontSize: 14,
        fontWeight: 600,
        color: c.isDark ? '#B0B0B0' : '#666666',
        mb: 1.5,
      }}
    >
      {title}
    </Typography>
  );

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: c.scaffold, overflow: 'hidden' }}>
      {/* ── AppBar (Flutter style) ── */}
      <Box
        component="header"
        sx={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          px: '12px',
          borderBottom: `1px solid ${c.isDark ? '#2C2C2E' : '#F0F0F0'}`,
          bgcolor: c.isDark ? '#121212' : '#FFFFFF',
          flexShrink: 0,
        }}
      >
        <IconButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          sx={{ color: c.isDark ? '#FFFFFF' : '#000000DE' }}
        >
          <ArrowBackIcon sx={{ fontSize: 22 }} />
        </IconButton>
        <Typography
          sx={{
            flex: 1,
            textAlign: 'center',
            fontWeight: 600,
            fontSize: 18,
            color: c.isDark ? '#FFFFFF' : '#000000DE',
            mr: '40px',
          }}
        >
          Post Request
        </Typography>
      </Box>

      {/* ── Form content ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ p: '24px 20px 40px' }}>
          {/* Category Section */}
          {sectionTitle('Category')}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '12px', mb: 4 }}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <Box
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  sx={{
                    px: '20px',
                    py: '12px',
                    borderRadius: '26px',
                    bgcolor: isSelected ? PRIMARY : c.isDark ? '#1C1C1E' : '#F5F5F5',
                    border: `1px solid ${isSelected ? PRIMARY : c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
                    color: isSelected
                      ? c.isDark
                        ? '#000000'
                        : '#FFFFFF'
                      : c.isDark
                      ? 'rgba(255,255,255,0.7)'
                      : 'rgba(0,0,0,0.87)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat}
                </Box>
              );
            })}
          </Box>

          {/* Request Text Section */}
          {sectionTitle('Your request')}
          <Box
            sx={{
              position: 'relative',
              borderRadius: '16px',
              bgcolor: c.isDark ? '#1C1C1E' : '#FAFAFA',
              border: `1px solid ${content.trim().length > 0 ? PRIMARY : c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
              mb: 4,
              overflow: 'hidden',
              transition: 'border-color 0.18s ease',
            }}
          >
            <Box
              component="textarea"
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              placeholder="Write a short message (max 120 chars)"
              maxLength={120}
              rows={5}
              sx={{
                width: '100%',
                p: '16px',
                pb: '36px',
                fontSize: 16,
                border: 'none',
                outline: 'none',
                resize: 'none',
                bgcolor: 'transparent',
                color: c.text,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                '&::placeholder': { color: '#8E8E8E' },
              }}
            />
            <Typography
              sx={{
                position: 'absolute',
                bottom: 12,
                right: 16,
                fontSize: 13,
                color: '#8E8E8E',
                pointerEvents: 'none',
              }}
            >
              {content.length}/120
            </Typography>
          </Box>

          {/* Duration Section */}
          {sectionTitle('Duration')}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '12px', mb: 4 }}>
            {DURATIONS.map((dur) => {
              const isSelected = selectedDuration === dur.value;
              return (
                <Box
                  key={dur.value}
                  onClick={() => setSelectedDuration(dur.value)}
                  sx={{
                    px: '20px',
                    py: '12px',
                    borderRadius: '26px',
                    bgcolor: isSelected ? PRIMARY : c.isDark ? '#1C1C1E' : '#F5F5F5',
                    border: `1px solid ${isSelected ? PRIMARY : c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
                    color: isSelected
                      ? c.isDark
                        ? '#000000'
                        : '#FFFFFF'
                      : c.isDark
                      ? 'rgba(255,255,255,0.7)'
                      : 'rgba(0,0,0,0.87)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {dur.label}
                </Box>
              );
            })}
          </Box>

          {/* Image Upload Section */}
          {sectionTitle('Photos (optional)')}
          <Box sx={{ display: 'flex', gap: '12px', flexWrap: 'wrap', mb: 5 }}>
            {selectedImagePreviews.map((preview, index) => (
              <Box key={index} sx={{ position: 'relative', width: 80, height: 80 }}>
                <Box
                  component="img"
                  src={preview}
                  alt=""
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
                  }}
                />
                <Box
                  onClick={() => handleRemoveImage(index)}
                  sx={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: '#FFFFFF',
                    border: '1px solid #ddd',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14, color: '#000000' }} />
                </Box>
              </Box>
            ))}

            {selectedImageFiles.length < 4 && (
              <Box
                onClick={() =>
                  requestImage({
                    title: 'Add photos',
                    multiple: true,
                    onPick: handlePickImages,
                  })
                }
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '12px',
                  bgcolor: c.isDark ? '#1C1C1E' : '#F5F5F5',
                  border: `1.5px dashed ${c.isDark ? '#2C2C2E' : '#CCCCCC'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover': { borderColor: PRIMARY },
                }}
              >
                <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 32, color: '#8E8E8E' }} />
              </Box>
            )}
          </Box>

          {/* Submit Button */}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={!isFormValid || isPosting}
            sx={{
              height: 52,
              borderRadius: '26px',
              bgcolor: PRIMARY,
              color: '#FFFFFF',
              fontSize: 17,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              '&:disabled': {
                bgcolor: 'rgba(2,106,253,0.3)',
                color: c.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.38)',
              },
            }}
          >
            {isPosting ? (
              <CircularProgress size={20} sx={{ color: '#FFFFFF' }} />
            ) : (
              'Post Request'
            )}
          </Button>

          {/* Note */}
          <Typography
            sx={{
              mt: 2,
              fontSize: 14,
              color: c.isDark ? '#9E9E9E' : '#666666',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            Your request will be visible to nearby users immediately.
          </Typography>
        </Box>
      </Box>

      {sheet}
    </Box>
  );
};
