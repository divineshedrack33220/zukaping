import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate } from 'react-router-dom';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { wsService } from '../services/ws.service';
import { FavoriteItem } from '../models/chat.models';
import { FAVORITE_STATUSES, useStatusCycle } from '../hooks/use-status-cycle';
import { FlutterAppBar } from '../components/layout/flutter-app-bar';
import { AppLogo } from '../components/common/app-logo';
import { StatusPill } from '../components/feed/status-pill';
import { Shimmer, ShimmerBox } from '../components/common/shimmer';
import { ConfirmDialog } from '../components/common/confirm-dialog';
import { firstInitial, formatDistance, pickAvatar } from '../utils/format';
import { wait } from '../utils/geo';

const STATUS_LABELS: Record<string, string> = {
  available: 'Online',
  busy: 'Busy',
  offline: 'Offline',
};

/** `FavoritesScreen` (profile spec §3): search + 72 px avatar cards. */
export const FavoritesScreen = () => {
  const c = usePalette();
  const navigate = useNavigate();
  const { showToast } = useSnackbar();
  const status = useStatusCycle(FAVORITE_STATUSES);

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState<FavoriteItem | null>(null);
  const [checkingChat, setCheckingChat] = useState(false);

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);  const [touchStart, setTouchStart] = useState<number | null>(null);

  const loadFavorites = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const list = await apiService.getFavorites();
        setFavorites(list);
        setLoading(false);
        return;
      } catch {
        if (attempt < 2) await wait(2000);
      }
    }
    setError('Failed to load favorites. Pull to refresh.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    return wsService.subscribe(({ type, payload }) => {
      if (type === 'new_message') {
        showToast(`📩 New message from ${payload?.senderName ?? 'Someone'}`);
      } else if (type === 'post_accepted') {
        showToast(`🤝 ${payload?.userName ?? 'Someone'} accepted a request`);
      } else if (type === 'post_favorited') {
        showToast('⭐ Someone favorited your request');
      }
    });
  }, [showToast]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return favorites;
    return favorites.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        (item.bio ?? '').toLowerCase().includes(needle)
    );
  }, [favorites, query]);

  const handleCardClick = async (item: FavoriteItem) => {
    const targetId = item.targetUserId || item.id;
    if (!targetId) return;

    try {
      setCheckingChat(true);
      const chats = await apiService.getChats();
      const existing = chats.find(
        (c) =>
          !c.isGroup &&
          (c.partnerId === targetId ||
            (Array.isArray(c.participants) && c.participants.includes(targetId)))
      );

      if (existing) {
        showToast('Chat opened! 🚀');
        navigate(`/chat/${existing.id}`);
      } else {
        // No existing chat found -> ask if user wants to chat before proceeding
        setConfirmTarget(item);
      }
    } catch {
      // If error querying chats, still prompt user before creating
      setConfirmTarget(item);
    } finally {
      setCheckingChat(false);
    }
  };

  const handleConfirmStartChat = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    try {
      const targetId = target.targetUserId || target.id;
      const chat = await apiService.createChatByTarget(targetId);
      showToast('Chat opened! 🚀');
      navigate(`/chat/${chat.id}`);
    } catch {
      showToast('Failed to open chat');
    }
  };

  const removeFavorite = async (item: FavoriteItem) => {
    try {
      await apiService.removeFavorite(item.targetUserId);
      setFavorites((current) => current.filter((fav) => fav.targetUserId !== item.targetUserId));
      showToast('Removed from favorites 💔');
    } catch {
      showToast('Failed to remove favorite');
    }
  };

  const doRefresh = async () => {
    setRefreshing(true);
    await loadFavorites(false);
    setRefreshing(false);
    showToast('Favorites refreshed!');
  };

  const renderShimmer = () => (
    <Shimmer>
      <Box sx={{ p: '16px' }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Box
            key={index}
            sx={{
              mb: '16px',
              p: '20px',
              borderRadius: '20px',
              bgcolor: c.card,
              border: `1px solid ${c.border}`,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ShimmerBox width={72} height={72} radius={36} sx={{ bgcolor: '#9E9E9E' }} />
            <Box sx={{ ml: '16px', flex: 1 }}>
              <ShimmerBox width={120} height={20} radius={8} />
              <Box sx={{ height: 12 }} />
              <ShimmerBox width={200} height={15} radius={8} />
              <Box sx={{ height: 12 }} />
              <ShimmerBox width={100} height={14} radius={8} />
            </Box>
            <ShimmerBox width={28} height={28} radius={8} />
          </Box>
        ))}
      </Box>
    </Shimmer>
  );

  const renderEmpty = () => (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: '32px',
        textAlign: 'center',
      }}
    >
      <FavoriteBorderIcon sx={{ fontSize: 120, color: '#BDBDBD' }} />
      <Box sx={{ height: 32 }} />
      <Box sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: c.text }}>
        No favorites yet
      </Box>
      <Box sx={{ height: 12 }} />
      <Box sx={{ fontSize: 16, lineHeight: 1.5, color: '#9E9E9E' }}>
        You haven&apos;t saved anyone yet. Explore live requests and add people you like!
      </Box>
      <Box sx={{ height: 24 }} />
      <Box
        role="button"
        tabIndex={0}
        onClick={() => navigate('/feed', { replace: true })}
        sx={{
          height: 56,
          px: '32px',
          borderRadius: '26px',
          bgcolor: '#026AFD',
          color: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        Explore Live Requests →
      </Box>
    </Box>
  );

  const renderError = () => (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: '32px',
        textAlign: 'center',
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 120, color: '#BDBDBD' }} />
      <Box sx={{ height: 32 }} />
      <Box sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: c.text }}>
        Failed to load favorites
      </Box>
      <Box sx={{ height: 12 }} />
      <Box sx={{ fontSize: 16, lineHeight: 1.5, color: '#9E9E9E' }}>{error}</Box>
      <Box sx={{ height: 24 }} />
      <Box
        role="button"
        onClick={() => {
          setLoading(true);
          setError(null);
          void loadFavorites();
        }}
        sx={{
          height: 56,
          px: '32px',
          borderRadius: '26px',
          bgcolor: '#026AFD',
          color: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        Retry
      </Box>
    </Box>
  );

  const renderList = () => (
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
        if (pull >= 60 && !refreshing) void doRefresh();
        setPull(0);
        setTouchStart(null);
      }}
      sx={{
        flex: 1,
        overflowY: 'auto',
        overscrollBehaviorY: 'contain',
        p: '16px',
        position: 'relative',
      }}
    >
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
          }}
        >
          <CircularProgress
            size={24}
            thickness={4}
            sx={{
              color: '#026AFD',
              transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
            }}
          />
        </Box>
      )}

      {filtered.map((item, index) => {
        const avatar = pickAvatar(item.avatar, item.photos);
        const dot = c.isDark ? '#BDBDBD' : '#8E8E8E';
        const statusKey = item.status || 'offline';
        const statusDot =
          statusKey === 'available' ? '#026AFD' : statusKey === 'busy' ? '#FFFF00' : '#9E9E9E';
        const glow =
          statusKey === 'available'
            ? '0 0 8px rgba(2,106,253,0.5)'
            : statusKey === 'busy'
            ? '0 0 8px rgba(255,255,0,0.5)'
            : 'none';
        return (
          <Box
            key={item.id || item.targetUserId}
            onClick={() => void handleCardClick(item)}
            sx={{
              mb: '16px',
              p: '20px',
              borderRadius: '20px',
              bgcolor: c.isDark ? '#1C1C1E' : '#FAFAFA',
              border: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              animation: `favorite-card-in ${300 + index * 50}ms linear both`,
              '@keyframes favorite-card-in': {
                from: { opacity: 0, transform: 'translateY(20px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                bgcolor: avatar ? '#E0E0E0' : 'rgba(2,106,253,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {avatar ? (
                <Box
                  component="img"
                  src={avatar}
                  alt={item.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Box sx={{ fontSize: 32, fontWeight: 700, color: '#026AFD' }}>
                  {firstInitial(item.name)}
                </Box>
              )}
            </Box>

            <Box sx={{ ml: '16px', flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <Box
                  component="span"
                  sx={{
                    fontSize: 20,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: c.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {item.name}
                </Box>
                <Box sx={{ width: 8 }} />
                <Box
                  component="span"
                  sx={{
                    px: '8px',
                    py: '4px',
                    borderRadius: '12px',
                    bgcolor: 'rgba(2,106,253,0.10)',
                    color: '#026AFD',
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1.33,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {formatDistance(item.distance)}
                </Box>
              </Box>
              <Box sx={{ height: 8 }} />
              <Box
                sx={{
                  fontSize: 15,
                  lineHeight: 1.4,
                  color: c.isDark ? '#BDBDBD' : '#666666',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.bio?.trim() ? item.bio : 'No bio yet'}
              </Box>
              <Box sx={{ height: 8 }} />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ fontSize: 14, lineHeight: 1.43, color: dot }}>
                  ⭐ Favorited
                </Box>
                <Box sx={{ width: 12 }} />
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: statusDot,
                    boxShadow: glow,
                  }}
                />
                <Box sx={{ width: 6 }} />
                <Box component="span" sx={{ fontSize: 14, lineHeight: 1.43, color: dot }}>
                  {STATUS_LABELS[statusKey] ?? 'Offline'}
                </Box>
              </Box>
            </Box>

            <Box sx={{ width: 12 }} />
            <Box
              role="button"
              aria-label="Remove from favorites"
              onClick={(event) => {
                event.stopPropagation();
                void removeFavorite(item);
              }}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: '#FFECEF',
                boxShadow: '0 3px 6px rgba(0,0,0,0.04)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'transform 150ms ease-in-out',
                '&:active': { transform: 'scale(0.85)' },
              }}
            >
              <FavoriteIcon sx={{ fontSize: 24, color: '#E91E63' }} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Box
      sx={{
        flex: 1,
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: c.scaffold,
        overflow: 'hidden',
        pb: 'calc(60px + env(safe-area-inset-bottom))',
      }}
    >
      <FlutterAppBar
        leading={<AppLogo size={40} />}
        actions={<StatusPill label={status.label} dot={status.dot} onClick={() => void status.cycle()} />}
      />

      <Box
        sx={{
          p: '16px',
          bgcolor: c.surface,
          borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 48,
            borderRadius: '25px',
            bgcolor: c.surfaceStrong,
            border: `1px solid ${c.isDark ? 'rgba(255,255,255,0.06)' : '#E0E0E0'}`,
            boxShadow: c.isDark
              ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 8px rgba(0,0,0,0.4)'
              : '0 3px 8px rgba(0,0,0,0.07)',
            px: '16px',
          }}
        >
          <SearchIcon sx={{ fontSize: 24, color: '#9E9E9E', mr: '12px' }} />
          <Box
            component="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search favorites by name..."
            sx={{
              flex: 1,
              border: 'none',
              outline: 'none',
              bgcolor: 'transparent',
              color: c.text,
              fontSize: 16,
              fontFamily: 'inherit',
              p: 0,
              '&::placeholder': { color: c.isDark ? '#8E8E8E' : '#9E9E9E', opacity: 1 },
            }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {loading
          ? renderShimmer()
          : error
          ? renderError()
          : filtered.length === 0
          ? renderEmpty()
          : renderList()}
      </Box>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Start Conversation?"
        content={`You don't have an active chat with ${confirmTarget?.name || 'this user'} yet. Would you like to start a chat with them now?`}
        confirmLabel="Start Chat"
        cancelLabel="Cancel"
        onConfirm={() => void handleConfirmStartChat()}
        onCancel={() => setConfirmTarget(null)}
      />
    </Box>
  );
};
