import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { FlutterSheet } from '../components/common/flutter-sheet';
import { FullScreenViewer } from '../components/common/fullscreen-viewer';
import { PRIMARY } from '../styles/tokens';
import { formatTime } from '../utils/format';
import type { ExtendedUserProfile, ProfileImage } from '../services/api.service';

export const ViewProfileScreen: React.FC = () => {
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const c = usePalette();
  const { showToast } = useSnackbar();

  const stateObj = location.state as any;
  const rawId =
    routeUserId ||
    searchParams.get('userId') ||
    searchParams.get('id') ||
    searchParams.get('targetUserId') ||
    (typeof location.state === 'string' ? location.state : null) ||
    stateObj?.userId ||
    stateObj?.targetUserId ||
    stateObj?.id ||
    '';

  const cleanedId =
    rawId === ':userId' || rawId === 'undefined' || rawId === 'null' ? '' : rawId.trim();
  const myUserId =
    localStorage.getItem('userId') || sessionStorage.getItem('userId') || '';
  const userId = cleanedId && cleanedId !== 'me' ? cleanedId : myUserId;

  const previewUser: ExtendedUserProfile | null = useMemo(() => {
    const u = stateObj?.user || (stateObj?.name ? stateObj : null);
    if (!u) return null;
    return {
      id: String(u.id ?? u._id ?? userId),
      name: String(u.name || u.userName || 'User'),
      avatar: u.avatar || u.userAvatar || null,
      bio: u.bio || '',
      photos: Array.isArray(u.photos || u.userPhotos) ? (u.photos || u.userPhotos) : [],
      status: u.status || u.userStatus || 'offline',
      profileImages: [],
      distance: u.distance ? String(u.distance) : undefined,
    };
  }, [stateObj, userId]);

  const [profile, setProfile] = useState<ExtendedUserProfile | null>(previewUser);
  const [images, setImages] = useState<ProfileImage[]>([]);
  const [loading, setLoading] = useState(!previewUser);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [lastActive, setLastActive] = useState<number | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [unlockTarget, setUnlockTarget] = useState<ProfileImage | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [fullscreenPhotos, setFullscreenPhotos] = useState<string[] | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (!profile) setLoading(true);
    try {
      let userData: ExtendedUserProfile;
      try {
        userData = await apiService.getUserProfile(userId);
      } catch (err) {
        if (userId === myUserId || !userId) {
          const myProfile = await apiService.getProfile();
          userData = {
            id: myProfile.id,
            name: myProfile.name,
            username: myProfile.username,
            avatar: myProfile.avatar,
            bio: myProfile.bio,
            gender: myProfile.gender,
            interestedIn: myProfile.interestedIn,
            photos: myProfile.photos,
            status: myProfile.status,
            birthDate: myProfile.birthDate,
            age: myProfile.age,
            profileImages: myProfile.profileImages,
            distance: myProfile.distance,
          };
        } else {
          throw err;
        }
      }

      setProfile(userData);
      setImages(userData?.profileImages ?? []);
      setRating(userData?.rating ?? null);
      setVerified(Boolean(userData?.verified));
      setLastActive(userData?.lastActive ?? null);
      setInterests(userData?.interests ?? []);
      setError(null);
      const favs = await apiService.getFavorites().catch(() => [] as never[]);
      setIsFavorited(
        Array.isArray(favs)
          ? favs.some(
              (f: any) =>
                f?.targetUserId === userId ||
                f?.userId === userId ||
                f?.id === userId
            )
          : false
      );
    } catch {
      if (!profile) {
        // Flutter `_loadProfile` catch: same copy, `Unknown User` (and no images).
        setError('This profile is no longer available');
        setProfile({
          id: userId,
          name: 'Unknown User',
          status: 'offline',
          bio: 'This profile is no longer available or has been deleted.',
          avatar: '',
          photos: [],
          profileImages: [],
        } as ExtendedUserProfile);
        setImages([]);
        setInterests([]);
        setRating(null);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, myUserId, profile]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const effectiveImages: ProfileImage[] =
    images.length > 0
      ? images
      : (profile?.photos ?? [])
        .filter(Boolean)
        .map((url) => ({
          id: url,
          url,
          isExclusive: false,
          price: 0,
          currency: 'NGN',
          isUnlocked: true,
        }));

  const browseablePhotos = useMemo(
    () => effectiveImages.filter((img) => !img.isExclusive || img.isUnlocked).map((img) => img.url),
    [effectiveImages]
  );

  const isUnknown = Boolean(error);

  const onPhotoClick = (img: ProfileImage) => {
    const isLocked = img.isExclusive && !img.isUnlocked;
    if (isLocked) {
      setUnlockTarget(img);
    } else {
      const idx = browseablePhotos.indexOf(img.url);
      setFullscreenPhotos(browseablePhotos);
      setFullscreenIndex(idx >= 0 ? idx : 0);
    }
  };

  const handleCarouselScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index >= 0 && index < effectiveImages.length) setCurrentPhotoIndex(index);
  };

  const handleStartChat = async () => {
    if (!userId || isUnknown) return;
    try {
      const chat = await apiService.createChatByTarget(userId);
      const chatId = chat?.id;
      if (chatId) {
        showToast('Chat created!');
        navigate(`/chat/${chatId}`);
      }
    } catch {
      showToast('Failed to create chat');
    }
  };

  const handleToggleFavorite = async () => {
    if (!userId) return;
    try {
      const next = await apiService.toggleFavorite(userId, isFavorited);
      setIsFavorited(next);
      showToast(next ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      showToast('Failed to update favorite');
    }
  };

  // Flutter stubs: a single toast, no dialog and no API call.
  const handleBlockUser = () => {
    showToast('Block action not implemented');
  };

  const handleReportUser = () => {
    showToast('Report action not implemented');
  };

  const handleUnlockContent = async (target: ProfileImage) => {
    setUnlocking(true);
    try {
      await apiService.unlockContent(target.id);
      showToast('Payment coming soon! Content unlocked instantly for testing.');
      setUnlockTarget(null);
      void loadProfile();
    } catch (e) {
      showToast(`Failed to unlock content: ${e}`);
      setUnlockTarget(null);
    } finally {
      setUnlocking(false);
    }
  };

  if (error && !profile) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: c.scaffold }}>
        <Box
          component="header"
          sx={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            px: '12px',
            borderBottom: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
            bgcolor: c.isDark ? '#121212' : '#FFFFFF',
          }}
        >
          <IconButton onClick={() => navigate(-1)} sx={{ color: c.isDark ? '#FFFFFF' : '#000000DE' }}>
            <Box component="span" sx={{ fontSize: 24, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: '32px', textAlign: 'center' }}>
          <Box sx={{ fontSize: 48, mb: '16px' }}>👤</Box>
          <Box sx={{ fontSize: 18, fontWeight: 700, color: c.text, mb: '8px' }}>Profile Unavailable</Box>
          <Box sx={{ fontSize: 14, color: c.isDark ? '#BDBDBD' : '#757575', mb: '24px', maxWidth: 300 }}>
            {error || 'Unable to load profile at this time.'}
          </Box>
          <Button
            variant="contained"
            onClick={() => void loadProfile()}
            sx={{ height: 48, px: '28px', borderRadius: '24px', bgcolor: PRIMARY, color: '#FFFFFF', textTransform: 'none', fontWeight: 600 }}
          >
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  if (loading && !profile) {
    const shimmerBase = c.isDark ? '#2C2C2E' : '#EEEEEE';
    return (
      <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: c.scaffold }}>
        <Box
          component="header"
          sx={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            px: '12px',
            borderBottom: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
            bgcolor: c.isDark ? '#121212' : '#FFFFFF',
          }}
        >
          <IconButton onClick={() => navigate(-1)} sx={{ color: c.isDark ? '#FFFFFF' : '#000000DE' }}>
            <Box component="span" sx={{ fontSize: 24, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: '24px' }}>
          {/* Photo carousel shimmer */}
          <Box sx={{ width: '100%', height: 380, borderRadius: '20px', bgcolor: shimmerBase, mb: '44px' }} />
          {/* Name shimmer */}
          <Box sx={{ width: 200, height: 32, borderRadius: '12px', bgcolor: shimmerBase, mx: 'auto', mb: '16px' }} />
          {/* Bio shimmer */}
          <Box sx={{ width: 280, height: 60, borderRadius: '12px', bgcolor: shimmerBase, mx: 'auto', mb: '32px' }} />
          {/* Meta shimmer */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: '32px', mb: '40px' }}>
            <Box sx={{ width: 100, height: 20, borderRadius: '12px', bgcolor: shimmerBase }} />
            <Box sx={{ width: 100, height: 20, borderRadius: '12px', bgcolor: shimmerBase }} />
          </Box>
          {/* Rating shimmer */}
          <Box sx={{ width: 120, height: 28, borderRadius: '12px', bgcolor: shimmerBase, mx: 'auto', mb: '40px' }} />
          {/* Chat button shimmer */}
          <Box sx={{ width: '100%', height: 52, borderRadius: '26px', bgcolor: shimmerBase, mb: '24px' }} />
          {/* Secondary buttons shimmer */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
            {[0, 1, 2].map((i) => (
              <Box key={i} sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: shimmerBase }} />
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  const currentHeroImg = effectiveImages[currentPhotoIndex] ?? null;
  const isHeroLocked = Boolean(currentHeroImg?.isExclusive && !currentHeroImg?.isUnlocked);

  const statusLabel = profile?.status === 'busy' ? 'Busy' : profile?.status === 'available' ? 'Available' : 'Offline';

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: c.scaffold }}>
      {/* AppBar */}
      <Box
        component="header"
        sx={{
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          px: '12px',
          borderBottom: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
          bgcolor: c.isDark ? '#121212' : '#FFFFFF',
        }}
      >
        <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: c.isDark ? '#FFFFFF' : '#000000DE' }}>
          <Box component="span" sx={{ fontSize: 24, lineHeight: 1 }}>
            ‹
          </Box>
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box sx={{ p: '24px' }}>
          {/* Hero carousel */}
          {effectiveImages.length > 0 ? (
            <Box sx={{ mb: '24px' }}>
              <Box
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                sx={{
                  position: 'relative',
                  height: 380,
                  borderRadius: '20px',
                  overflow: 'hidden',
                  bgcolor: c.isDark ? '#1C1C1E' : '#EEEEEE',
                  border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
                  cursor: 'pointer',
                }}
              >
                <Box sx={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', height: '100%', '&::-webkit-scrollbar': { display: 'none' } }}>
                  {effectiveImages.map((img, idx) => {
                    const locked = img.isExclusive && !img.isUnlocked;
                    return (
                      <Box
                        key={`${img.id}-${idx}`}
                        sx={{ minWidth: '100%', height: '100%', scrollSnapAlign: 'start', position: 'relative' }}
                        onClick={() => onPhotoClick(img)}
                      >
                        {/* Locked media has no url: the server withholds the
                            file so paying is more than a CSS trick. */}
                        {img.url && (
                          <Box
                            component="img"
                            src={img.url}
                            alt=""
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              filter: locked ? 'blur(25px) scale(1.1)' : 'none',
                              display: 'block',
                            }}
                          />
                        )}
                        {locked && (
                          <Box sx={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                            <Box sx={{ width: 68, height: 68, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.54)', border: '1.5px solid rgba(255,255,255,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <LockIcon sx={{ fontSize: 36, color: '#FFFFFF' }} />
                            </Box>
                            <Box sx={{ background: '#FF5722', color: '#FFFFFF', px: '14px', py: '6px', borderRadius: '20px', fontWeight: 700, fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                              🔒 Exclusive Content
                            </Box>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {effectiveImages.length > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: '8px', mt: '8px' }}>
                  {effectiveImages.map((img, idx) => (
                    <Box
                      key={`${img.id}-${idx}`}
                      onClick={() => setCurrentPhotoIndex(idx)}
                      sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: idx === currentPhotoIndex ? PRIMARY : c.isDark ? '#2C2C2E' : '#E0E0E0', cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                height: 380,
                borderRadius: '20px',
                bgcolor: c.isDark ? '#1C1C1E' : '#EEEEEE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: '24px',
              }}
            >
              <Box component="span" sx={{ fontSize: 64, color: c.isDark ? '#2C2C2E' : '#E0E0E0' }}>👤</Box>
            </Box>
          )}

          {/* Name + age */}
          <Box sx={{ fontSize: 28, fontWeight: 700, textAlign: 'center', mb: '8px', color: c.isDark ? '#FFFFFF' : '#000000DE' }}>
            {profile?.name}
            {profile?.age != null ? `, ${profile.age}` : ''}
          </Box>

          {/* Bio */}
          {profile?.bio ? (
            <Box sx={{ fontSize: 16, color: c.isDark ? '#BDBDBD' : '#757575', textAlign: 'center', lineHeight: 1.5, mb: '8px' }}>{profile.bio}</Box>
          ) : null}

          {/* Distance & status */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', mb: '24px' }}>
            {profile?.distance != null && (
              <Box sx={{ fontSize: 16, color: c.isDark ? '#BDBDBD' : '#757575' }}>{profile.distance} km away</Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: profile?.status === 'busy' ? '#FFFF00' : profile?.status === 'available' ? PRIMARY : '#F44336' }} />
              <Box sx={{ fontSize: 16, color: c.isDark ? '#BDBDBD' : '#757575' }}>{statusLabel}</Box>
            </Box>
          </Box>

          {/* Rating */}
          {rating != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', mb: '28px' }}>
              <StarIcon sx={{ fontSize: 24, color: '#FFD700' }} />
              <Box sx={{ fontSize: 18, fontWeight: 700, color: c.isDark ? '#FFFFFF' : '#000000DE' }}>{String(rating)}</Box>
              {verified && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Box sx={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>✓ Verified</Box>
                </Box>
              )}
            </Box>
          )}

          {/* Chat button */}
          <Box sx={{ width: '100%', height: 52, borderRadius: '26px', mb: '20px' }}>
            <Button
              fullWidth
              variant="contained"
              disabled={isUnknown}
              onClick={() => void handleStartChat()}
              sx={{
                width: '100%',
                height: 52,
                borderRadius: '26px',
                fontSize: 17,
                fontWeight: 700,
                bgcolor: isUnknown ? '#EEEEEE' : PRIMARY,
                color: isUnknown ? '#9E9E9E' : '#FFFFFF',
                boxShadow: isUnknown ? 'none' : '0 4px 16px rgba(2,106,253,0.3)',
              }}
            >
              Chat
            </Button>
          </Box>

          {/* Secondary actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px', mb: '28px' }}>
            <IconButton
              aria-label="Favorite"
              onClick={() => void handleToggleFavorite()}
              disabled={isUnknown}
              sx={{ color: isFavorited ? '#F44336' : '#8E8E8E' }}
            >
              {isFavorited ? <FavoriteIcon sx={{ fontSize: 28 }} /> : <FavoriteBorderIcon sx={{ fontSize: 28 }} />}
            </IconButton>
            <IconButton aria-label="Report" onClick={() => void handleReportUser()} disabled={isUnknown} sx={{ color: '#8E8E8E' }}>
              <ReportGmailerrorredIcon sx={{ fontSize: 28 }} />
            </IconButton>
            <IconButton aria-label="Block" onClick={() => setShowBlockConfirm(true)} disabled={isUnknown} sx={{ color: '#8E8E8E' }}>
              <BlockIcon sx={{ fontSize: 28 }} />
            </IconButton>
          </Box>

          {/* Photos grid */}
          {effectiveImages.length > 0 && (
            <Box sx={{ mb: '24px' }}>
              <Box sx={{ fontSize: 20, fontWeight: 700, color: c.isDark ? '#FFFFFF' : '#000000DE', mb: '16px' }}>Photos</Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {effectiveImages.map((img, idx) => {
                  const isLocked = img.isExclusive && !img.isUnlocked;
                  return (
                    <Box
                      key={`${img.id}-${idx}`}
                      onClick={() => onPhotoClick(img)}
                      sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5' }}
                    >
                      {img.url && (
                        <Box component="img" src={img.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: isLocked ? 'blur(15px) scale(1.1)' : 'none' }} />
                      )}
                      {isLocked ? (
                        <>
                          <Box sx={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />
                          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 36, height: 36, borderRadius: '50%', bgcolor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <LockIcon sx={{ fontSize: 20, color: '#FF5722' }} />
                          </Box>
                          <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8, px: '6px', py: '3px', borderRadius: '6px', bgcolor: 'rgba(0,0,0,0.87)', color: '#FFFFFF', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>
                            🔒 Exclusive (₦{Number(img.price || 0).toFixed(0)})
                          </Box>
                        </>
                      ) : (
                        <Box sx={{ position: 'absolute', bottom: 8, left: 8, px: '6px', py: '3px', borderRadius: '6px', bgcolor: 'rgba(0,0,0,0.6)', color: '#FFFFFF', fontSize: 10, fontWeight: 700 }}>
                          🔓 Public
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Additional info */}
          <Box sx={{ textAlign: 'center', color: c.isDark ? '#BDBDBD' : '#757575', fontSize: 14 }}>
            {lastActive != null && (
              <Box>
                Last active{' '}
                {lastActive > 0 ? formatTime(lastActive).toLowerCase() : 'just now'}
              </Box>
            )}
            {interests.length > 0 && (
              <Box sx={{ mt: lastActive != null ? 6 : 0 }}>Mutual interests: {interests.join(', ')}</Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Pay-to-unlock sheet */}
      <FlutterSheet
        open={unlockTarget != null}
        onClose={() => setUnlockTarget(null)}
        handle={false}
        maxHeight="92dvh"
        background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      >
        <Box sx={{ px: '24px', pb: '36px', pt: '8px' }}>
          <Box sx={{ height: 12 }} />
          <Box sx={{ width: 40, height: 5, borderRadius: '2.5px', bgcolor: c.isDark ? '#3A3A3C' : '#E0E0E0', mx: 'auto', mb: '24px' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ position: 'relative', width: 140, height: 140, borderRadius: '16px', overflow: 'hidden', mb: '16px', bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
              {unlockTarget?.url && <Box component="img" src={unlockTarget.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(20px)', display: 'block' }} />}
              <Box sx={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LockIcon sx={{ fontSize: 20, color: '#FF5722' }} />
                </Box>
              </Box>
            </Box>
            <Box sx={{ fontSize: 22, fontWeight: 800, color: c.isDark ? '#FFFFFF' : '#000000DE', mb: '6px' }}>🔒 Exclusive Content</Box>
            <Box sx={{ fontSize: 14, color: c.isDark ? '#BDBDBD' : '#757575', mb: '24px' }}>Unlock this premium photo by @{profile?.username}</Box>
            <Box
              sx={{
                width: '100%',
                height: 54,
                borderRadius: '27px',
                bgcolor: '#FF5722',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                mb: '16px',
              }}
            >
              Unlock for ₦{Number(unlockTarget?.price || 0).toFixed(0)}
            </Box>
            <Button fullWidth variant="contained" onClick={() => void handleUnlockContent(unlockTarget!)} disabled={unlocking} sx={{ width: '100%', height: 52, borderRadius: '26px', fontSize: 16, fontWeight: 700, bgcolor: '#FF5722', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(2,106,253,0.3)' }}>
              {unlocking ? 'Unlocking…' : 'Unlock Now'}
            </Button>
          </Box>
        </Box>
      </FlutterSheet>

      {/* Block dialog */}
      {showBlockConfirm && (
        <BlockDialog
          open={showBlockConfirm}
          onClose={() => setShowBlockConfirm(false)}
          name={profile?.name}
          onConfirm={() => void handleBlockUser()}
        />
      )}

      {/* Fullscreen viewer */}
      <FullScreenViewer open={fullscreenPhotos != null} images={fullscreenPhotos ?? []} initialIndex={fullscreenIndex} onClose={() => setFullscreenPhotos(null)} />
    </Box>
  );
};

const BlockDialog = ({
  open,
  onClose,
  name,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  name?: string;
  onConfirm: () => void;
}) => {
  const c = usePalette();
  if (!open) return null;
  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', px: '20px' }}>
      <Box sx={{ bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF', border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`, borderRadius: '20px', p: 3, width: '100%', maxWidth: 360 }}>
        <Box sx={{ fontSize: 18, fontWeight: 700, mb: '10px', color: '#E53935' }}>Block User?</Box>
        <Box sx={{ fontSize: 14, color: c.isDark ? '#E0E0E0' : '#666', lineHeight: 1.4, mb: '24px' }}>Are you sure you want to block {name}? You won't see their posts or messages.</Box>
        <Box sx={{ display: 'flex', gap: '12px' }}>
          <Box onClick={onClose} sx={{ flex: 1, py: '12px', borderRadius: '12px', border: `1px solid ${c.isDark ? '#3A3A3C' : '#DDD'}`, bgcolor: c.isDark ? '#2C2C2E' : '#FFFFFF', color: c.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>Cancel</Box>
          <Box onClick={() => { onClose(); onConfirm(); }} sx={{ flex: 1, py: '12px', borderRadius: '12px', border: 'none', bgcolor: '#E53935', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>Block</Box>
        </Box>
      </Box>
    </Box>
  );
};
