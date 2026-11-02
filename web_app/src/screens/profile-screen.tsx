import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsIcon from '@mui/icons-material/Settings';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useAppTheme, usePalette } from '../contexts/app-theme.context';
import { useAuth } from '../contexts/auth.context';
import { useMe } from '../contexts/me.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { wsService } from '../services/ws.service';
import { FlutterAppBar } from '../components/layout/flutter-app-bar';
import { FlutterSheet } from '../components/common/flutter-sheet';
import { ConfirmDialog } from '../components/common/confirm-dialog';
import { useImageSourceSheet } from '../components/common/image-source-sheet';
import { FullScreenViewer } from '../components/common/fullscreen-viewer';
import { AppLogo } from '../components/common/app-logo';
import { PRIMARY } from '../styles/tokens';
import type { ProfileImage } from '../models/chat.models';

const AVATAR_PLACEHOLDER = '#F5F5F5';

export const ProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const c = usePalette();
  const { mode, isDark, toggle } = useAppTheme();
  const { userId, logout } = useAuth();
  const { me, loading, refresh, setMe } = useMe();
  const { showToast } = useSnackbar();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInfo, setReferralInfo] = useState<{ referralCode: string | null; referralUrl: string | null }>({
    referralCode: null,
    referralUrl: null,
  });

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState<ProfileImage | null>(null);
  const [showPricePrompt, setShowPricePrompt] = useState(false);
  const [priceTargetId, setPriceTargetId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('500');

  const [fullscreenPhotos, setFullscreenPhotos] = useState<string[] | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const { requestImage, sheet } = useImageSourceSheet();

  const profile = me;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Flutter `_loadProfile`: keep the cached profile on failure, surface the
  // error state only when there is nothing to show.
  const loadProfile = useCallback(async () => {
    try {
      const data = await apiService.getProfile();
      setMe(data);
      setError(null);
    } catch {
      if (!profileRef.current) setError('Failed to load profile');
    } finally {
      setRefreshing(false);
    }
  }, [setMe]);

  useEffect(() => {
    void loadProfile();
    apiService
      .getReferralInfo()
      .then((info) => {
        // api.service falls back to the hardcoded 'ZUKAPING' code — Flutter only
        // renders what the endpoint really returned, otherwise '------'.
        if (info?.referralCode && info.referralCode !== 'ZUKAPING') {
          setReferralInfo({
            referralCode: info.referralCode,
            referralUrl: info.referralUrl || `https://zukaping.app/join?ref=${info.referralCode}`,
          });
        }
      })
      .catch(() => undefined);
  }, [loadProfile]);

  useEffect(() => {
    return wsService.subscribe(({ type, payload }) => {
      if (type === 'new_message') {
        if (payload?.senderId !== userId) {
          showToast(`📩 New message from ${payload?.senderName ?? 'Someone'}`);
        }
      } else if (type === 'post_accepted') {
        if (payload?.userId !== userId) {
          showToast(`🤝 Request accepted by ${payload?.userName ?? 'Someone'}`);
        }
      } else if (type === 'post_favorited') {
        if (payload?.userId !== userId) {
          showToast('⭐ Someone favorited your request');
        }
      }
    });
  }, [showToast, userId]);

  const profileImages = profile?.profileImages ?? [];
  const profileImageUrls = new Set((profileImages ?? []).map((p) => p.url));
  const legacyPhotos = (profile?.photos ?? []).filter((u) => u && !profileImageUrls.has(u));

  const allPhotos = [
    ...(profileImages ?? []).map((p) => ({ url: p.url, image: p })),
    ...legacyPhotos.map((url) => ({ url, image: undefined })),
  ].filter((entry) => Boolean(entry.url));

  const effectiveAvatar = profile?.avatar || allPhotos[0]?.url || null;

  const handle = (profile?.name || 'user').toLowerCase().replace(/\s+/g, '');

  const handleAvatarFile = async (file: File) => {
    try {
      const url = await apiService.uploadImage(file);
      if (url) {
        await apiService.updateProfile({ avatar: url });
        showToast('Profile photo updated!');
        await refresh();
      } else {
        showToast('Failed to update photo');
      }
    } catch {
      showToast('Failed to update photo');
    }
  };

  const handlePhotoFile = async (file: File) => {
    // Flutter `_pickAndUploadProfileImage` flips `_isLoading` → shimmer.
    setUploading(true);
    try {
      const res = await apiService.uploadProfileImage(file);
      if (res) {
        showToast('Image uploaded successfully!');
        await refresh();
        // The owner is asked for the price while the upload is fresh; cancel
        // leaves the photo public, exactly like the manage sheet default.
        setPriceTargetId(res.id);
        setPriceInput('500');
        setShowPricePrompt(true);
      } else {
        const url = await apiService.uploadImage(file);
        if (url) {
          const currentPhotos = profile?.photos ?? [];
          await apiService.updateProfile({ photos: [...currentPhotos, url] });
          showToast('Image uploaded successfully!');
          await refresh();
        }
      }
    } catch {
      showToast('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    const shareUrl = `https://zukaping.app/@${handle}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.name}'s Profile on Zukaping`,
          text: `Check out my profile on Zukaping!\nLet's connect: ${shareUrl}`,
          url: shareUrl,
        });
      } catch {
        /* canceled */
      }
    } else {
      await navigator.clipboard?.writeText(shareUrl);
      showToast('Profile link copied to clipboard!');
    }
  };

  const handleCopyReferral = () => {
    if (!referralInfo.referralUrl) {
      showToast('Referral link not available');
      return;
    }
    void navigator.clipboard?.writeText(referralInfo.referralUrl);
    showToast('Referral link copied!');
  };

  const handleShareReferral = async () => {
    if (!referralInfo.referralUrl) {
      showToast('Referral link not available');
      return;
    }
    const text = `🎁 Join me on Zukaping!\nUse my referral link to unlock premium perks instantly:\n${referralInfo.referralUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "You're invited to Zukaping!",
          text,
          url: referralInfo.referralUrl,
        });
      } catch {
        /* canceled */
      }
    } else {
      await navigator.clipboard?.writeText(text);
      showToast('Referral message copied to clipboard!');
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    apiService.removeToken();
    logout();
    showToast('Logged out');
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      const ok = await apiService.deleteAccount();
      if (ok) {
        showToast('Account deleted');
        apiService.removeToken();
        logout();
        navigate('/login', { replace: true });
      } else {
        showToast('Failed to delete account');
      }
    } catch {
      showToast('Failed to delete account');
    }
  };

  const handleToggleExclusivity = async (isExclusive: boolean, price: number) => {
    const imageId = priceTargetId ?? selectedImage?.id;
    if (!imageId) return;
    try {
      await apiService.updateProfileImage(imageId, isExclusive, price);
      showToast(isExclusive ? 'Photo is now Exclusive!' : 'Photo is now Public!');
      setSelectedImage(null);
      setPriceTargetId(null);
      await refresh();
    } catch {
      showToast('Failed to update photo status');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await apiService.deleteProfileImage(imageId);
      showToast('Photo deleted successfully');
      setSelectedImage(null);
      await refresh();
    } catch {
      showToast('Failed to delete photo');
    }
  };

  const openFullscreenFromImage = (index: number) => {
    const entry = allPhotos[index];
    if (!entry) return;
    setFullscreenPhotos(allPhotos.map((item) => item.url));
    setFullscreenIndex(index);
    setSelectedImage(null);
  };

  const appBarTitle = (
    <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'inherit' }}>My Profile</Typography>
  );

  // Flutter shows the sun icon while dark, the moon while light.
  const appBarActions = (
    <>
      <IconButton aria-label="Toggle theme" onClick={toggle} sx={{ color: 'inherit' }}>
        {isDark ? <LightModeIcon sx={{ fontSize: 24 }} /> : <DarkModeIcon sx={{ fontSize: 24 }} />}
      </IconButton>
      <IconButton aria-label="Settings" onClick={() => setShowSettingsModal(true)} sx={{ color: 'inherit' }}>
        <SettingsIcon sx={{ fontSize: 24 }} />
      </IconButton>
    </>
  );

  // Flutter `_buildErrorState` (L481-500).
  if (error && !profile) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: c.scaffold }}>
        <FlutterAppBar leading={<AppLogo size={40} />} title={appBarTitle} actions={appBarActions} />
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: '32px',
            textAlign: 'center',
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 64, color: '#BDBDBD' }} />
          <Box sx={{ height: 16 }} />
          <Box sx={{ fontSize: 16, color: '#9E9E9E' }}>{error}</Box>
          <Box sx={{ height: 16 }} />
          <Button
            variant="contained"
            onClick={() => {
              setError(null);
              void loadProfile();
            }}
            sx={{
              height: 36,
              px: '24px',
              borderRadius: '4px',
              bgcolor: PRIMARY,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 500,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: PRIMARY },
            }}
          >
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  if (!profile || uploading) {
    const shimmerBase = isDark ? '#2C2C2E' : '#EEEEEE';
    return (
      <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: c.scaffold }}>
        <FlutterAppBar
          leading={<AppLogo size={40} />}
          title={appBarTitle}
          actions={appBarActions}
        />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: '20px' }}>
          {/* Avatar shimmer */}
          <Box sx={{ width: 120, height: 120, borderRadius: '50%', bgcolor: shimmerBase, mx: 'auto', mb: '12px' }} />
          {/* Name shimmer */}
          <Box sx={{ width: 180, height: 28, borderRadius: '8px', bgcolor: shimmerBase, mx: 'auto', mb: '8px' }} />
          {/* Handle shimmer */}
          <Box sx={{ width: 120, height: 18, borderRadius: '8px', bgcolor: shimmerBase, mx: 'auto', mb: '24px' }} />
          {/* Bio shimmer */}
          <Box sx={{ width: '100%', height: 60, borderRadius: '12px', bgcolor: shimmerBase, mb: '32px' }} />
          {/* Buttons shimmer */}
          <Box sx={{ width: '100%', display: 'flex', gap: '12px', mb: '32px' }}>
            <Box sx={{ flex: 1, height: 48, borderRadius: '12px', bgcolor: shimmerBase }} />
            <Box sx={{ flex: 1, height: 48, borderRadius: '12px', bgcolor: shimmerBase }} />
          </Box>
          {/* Grid shimmer */}
          <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Box key={i} sx={{ aspectRatio: '1 / 1', borderRadius: '12px', bgcolor: shimmerBase }} />
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: c.scaffold }}>
      <FlutterAppBar
        leading={<AppLogo size={40} />}
        title={appBarTitle}
        actions={appBarActions}
      />

      <Box
        ref={setScrollEl}
        onTouchStart={(event) => {
          if ((scrollEl?.scrollTop ?? 0) <= 0) setTouchStart(event.touches[0]?.clientY ?? null);
        }}
        onTouchMove={(event) => {
          if (touchStart == null) return;
          const delta = (event.touches[0]?.clientY ?? 0) - touchStart;
          if (delta > 0) setPull(Math.min(delta * 0.5, 100));
        }}
        onTouchEnd={() => {
          if (pull >= 60 && !refreshing) {
            setRefreshing(true);
            void loadProfile();
          }
          setPull(0);
          setTouchStart(null);
        }}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehaviorY: 'contain',
          position: 'relative',
        }}
      >
        {/* Flutter RefreshIndicator (primary #026AFD) */}
        {(pull > 0 || refreshing) && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: refreshing ? 56 : pull,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <CircularProgress
              size={24}
              thickness={4}
              sx={{
                color: PRIMARY,
                transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
              }}
            />
          </Box>
        )}
        <Box sx={{ p: '20px' }}>
          {/* Avatar — circular (Flutter: the whole avatar opens the gallery) */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 12 }}>
            <Box
              onClick={() =>
                requestImage({
                  title: 'Change profile photo',
                  onPick: ([file]) => void handleAvatarFile(file),
                })
              }
              sx={{ position: 'relative', width: 120, height: 120, cursor: 'pointer' }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: -3,
                  borderRadius: '50%',
                  border: `3px solid ${PRIMARY}`,
                  boxShadow: '0 0 0 4px rgba(2,106,253,0.1)',
                }}
              />
              {effectiveAvatar ? (
                <Box
                  component="img"
                  src={effectiveAvatar}
                  alt={profile.name}
                  sx={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    bgcolor: AVATAR_PLACEHOLDER,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    objectFit: 'cover',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
                  }}
                />
              ) : (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ width: 120, height: 120, borderRadius: '50%', bgcolor: AVATAR_PLACEHOLDER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box component="span" sx={{ fontSize: 48, fontWeight: 700, color: c.isDark ? '#9E9E9E' : '#757575' }}>
                      {(profile.name || '?')[0].toUpperCase()}
                    </Box>
                  </Box>
                </Box>
              )}
              {/* lit upper rim and shaded underside read as a sphere */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  border: `1px solid ${c.isDark ? 'rgba(255,255,255,0.14)' : '#E0E0E0'}`,
                  boxShadow: c.isDark
                    ? 'inset 0 3px 5px rgba(255,255,255,0.12), inset 0 -4px 7px rgba(0,0,0,0.55)'
                    : 'inset 0 3px 5px rgba(255,255,255,0.9), inset 0 -4px 7px rgba(0,0,0,0.1)',
                }}
              />
            </Box>

            <Box sx={{ height: 12 }} />
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ fontSize: 24, fontWeight: 700, color: c.isDark ? '#FFFFFF' : '#000000', lineHeight: 1.2 }}>
                {profile.name}
              </Box>
              <Box sx={{ height: 4 }} />
              <Box sx={{ fontSize: 16, color: '#8E8E8E' }}>@{handle}</Box>
            </Box>
          </Box>

          {/* Bio */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              p: '16px',
              borderRadius: '12px',
              bgcolor: c.isDark ? '#1C1C1E' : '#FAFAFA',
              border: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
            }}
          >
            <Box sx={{ fontSize: 16, lineHeight: 1.5, color: c.isDark ? '#E0E0E0' : '#666666' }}>{profile.bio || 'No bio yet'}</Box>
            <IconButton
              size="small"
              aria-label="Edit bio"
              onClick={() => navigate('/edit-profile')}
              sx={{ position: 'absolute', top: 8, right: 8, color: '#9E9E9E', p: 0 }}
            >
              <EditIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          <Box sx={{ height: 32 }} />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: '12px' }}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/edit-profile')}
              sx={{
                height: 56,
                borderRadius: '12px',
                fontSize: 16,
                fontWeight: 600,
                bgcolor: PRIMARY,
                color: '#FFFFFF',
              }}
            >
              Edit Profile
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => void handleShareProfile()}
              sx={{
                py: '12px',
                borderRadius: '12px',
                fontSize: 16,
                fontWeight: 600,
                color: isDark ? '#FFFFFF' : '#000000',
                border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
                bgcolor: c.isDark ? '#1C1C1E' : '#FAFAFA',
              }}
            >
              Share Profile
            </Button>
          </Box>

          <Box sx={{ height: 32 }} />

          {/* Photos grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {allPhotos.map((entry, index) => (
              <Box
                key={`${entry.url}-${index}`}
                onClick={() => (entry.image ? setSelectedImage(entry.image) : openFullscreenFromImage(index))}
                sx={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: `1px solid ${c.isDark ? '#3A3A3C' : '#EEEEEE'}`,
                  cursor: 'pointer',
                  bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
                }}
              >
                <Box component="img" src={entry.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {entry.image && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      px: '6px',
                      py: '3px',
                      borderRadius: '6px',
                      bgcolor: entry.image.isExclusive ? 'rgba(255,87,34,0.85)' : 'rgba(0,0,0,0.54)',
                      color: '#FFFFFF',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    {entry.image.isExclusive ? `🔒 ₦${Number(entry.image.price || 0).toFixed(0)}` : '🔓 Public'}
                  </Box>
                )}
              </Box>
            ))}

            {/* Upload card */}
            <Box
              onClick={() =>
                requestImage({
                  title: 'Upload Photo',
                  onPick: ([file]) => void handlePhotoFile(file),
                })
              }
              sx={{
                aspectRatio: '1 / 1',
                borderRadius: '12px',
                border: '1.5px solid rgba(2,106,253,0.3)',
                bgcolor: c.isDark ? '#1C1C1E' : '#FAFAFA',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                gap: 8,
              }}
            >
              <AddAPhotoIcon sx={{ fontSize: 32, color: PRIMARY }} />
              <Box sx={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Upload Photo</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Settings sheet — Flutter radius 20, single inner handle */}
      <FlutterSheet open={showSettingsModal} onClose={() => setShowSettingsModal(false)} background={c.isDark ? '#1C1C1E' : '#FFFFFF'} radius={20} handle={false}>
        <Box sx={{ px: '20px', pb: '16px' }}>
          <Box sx={{ height: 12 }} />
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: c.isDark ? '#3A3A3C' : '#E0E0E0', mx: 'auto', mb: '16px' }} />
          <Box sx={{ fontSize: 18, fontWeight: 600, textAlign: 'center', mb: '20px', color: c.text }}>Settings</Box>
          <Box>
            <Box
              onClick={() => {
                setShowSettingsModal(false);
                setShowReferralModal(true);
              }}
              sx={{ display: 'flex', alignItems: 'center', gap: '14px', py: '14px', cursor: 'pointer' }}
            >
              <PersonAddIcon sx={{ fontSize: 24, color: c.isDark ? 'rgba(255,255,255,0.7)' : '#000000' }} />
              <Box sx={{ fontSize: 16, fontWeight: 500, color: c.text }}>Refer a Friend</Box>
            </Box>
            <Box
              onClick={() => {
                setShowSettingsModal(false);
                setShowLogoutConfirm(true);
              }}
              sx={{ display: 'flex', alignItems: 'center', gap: '14px', py: '14px', cursor: 'pointer' }}
            >
              <LogoutIcon sx={{ fontSize: 24, color: '#F44336' }} />
              <Box sx={{ fontSize: 16, fontWeight: 500, color: '#F44336' }}>Logout</Box>
            </Box>
            <Box
              onClick={() => {
                setShowSettingsModal(false);
                setShowDeleteConfirm(true);
              }}
              sx={{ display: 'flex', alignItems: 'center', gap: '14px', py: '14px', cursor: 'pointer' }}
            >
              <DeleteForeverIcon sx={{ fontSize: 24, color: '#F44336' }} />
              <Box sx={{ fontSize: 16, fontWeight: 500, color: '#F44336' }}>Delete Account</Box>
            </Box>
          </Box>
        </Box>
      </FlutterSheet>

      {/* Referral sheet — Flutter radius 20, single inner handle */}
      <FlutterSheet open={showReferralModal} onClose={() => setShowReferralModal(false)} background={c.isDark ? '#1C1C1E' : '#FFFFFF'} handle={false} radius={20} maxHeight="92dvh">
        <Box sx={{ px: '24px', pb: '30px', pt: '8px' }}>
          <Box sx={{ height: 12 }} />
          <Box sx={{ width: 48, height: 5, borderRadius: '2.5px', bgcolor: c.isDark ? '#3A3A3C' : '#E0E0E0', mx: 'auto', mb: '24px' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(2,106,253,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '20px' }}>
              <CardGiftcardIcon sx={{ fontSize: 40, color: PRIMARY }} />
            </Box>
            <Box sx={{ fontSize: 22, fontWeight: 800, color: c.text, mb: '8px' }}>Invite Friends, Get Rewarded</Box>
            <Box
              sx={{
                width: '100%',
                boxSizing: 'border-box',
                px: '32px',
                fontSize: 15,
                color: c.isDark ? '#BDBDBD' : '#757575',
                lineHeight: 1.4,
                mb: '32px',
              }}
            >
              Share your unique link. When your friends join, you both unlock premium features!
            </Box>
            <Box
              sx={{
                width: '100%',
                p: '20px',
                borderRadius: '20px',
                bgcolor: PRIMARY,
                boxShadow: '0 8px 15px rgba(2,106,253,0.3)',
                py: '20px',
                mb: '24px',
              }}
            >
              <Box sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', mb: '8px' }}>YOUR REFERRAL CODE</Box>
              <Box sx={{ fontSize: 32, fontWeight: 900, letterSpacing: 4, color: '#FFFFFF' }}>
                {referralInfo.referralCode || '------'}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', width: '100%', gap: '16px' }}>
              <Box
                onClick={handleCopyReferral}
                sx={{
                  flex: 1,
                  py: '16px',
                  borderRadius: '16px',
                  border: `2px solid ${PRIMARY}`,
                  bgcolor: 'transparent',
                  color: PRIMARY,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <ContentCopyIcon sx={{ fontSize: 20 }} />
                Copy Link
              </Box>
              <Box
                onClick={() => void handleShareReferral()}
                sx={{
                  flex: 1,
                  py: '16px',
                  borderRadius: '16px',
                  border: 'none',
                  bgcolor: PRIMARY,
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <ShareIcon sx={{ fontSize: 20 }} />
                Share Now
              </Box>
            </Box>
          </Box>
        </Box>
      </FlutterSheet>

      {/* Logout dialog — Flutter default M3 AlertDialog (radius 28) */}
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Logout"
        content="Are you sure you want to logout?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        danger
        onCancel={() => {
          setShowLogoutConfirm(false);
          navigate('/feed');
        }}
        onConfirm={handleLogout}
      />

      {/* Delete account dialog — Flutter default M3 AlertDialog (radius 28) */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Account"
        content="This will permanently delete your account and all associated data. Are you sure you want to continue?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDeleteAccount()}
      />

      {/* Photo manage sheet — Flutter radius 24, single inner handle */}
      <FlutterSheet open={selectedImage != null} onClose={() => setSelectedImage(null)} background={c.isDark ? '#1C1C1E' : '#FFFFFF'} handle={false}>
        <Box sx={{ px: '20px', pb: '16px' }}>
          <Box sx={{ height: 12 }} />
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: c.isDark ? '#3A3A3C' : '#E0E0E0', mx: 'auto', mb: '16px' }} />
          <Box sx={{ fontSize: 16, fontWeight: 700, textAlign: 'center', mb: '8px', color: c.text }}>
            {selectedImage?.isExclusive ? '🔒 Exclusive Content' : '🔓 Public Photo'}
          </Box>
          {selectedImage?.isExclusive && (
            <Box sx={{ textAlign: 'center', color: c.isDark ? '#BDBDBD' : '#757575', fontSize: 14, mb: '16px' }}>
              Unlocks for ₦{Number(selectedImage.price || 0).toFixed(0)}
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', mt: 2 }}>
            <Box
              onClick={() => {
                if (!selectedImage) return;
                const index = allPhotos.findIndex((entry) => entry.image?.id === selectedImage.id);
                openFullscreenFromImage(index >= 0 ? index : 0);
              }}
              sx={{ display: 'flex', alignItems: 'center', gap: '14px', py: '14px', cursor: 'pointer' }}
            >
              <FullscreenIcon sx={{ fontSize: 24, color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.87)' }} />
              <Box sx={{ fontSize: 16, fontWeight: 500, color: c.text }}>View Fullscreen</Box>
            </Box>
            <Box
              onClick={() => {
                if (!selectedImage) return;
                if (selectedImage.isExclusive) void handleToggleExclusivity(false, 0);
                else setShowPricePrompt(true);
              }}
              sx={{ display: 'flex', alignItems: 'center', gap: '14px', py: '14px', cursor: 'pointer' }}
            >
              {selectedImage?.isExclusive ? (
                <LockOpenIcon sx={{ fontSize: 24, color: PRIMARY }} />
              ) : (
                <LockIcon sx={{ fontSize: 24, color: PRIMARY }} />
              )}
              <Box sx={{ fontSize: 16, fontWeight: 500, color: c.text }}>
                {selectedImage?.isExclusive ? 'Make Public' : 'Make Exclusive'}
              </Box>
            </Box>
            <Box
              onClick={() => {
                if (!selectedImage) return;
                setPendingDeleteId(selectedImage.id);
                setSelectedImage(null);
                setShowDeletePhotoConfirm(true);
              }}
              sx={{ display: 'flex', alignItems: 'center', gap: '14px', py: '14px', cursor: 'pointer' }}
            >
              <DeleteForeverIcon sx={{ fontSize: 24, color: '#F44336' }} />
              <Box sx={{ fontSize: 16, fontWeight: 500, color: '#F44336' }}>Delete Photo</Box>
            </Box>
          </Box>
        </Box>
      </FlutterSheet>

      {/* Delete photo confirmation (Flutter L1027-1046, radius 20) */}
      <ConfirmDialog
        open={showDeletePhotoConfirm}
        title="Delete Photo?"
        content="Are you sure you want to delete this photo permanently?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        radius={20}
        onCancel={() => setShowDeletePhotoConfirm(false)}
        onConfirm={() => {
          setShowDeletePhotoConfirm(false);
          if (pendingDeleteId) void handleDeleteImage(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />

      {sheet}

      {/* Set unlock price dialog — Flutter M3 AlertDialog (radius 20) */}
      <DialogSimple open={showPricePrompt} onClose={() => { setShowPricePrompt(false); setPriceTargetId(null); }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ fontSize: 24, fontWeight: 400, lineHeight: 1.33, mb: '16px', color: c.text }}>
            Set Unlock Price
          </Box>
          <Box sx={{ fontSize: 13, color: c.isDark ? '#BDBDBD' : 'rgba(0,0,0,0.54)', mb: '16px' }}>
            Set the amount in Nigerian Naira (₦) other users must pay to unlock this exclusive photo.
          </Box>
          <TextField
            fullWidth
            label="Unlock Price"
            type="number"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">₦</InputAdornment>,
            }}
            sx={{ mb: '8px', bgcolor: 'transparent' }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mx: '-8px', mb: '-10px' }}>
            <Box
              onClick={() => {
                setShowPricePrompt(false);
                setPriceTargetId(null);
              }}
              sx={{
                px: '12px',
                py: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: PRIMARY,
                '&:hover': { bgcolor: 'rgba(2,106,253,0.08)' },
              }}
            >
              Cancel
            </Box>
            <Box
              onClick={() => {
                setShowPricePrompt(false);
                void handleToggleExclusivity(true, parseFloat(priceInput) || 500);
              }}
              sx={{
                px: '12px',
                py: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                color: PRIMARY,
                '&:hover': { bgcolor: 'rgba(2,106,253,0.08)' },
              }}
            >
              Confirm
            </Box>
          </Box>
        </Box>
      </DialogSimple>

      {/* Fullscreen viewer */}
      <FullScreenViewer open={fullscreenPhotos != null} images={fullscreenPhotos ?? []} initialIndex={fullscreenIndex} onClose={() => setFullscreenPhotos(null)} />
    </Box>
  );
};

const DialogSimple = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
  const c = usePalette();
  if (!open) return null;
  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'rgba(0,0,0,0.6)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: '20px',
      }}
    >
      <Box
        sx={{
          bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
          color: c.text,
          border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
          borderRadius: '20px',
          p: 3,
          width: '100%',
          maxWidth: 380,
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </Box>
    </Box>
  );
};
