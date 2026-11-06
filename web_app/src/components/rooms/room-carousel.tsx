import { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useNavigate } from 'react-router-dom';
import { usePalette } from '../../contexts/app-theme.context';
import { useSnackbar } from '../../contexts/snackbar.context';
import { apiService, Room } from '../../services/api.service';
import { FlutterSheet } from '../common/flutter-sheet';

interface PreviewMessage {
  id: string;
  senderName: string;
  content: string;
}

const roomImage = (room: Room): string | null => {
  const url = room.avatarUrl?.trim();
  if (!url || url.includes('Portrait_Placeholder.png')) return null;
  return url;
};

const RoomCard = ({
  room,
  onOpen,
}: {
  room: Room;
  onOpen: (room: Room) => void;
}) => {
  const c = usePalette();
  const image = roomImage(room);
  const full = room.isFull || (room.maxMembers > 0 && room.currentMembers >= room.maxMembers);
  const trending = room.isTrending || room.currentMembers >= 10;

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onOpen(room)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(room);
      }}
      sx={{
        width: 72,
        mr: '16px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 150ms ease-out',
        '&:active': { transform: 'scale(0.95)' },
      }}
    >
      <Box
        sx={{
          width: 66,
          height: 66,
          borderRadius: '50%',
          position: 'relative',
          border: `1px solid ${c.isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0'}`,
          boxShadow: c.isDark ? '0 4px 10px rgba(0,0,0,0.55)' : '0 4px 10px rgba(0,0,0,0.12)',
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            bgcolor: c.surfaceStrong,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {image ? (
            <Box
              component="img"
              src={image}
              alt={room.name}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: c.isDark ? '#9E9E9E' : '#757575',
              }}
            >
              {room.name?.[0]?.toUpperCase() || 'R'}
            </Box>
          )}
          {full && !room.isJoined && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                bgcolor: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockRoundedIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
            </Box>
          )}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            pointerEvents: 'none',
            boxShadow: c.isDark
              ? 'inset 0 2px 3px rgba(255,255,255,0.12), inset 0 -3px 5px rgba(0,0,0,0.5)'
              : 'inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -3px 5px rgba(0,0,0,0.08)',
          }}
        />
        {trending && (
          <Box
            sx={{
              position: 'absolute',
              top: '-1px',
              right: '-1px',
              p: '2.5px',
              borderRadius: '50%',
              bgcolor: '#FF5722',
              fontSize: 10,
              lineHeight: 1,
            }}
          >
            🔥
          </Box>
        )}
      </Box>
      <Box
        sx={{
          mt: '5px',
          fontSize: 11,
          lineHeight: 1.1,
          fontWeight: 500,
          color: c.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.87)',
          textAlign: 'center',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word',
          maxWidth: 72,
        }}
      >
        {room.name}
      </Box>
    </Box>
  );
};

export const RoomCarousel = ({
  rooms,
  onRefresh,
}: {
  rooms: Room[];
  onRefresh: () => void;
}) => {
  const c = usePalette();
  const [selected, setSelected] = useState<Room | null>(null);

  if (!rooms.length) return null;

  return (
    <>
      <Box
        sx={{
          bgcolor: c.scaffold,
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        <Box
          sx={{
            pl: '16px',
            pt: '12px',
            pb: '8px',
            display: 'flex',
            alignItems: 'center',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.3px',
            color: c.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.87)',
          }}
        >
          🔥 Public Rooms Discovery
          <ExploreOutlinedIcon sx={{ ml: '4px', fontSize: 16, color: '#026AFD' }} />
        </Box>
        <Box
          sx={{
            height: 112,
            display: 'flex',
            overflowX: 'auto',
            px: '16px',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} onOpen={setSelected} />
          ))}
        </Box>
      </Box>
      <RoomPreviewSheet
        room={selected}
        onClose={() => setSelected(null)}
        onRefresh={onRefresh}
      />
    </>
  );
};

