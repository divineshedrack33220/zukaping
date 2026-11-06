import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import RadarIcon from '@mui/icons-material/Radar';
import ExploreOffIcon from '@mui/icons-material/ExploreOff';
import { useNavigate } from 'react-router-dom';
import { usePalette } from '../contexts/app-theme.context';
import { useAuth } from '../contexts/auth.context';
import { useMe } from '../contexts/me.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { wsService } from '../services/ws.service';
import { FeedPost, NearbyUser } from '../models/chat.models';
import { FEED_STATUSES, useStatusCycle } from '../hooks/use-status-cycle';
import { FlutterAppBar } from '../components/layout/flutter-app-bar';
import { AppLogo } from '../components/common/app-logo';
import { Shimmer, ShimmerBox } from '../components/common/shimmer';
import { StatusPill } from '../components/feed/status-pill';
import { StoryRail } from '../components/feed/story-rail';
import { PostCard } from '../components/feed/post-card';
import { RadarOverlay } from '../components/feed/radar-overlay';
import { ScanFab } from '../components/feed/scan-fab';
import { getCurrentPosition, wait } from '../utils/geo';
import { readCache, writeCache } from '../utils/screen-cache';

/**
 * `FeedScreen` (mobile_app/lib/screens/feed_screen.dart).
 * App bar logo + radar + status pill, nearby story rail, inline post cards,
 * 56 px location FAB and the full-body radar scan overlay.
 */

/* Visitors read "scanning" and expect people; "broadcasting a signal" reads
   like radio equipment and says nothing about who is close by. The overlay
   paints its own animated ellipsis, so the dots stay out of the string. */
const SCAN_TITLE = 'People nearby';
const SCAN_SUB = 'Looking for people around you';
const scanFound = (count: number) => `${count} ${count === 1 ? 'person' : 'people'} nearby`;
const SCAN_FOUND_SUB = 'Tap anyone to see their profile';
const SCAN_EMPTY_TITLE = 'Nobody nearby yet';
const SCAN_EMPTY_SUB = 'Try moving to a different location or check back later';

export const FeedScreen = () => {
  const c = usePalette();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { me } = useMe();
  const { showToast } = useSnackbar();
  const status = useStatusCycle(FEED_STATUSES);
  const statusRef = useRef(status.option?.value ?? 'available');

  const [posts, setPosts] = useState<FeedPost[]>(() => readCache<FeedPost[]>('feed') ?? []);
  const [nearby, setNearby] = useState<NearbyUser[]>(() => readCache<NearbyUser[]>('nearby') ?? []);
  const [nearbyLoading, setNearbyLoading] = useState(
    () => readCache<NearbyUser[]>('nearby') === null
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(() => readCache<FeedPost[]>('feed') === null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);

  const [radarEnabled, setRadarEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState(SCAN_TITLE);
  const [broadcastSubtext, setBroadcastSubtext] = useState(SCAN_SUB);
  const [broadcastResults, setBroadcastResults] = useState<NearbyUser[]>([]);

  const postsRef = useRef<FeedPost[]>([]);
  const scanningRef = useRef(false);
  const touchStart = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    statusRef.current = status.option?.value ?? 'available';
  }, [status.option?.value]);

  const loadNearby = useCallback(async () => {
    try {
      const position = await getCurrentPosition();
      const users = await apiService.getNearbyUsers(position?.lat, position?.lng);
      setNearby(users);
      writeCache('nearby', users.slice(0, 15));
    } catch {
      /* Flutter silently ignores auto-load failures. */
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const loadFeed = useCallback(async () => {
    try {
      const data = await apiService.getFeed();
      postsRef.current = data;
      setPosts(data);
      writeCache('feed', data.slice(0, 50));
      setError(null);
    } catch {
      if (postsRef.current.length === 0) {
        setError('Failed to load live requests');
      }
    } finally {
      setLoading(false);
    }
    void loadNearby();
  }, [loadNearby]);

  const loadFavorites = useCallback(async () => {
    try {
      const favorites = await apiService.getFavorites();
      setFavoriteIds(new Set(favorites.map((item) => item.targetUserId).filter(Boolean)));
    } catch {
      /* ignore */
    }
  }, []);

  /* ------------------------------ bootstrap ------------------------------ */

  useEffect(() => {
    void loadFeed();
    void loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 30 s auto refresh.
  useEffect(() => {
    const timer = window.setInterval(() => void loadFeed(), 30000);
    return () => window.clearInterval(timer);
  }, [loadFeed]);

  // Reload when the tab becomes visible again (Flutter `resumed`).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadFeed();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadFeed]);

  // Location push every 10 minutes while status is `available`.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (statusRef.current !== 'available') return;
      const position = await getCurrentPosition();
      if (!position) return;
      try {
        await apiService.updateLocation(position.lat, position.lng);
        void loadFeed();
      } catch {
        /* ignore */
      }
    }, 600000);
    return () => window.clearInterval(timer);
  }, [loadFeed]);

  /* ------------------------------ websocket ------------------------------ */

  useEffect(() => {
    return wsService.subscribe(({ type, payload }) => {
      switch (type) {
        case 'new_request': {
          if (!payload || payload.userId === userId) return;
          const raw = payload.post ?? payload;
          void apiService
            .getFeed()
            .then((list) => {
              const found = list.find((post) => post.id === (raw.id ?? raw._id));
              const next = found ?? (raw as FeedPost);
              if (!next?.id) return;
              setPosts((current) => {
                if (current.some((post) => post.id === next.id)) return current;
                return [next, ...current];
              });
              showToast(`📢 New request from ${next.userName ?? 'Someone'}`);
            })
            .catch(() => {
              /* ignore malformed payload */
            });
          break;
        }
        case 'request_update': {
          if (!payload) return;
          const id = payload.id ?? payload._id;
          if (!id) return;
          setPosts((current) =>
            current.map((post) => (post.id === id ? { ...post, ...payload } : post))
          );
          break;
        }
        case 'request_removed': {
          const id = payload?.requestId ?? payload?.id;
          if (!id) return;
          setPosts((current) => current.filter((post) => post.id !== id));
          break;
        }
        case 'nearby_users': {
          if (!scanningRef.current) return;
          const users = Array.isArray(payload?.users) ? (payload.users as NearbyUser[]) : [];
          setNearby(users);
          if (users.length) {
            setBroadcastText(scanFound(users.length));
            setBroadcastSubtext(SCAN_FOUND_SUB);
          } else {
            setBroadcastText(SCAN_EMPTY_TITLE);
            setBroadcastSubtext(SCAN_EMPTY_SUB);
          }
          break;
        }
        case 'post_ignored': {
          if (!payload || payload.userId === userId || payload.postId == null) return;
          setPosts((current) => current.filter((post) => post.id !== payload.postId));
          break;
        }
        case 'post_accepted': {
          if (!payload || payload.userId === userId) return;
          showToast(`🤝 ${payload.userName ?? 'Someone'} accepted a request`);
          break;
        }
        default:
          break;
      }
    });
  }, [showToast, userId]);

  /* -------------------------------- radar -------------------------------- */

  const broadcastScan = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setOverlayOpen(true);
    setBroadcastText(SCAN_TITLE);
    setBroadcastSubtext(SCAN_SUB);
    setBroadcastResults([]);
    let delivered = false;
    try {
      const position = await getCurrentPosition();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await wait(700);
        try {
          const users = await apiService.getNearbyUsers(position?.lat, position?.lng);
          delivered = true;
          if (users.length) {
            setNearby(users);
            if (attempt === 2) {
              setBroadcastResults(users);
              setBroadcastText(scanFound(users.length));
              setBroadcastSubtext(SCAN_FOUND_SUB);
            }
          } else if (attempt === 2) {
            setBroadcastText(SCAN_EMPTY_TITLE);
            setBroadcastSubtext(SCAN_EMPTY_SUB);
          }
        } catch {
          /* retry */
        }
      }
    } catch {
      showToast('Failed to scan nearby users');
    } finally {
      /* Without this the overlay keeps spinning the "scanning" copy forever when
         every request failed, which reads as a working feature. */
      if (!delivered) {
        setBroadcastText('Scan failed');
        setBroadcastSubtext('Could not read your location');
      }
      scanningRef.current = false;
      setScanning(false);
    }
  }, [showToast]);

  const toggleRadar = () => {
    if (radarEnabled) {
      setRadarEnabled(false);
      setOverlayOpen(false);
      setScanning(false);
      scanningRef.current = false;
      showToast('Radar Deactivated');
    } else {
      setRadarEnabled(true);
      showToast('Radar Activated 📡');
      void broadcastScan();
    }
  };

  /* ------------------------------- actions ------------------------------- */

  const handleIgnore = (post: FeedPost) => {
    setPosts((current) => current.filter((item) => item.id !== post.id));
    showToast('👎 Request ignored');
    wsService.send('post_ignored', {
      postId: post.id,
      userId,
      targetUserId: post.userId,
    });
  };

  const handleFavorite = async (post: FeedPost) => {
    const currentlyFavorited = favoriteIds.has(post.userId);
    try {
      await apiService.toggleFavorite(post.userId, currentlyFavorited);
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (currentlyFavorited) next.delete(post.userId);
        else next.add(post.userId);
        return next;
      });
      showToast(currentlyFavorited ? '💔 Removed from favorites' : '❤️ Added to favorites');
      setPosts((current) => current.filter((item) => item.id !== post.id));
      wsService.send('post_favorited', {
        postId: post.id,
        userId,
        targetUserId: post.userId,
      });
    } catch {
      showToast('Failed to update favorite');
    }
  };

  const handleAccept = async (post: FeedPost) => {
    try {
      const chat = await apiService.createChat(post.userId);
      showToast('🤝 Chat created!');
      wsService.send('post_accepted', {
        postId: post.id,
        userId,
        targetUserId: post.userId,
        chatId: chat.id,
      });
      setPosts((current) => current.filter((item) => item.id !== post.id));
      navigate(`/chat/${chat.id}`);
    } catch {
      showToast('Failed to create chat');
    }
  };

  const startChat = async (targetUserId: string) => {
    try {
      const chat = await apiService.createChat(targetUserId);
      setOverlayOpen(false);
      navigate(`/chat/${chat.id}`);
    } catch {
      showToast('Failed to create chat');
    }
  };

  const doRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    await loadFavorites();
    setRefreshing(false);
    showToast('🔄 Feed refreshed');
  };

  /* -------------------------------- render ------------------------------- */

  /* StoryRail already shimmers its own band while `nearbyLoading`, so this
     placeholder draws only the cards — two round carousels at once reads as a
     glitch, not as loading. */
  const renderShimmer = () => (
    <Shimmer>
      <Box sx={{ flex: 1, overflow: 'hidden', p: '16px' }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Box
            key={index}
            sx={{
              mb: '16px',
              p: '20px',
              borderRadius: '16px',
              border: `1px solid ${c.isDark ? '#2C2C2E' : '#F5F5F5'}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ShimmerBox width={64} height={64} radius={32} />
              <Box sx={{ ml: '16px' }}>
                <ShimmerBox width={120} height={16} />
                <Box sx={{ height: 8 }} />
                <ShimmerBox width={60} height={12} />
              </Box>
            </Box>
            <Box sx={{ height: 20 }} />
            <ShimmerBox height={14} />
            <Box sx={{ height: 8 }} />
            <ShimmerBox height={14} />
            <Box sx={{ height: 8 }} />
            <ShimmerBox width={150} height={14} />
            <Box sx={{ height: 16 }} />
            <ShimmerBox height={180} radius={12} />
          </Box>
        ))}
      </Box>
    </Shimmer>
  );

  const renderBody = () => {
    if (loading) return renderShimmer();
    if (error) {
      return (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: '24px',
          }}
        >
          <Box sx={{ fontSize: 18, lineHeight: 1.4, color: '#9E9E9E', textAlign: 'center' }}>
            {error}
          </Box>
          <Box sx={{ height: 16 }} />
          <Box
            role="button"
            tabIndex={0}
            onClick={() => {
              setLoading(true);
              void loadFeed();
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
    }
    if (!posts.length) {
      return (
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
          <ExploreOffIcon sx={{ fontSize: 96, color: '#BDBDBD' }} />
          <Box sx={{ height: 24 }} />
          <Box sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: '#616161' }}>
            No live requests right now
          </Box>
          <Box sx={{ height: 12 }} />
          <Box sx={{ fontSize: 16, lineHeight: 1.5, color: '#9E9E9E' }}>
            Be the first to post a request or check back soon — people are always looking to
            connect nearby.
          </Box>
        </Box>
      );
    }

    return (
      <Box
        ref={scrollRef}
        onTouchStart={(event) => {
          if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
            touchStart.current = event.touches[0]?.clientY ?? null;
          }
        }}
        onTouchMove={(event) => {
          if (touchStart.current == null) return;
          const delta = (event.touches[0]?.clientY ?? 0) - touchStart.current;
          if (delta > 0) setPull(Math.min(delta * 0.5, 100));
        }}
        onTouchEnd={() => {
          if (pull >= 60 && !refreshing) void doRefresh();
          setPull(0);
          touchStart.current = null;
        }}
        sx={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehaviorY: 'contain',
          p: '16px',
          scrollbarWidth: 'thin',
        }}
      >
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            index={index}
            isOwn={post.userId === userId}
            isFavorited={favoriteIds.has(post.userId)}
            onOpen={(id) =>
              navigate(`/view-profile/${id}`, {
                state: {
                  user: {
                    id: post.userId,
                    name: post.userName,
                    avatar: post.userAvatar,
                    photos: post.userPhotos,
                    status: post.userStatus,
                    distance: post.distance,
                  },
                },
              })
            }
            onIgnore={handleIgnore}
            onFavorite={(item) => void handleFavorite(item)}
            onAccept={(item) => void handleAccept(item)}
          />
        ))}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: 'var(--app-h, 100dvh)',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: c.scaffold,
        overflow: 'hidden',
        pb: 'calc(60px + env(safe-area-inset-bottom))',
      }}
    >
      <FlutterAppBar
        leading={<AppLogo size={40} />}
        actions={
          <>
            <Box
              role="button"
              aria-label={radarEnabled ? 'Disable radar' : 'Enable radar'}
              tabIndex={0}
              onClick={toggleRadar}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') toggleRadar();
              }}
              sx={{
                width: 48,
                height: 48,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: radarEnabled ? '#026AFD' : '#9E9E9E',
              }}
            >
              <RadarIcon sx={{ fontSize: 24 }} />
            </Box>
            <StatusPill label={status.label} dot={status.dot} onClick={() => void status.cycle()} />
          </>
        }
      />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <StoryRail
          users={nearby}
          currentUserId={me?.id ?? userId}
          loading={nearbyLoading}
          onOpen={(id) => {
            const target = nearby.find((u) => u.id === id);
            navigate(`/view-profile/${id}`, {
              state: target ? { user: target } : undefined,
            });
          }}
        />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {renderBody()}

          {/* pull-to-refresh indicator */}
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

          {/* 56 px scan FAB */}
          <ScanFab count={nearby.length} onScan={() => void broadcastScan()} />

          <RadarOverlay
            open={overlayOpen}
            users={broadcastResults}
            scanning={scanning}
            title={broadcastText}
            subtitle={broadcastSubtext}
            onClose={() => {
              setOverlayOpen(false);
              setBroadcastResults([]);
            }}
            onChat={(id) => void startChat(id)}
            onView={(id) => {
              const target = broadcastResults.find((u) => u.id === id);
              navigate(`/view-profile/${id}`, {
                state: target ? { user: target } : undefined,
              });
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