const RoomPreviewSheet = ({
  room,
  onClose,
  onRefresh,
}: {
  room: Room | null;
  onClose: () => void;
  onRefresh: () => void;
}) => {
  const c = usePalette();
  const navigate = useNavigate();
  const { showToast } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (!room) {
      setDetails(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    apiService
      .getRoomDetails(room.id)
      .then((data) => {
        if (active) setDetails(data);
      })
      .catch(() => {
        if (active) setError('Failed to load details');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [room]);

  const detailedRoom = details?.room ?? details ?? null;
  const memberCount = useMemo(() => {
    const raw = details?.member_count ?? detailedRoom?.current_members ?? room?.currentMembers;
    const numeric = Number(raw);
    return Number.isNaN(numeric) ? 0 : numeric;
  }, [details, detailedRoom, room]);

  const isJoined = Boolean(details?.is_joined ?? detailedRoom?.is_joined ?? room?.isJoined);
  const maxMembers = Number(detailedRoom?.max_members ?? room?.maxMembers ?? 0);
  const isFull = Boolean(detailedRoom?.is_full) || (maxMembers > 0 && memberCount >= maxMembers);
  const trending =
    Boolean(detailedRoom?.is_trending ?? room?.isTrending) || memberCount >= 10;
  const category = String(detailedRoom?.category ?? room?.category ?? '');
  const description = String(
    detailedRoom?.description ?? room?.description ?? ''
  );
  const tags: string[] = Array.isArray(detailedRoom?.tags)
    ? detailedRoom.tags.map(String)
    : room?.tags ?? [];
  const previews: PreviewMessage[] = useMemo(() => {
    const list = details?.preview_messages ?? details?.previewMessages ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((item: any, index: number) => ({
      id: String(item?.id ?? item?._id ?? index),
      senderName: String(item?.sender_name ?? item?.senderName ?? item?.sender?.name ?? 'User'),
      content: String(item?.content ?? ''),
    }));
  }, [details]);

  const openChat = () => {
    if (!room) return;
    onClose();
    navigate(`/room/${room.id}`);
  };

  const join = async () => {
    if (!room) return;
    setJoining(true);
    try {
      await apiService.joinRoom(room.id);
      onRefresh();
      onClose();
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to join room';
      showToast(String(message).replace(/^Exception:\s*/, ''), {
        backgroundColor: '#FF453A',
        duration: 4000,
      });
      setJoining(false);
    }
  };

  return (
    <FlutterSheet open={Boolean(room)} onClose={onClose} radius={28} background={c.isDark ? '#1C1C1E' : '#FFFFFF'}>
      <Box sx={{ pt: '8px', pb: '24px', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            width: 44,
            height: 5,
            borderRadius: '10px',
            bgcolor: c.isDark ? '#424242' : '#E0E0E0',
            mx: 'auto',
          }}
        />

        {loading && !details ? (
          <Box sx={{ py: '40px', display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={36} sx={{ color: '#026AFD' }} />
          </Box>
        ) : error ? (
          <Box
            sx={{
              py: '40px',
              textAlign: 'center',
              fontSize: 14,
              color: '#9E9E9E',
            }}
          >
            {error}
          </Box>
        ) : room ? (
          <>
            <Box sx={{ mt: '16px', display: 'flex', alignItems: 'center', px: '16px' }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: c.isDark ? '#212121' : '#F5F5F5',
                  border: `1px solid ${c.isDark ? '#424242' : '#EEEEEE'}`,
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {roomImage(room) ? (
                  <Box
                    component="img"
                    src={roomImage(room)!}
                    alt={room.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      bgcolor: 'rgba(2,106,253,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 700,
                      color: '#026AFD',
                    }}
                  >
                    {room.name?.[0]?.toUpperCase() || 'R'}
                  </Box>
                )}
              </Box>
              <Box sx={{ ml: '16px', minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Box sx={{ fontSize: 18, fontWeight: 800, color: c.text }}>
                    {room.name}
                  </Box>
                  {trending && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: '8px',
                        py: '4px',
                        borderRadius: '20px',
                        bgcolor: c.isDark ? 'rgba(255,152,0,0.12)' : '#FFF3E0',
                        border: `0.5px solid ${c.isDark ? 'rgba(255,152,0,0.3)' : '#FFCC80'}`,
                      }}
                    >
                      <Box component="span" sx={{ fontSize: 12 }}>
                        🔥
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          ml: '2px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#FF9800',
                        }}
                      >
                        Trending
                      </Box>
                    </Box>
                  )}
                </Box>
                <Box
                  sx={{
                    pt: '4px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: c.isDark ? '#BDBDBD' : '#757575',
                  }}
                >
                  👥 {memberCount} / {maxMembers || '—'} members • Category:{' '}
                  {category.toUpperCase()}
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                mt: '12px',
                px: '20px',
                fontSize: 14,
                lineHeight: 1.3,
                color: c.isDark ? '#E0E0E0' : 'rgba(0,0,0,0.54)',
              }}
            >
              {description}
            </Box>

            {tags.length > 0 && (
              <Box
                sx={{
                  mt: '12px',
                  my: '4px',
                  height: 32,
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  px: '20px',
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                {tags.map((tag) => (
                  <Box
                    key={tag}
                    sx={{
                      flexShrink: 0,
                      px: '12px',
                      py: '6px',
                      borderRadius: '16px',
                      bgcolor: 'rgba(2,106,253,0.06)',
                      border: '0.5px solid rgba(2,106,253,0.15)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#026AFD',
                    }}
                  >
                    #{tag}
                  </Box>
                ))}
              </Box>
            )}

            <Box
              sx={{
                mt: '20px',
                mx: '20px',
                p: '16px',
                borderRadius: '20px',
                bgcolor: c.isDark ? '#2C2C2E' : '#FAFAFA',
                border: `0.5px solid ${c.isDark ? '#424242' : '#EEEEEE'}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <BlurOnRoundedIcon
                  sx={{ fontSize: 18, color: c.isDark ? '#BDBDBD' : '#9E9E9E' }}
                />
                <Box
                  component="span"
                  sx={{
                    ml: '6px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: c.isDark ? '#BDBDBD' : '#9E9E9E',
                  }}
                >
                  💬 Live Room Preview
                </Box>
              </Box>
              <Box sx={{ mt: '12px' }}>
                {previews.length === 0 ? (
                  <Box
                    sx={{
                      py: '12px',
                      fontSize: 13,
                      fontStyle: 'italic',
                      color: '#9E9E9E',
                    }}
                  >
                    No messages in this room yet. Be the first to start the vibe!
                  </Box>
                ) : (
                  previews.slice(0, 5).map((message) => (
                    <Box
                      key={message.id}
                      sx={{ pb: '8px', display: 'flex', alignItems: 'flex-start' }}
                    >
                      <Box sx={{ fontSize: 13, lineHeight: '18px' }}>
                        <Box
                          component="span"
                          sx={{
                            fontWeight: 700,
                            color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.87)',
                          }}
                        >
                          {message.senderName}:{' '}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            color: c.isDark ? '#E0E0E0' : 'rgba(0,0,0,0.54)',
                            filter: 'blur(4.5px)',
                          }}
                        >
                          {message.content}
                        </Box>
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </Box>

            <Box sx={{ mt: '24px', px: '20px' }}>
              {isJoined ? (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={openChat}
                  startIcon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 20 }} />}
                  sx={{
                    minHeight: 56,
                    borderRadius: '26px',
                    bgcolor: '#026AFD',
                    fontSize: 16,
                    fontWeight: 700,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#026AFD' },
                  }}
                >
                  Open Chat Room
                </Button>
              ) : isFull ? (
                <Button
                  fullWidth
                  disabled
                  startIcon={<LockOutlinedIcon sx={{ fontSize: 20 }} />}
                  sx={{
                    minHeight: 56,
                    borderRadius: '26px',
                    bgcolor: '#9E9E9E',
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  Room is Full
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  disabled={joining}
                  onClick={join}
                  startIcon={
                    joining ? undefined : <LoginRoundedIcon sx={{ fontSize: 20 }} />
                  }
                  sx={{
                    minHeight: 56,
                    borderRadius: '26px',
                    bgcolor: '#026AFD',
                    fontSize: 16,
                    fontWeight: 700,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#026AFD' },
                  }}
                >
                  {joining ? (
                    <CircularProgress size={20} sx={{ color: '#FFFFFF' }} />
                  ) : (
                    'Join Room & Start Chatting'
                  )}
                </Button>
              )}
              <Box
                role="button"
                onClick={onClose}
                sx={{
                  mt: '8px',
                  py: '8px',
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  color: c.isDark ? '#BDBDBD' : '#9E9E9E',
                  cursor: 'pointer',
                }}
              >
                Maybe Later
              </Box>
            </Box>
          </>
        ) : null}
      </Box>
    </FlutterSheet>
  );
};
