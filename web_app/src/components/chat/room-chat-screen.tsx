import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, IconButton, InputBase } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import { usePalette } from '../../contexts/app-theme.context';
import { useAuth } from '../../contexts/auth.context';
import { useSnackbar } from '../../contexts/snackbar.context';
import { apiService } from '../../services/api.service';
import { wsService } from '../../services/ws.service';
import { Chat, Message } from '../../models/chat.models';
import { firstInitial, parseTimestamp, pickAvatar } from '../../utils/format';
import { isImageMessage, parseImageUrls } from '../../utils/messages';
import { ConfirmDialog } from '../common/confirm-dialog';
import { useImageSourceSheet } from '../common/image-source-sheet';
import { FullScreenViewer } from '../common/fullscreen-viewer';
import { onViewportShrink } from '../../utils/viewport';
import { readCache, writeCache } from '../../utils/screen-cache';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const AVATAR_PLACEHOLDER_DARK = '#2C2C2E';
const AVATAR_PLACEHOLDER_LIGHT = '#F5F5F5';

const RoomAvatar = ({ image, name, size = 32 }: { image: string | null; name: string; size?: number }) => {
  const c = usePalette();
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: c.isDark ? AVATAR_PLACEHOLDER_DARK : AVATAR_PLACEHOLDER_LIGHT,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {image ? (
        <Box component="img" src={image} alt={name} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(2,106,253,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.44,
            fontWeight: 700,
            color: '#026AFD',
          }}
        >
          {firstInitial(name)}
        </Box>
      )}
    </Box>
  );
};

const RoomImageTile = ({ url, onTap }: { url: string; onTap: () => void }) => {
  const c = usePalette();
  const [failed, setFailed] = useState(false);
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="Open photo"
      onClick={onTap}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTap();
        }
      }}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        cursor: 'pointer',
        bgcolor: c.isDark ? '#1C1C1E' : '#EEEEEE',
      }}
    >
      {failed ? (
        <BrokenImageIcon
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 26,
            color: '#9E9E9E',
          }}
        />
      ) : (
        <Box
          component="img"
          src={url}
          alt=""
          onError={() => setFailed(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </Box>
  );
};

const RoomBubble = ({
  message,
  isMe,
  senderName,
  senderAvatar,
  onImageTap,
}: {
  message: Message;
  isMe: boolean;
  senderName?: string;
  senderAvatar?: string | null;
  onImageTap?: (urls: string[], index: number) => void;
}) => {
  const c = usePalette();
  const images = isImageMessage(message) ? parseImageUrls(message.content) : [];

  const bubble = (
    <Box
      sx={{
        p: '10px 14px',
        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isMe ? '#026AFD' : c.isDark ? '#1C1C1E' : '#F5F5F5',
        minWidth: 0,
        maxWidth: '80%',
      }}
    >
      {images.length > 0 ? (
        /* Tiles, not four full-size images stacked in one box: the previous
           markup painted every url on top of the last one. */
        <Box
          sx={{
            width: 200,
            height: 150,
            maxWidth: '100%',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'grid',
            gap: '2px',
            gridTemplateColumns: `repeat(${images.length === 1 ? 1 : 2}, 1fr)`,
            gridAutoRows: '1fr',
            bgcolor: c.isDark ? '#1C1C1E' : '#EEEEEE',
          }}
        >
          {images.slice(0, 4).map((url, index) => (
            <RoomImageTile key={`${url}-${index}`} url={url} onTap={() => onImageTap?.(images, index)} />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            fontSize: 14.5,
            lineHeight: 1.3,
            color: isMe ? '#FFFFFF' : c.isDark ? '#FFFFFF' : '#000000DE',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%', mb: '6px' }}>
      {!isMe && (
        <>
          <RoomAvatar image={senderAvatar} name={senderName || 'User'} />
          <Box sx={{ width: '8px', flexShrink: 0 }} />
        </>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
        {!isMe && (
          <Box sx={{ fontSize: 11, fontWeight: 700, color: c.isDark ? '#BDBDBD' : '#757575', mb: '2px', px: '4px' }}>
            {senderName || 'User'}
          </Box>
        )}
        {bubble}
      </Box>
      {isMe && (
        <>
          <Box sx={{ width: '8px', flexShrink: 0 }} />
          <RoomAvatar image={senderAvatar} name="You" />
        </>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* main screen                                                         */
/* ------------------------------------------------------------------ */

export const RoomChatScreen = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const c = usePalette();
  const { userId } = useAuth();
  const { showToast } = useSnackbar();

  const [roomName, setRoomName] = useState('Room Chat');
  const [roomAvatar, setRoomAvatar] = useState<string | null>(null);
  const [roomDescription, setRoomDescription] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>(
    () => readCache<Message[]>(`messages.${roomId}`) ?? []
  );
  const [loading, setLoading] = useState(() => readCache<Message[]>(`messages.${roomId}`) === null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [carousel, setCarousel] = useState<{ images: string[]; index: number } | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const { requestImage, sheet } = useImageSourceSheet();
  const meRef = useRef<string>(userId ?? '');
  const roomIdRef = useRef<string>(roomId ?? '');

  useEffect(() => {
    meRef.current = userId ?? '';
  }, [userId]);
  useEffect(() => {
    roomIdRef.current = roomId ?? '';
  }, [roomId]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = 0; // reverse list: offset 0 == bottom
  }, []);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const details: any = await apiService.getRoomDetails(roomId);
      const data: any = details?.room ?? details ?? {};
      setRoomName(data?.name || data?.groupName || 'Room Chat');
      setRoomAvatar(data?.avatar_url ?? data?.avatarUrl ?? data?.groupAvatar ?? null);
      setRoomDescription(data?.description ?? data?.groupDescription ?? '');
      setMemberCount(
        Number(details?.member_count ?? data?.current_members ?? data?.currentMembers ?? 0)
      );
      /* Full history lives in the chats collection, and a room you never joined has
         no chat row naming you, so asking for it is a guaranteed 403. Read the room's
         own preview instead. */
      const joined = Boolean(details?.is_joined ?? data?.is_joined);
      const history = joined
        ? await apiService.getMessages(roomId).catch(() => [] as Message[])
        : ((details?.preview_messages ?? data?.preview_messages ?? []) as any[]).map(
            (m) =>
              ({
                id: m.id,
                senderId: '',
                senderName: m.sender_name,
                content: m.content,
                type: m.type,
                createdAt: parseTimestamp(m.created_at),
                isRead: true,
                reactions: {},
              }) as Message
          );
      setMessages(history);
      wsService.send('subscribe_chat', { chatId: roomId });
      setLoading(false);
      scrollToBottom();
    } catch {
      setLoading(false);
      showToast('Failed to load room');
    }
  }, [roomId, scrollToBottom, showToast]);

  useEffect(() => {
    void loadRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (roomId) writeCache(`messages.${roomId}`, messages.slice(-120));
  }, [roomId, messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, typing, scrollToBottom]);
  // A keyboard that shrinks the shell must not strand the newest message under it.
  useEffect(() => onViewportShrink(scrollToBottom), [scrollToBottom]);

  /* ---------------------------- websocket ---------------------------- */

  useEffect(() => {
    if (!roomId) return;
    return wsService.subscribe(({ type, payload }) => {
      if (!payload) return;
      if (payload.chatId && payload.chatId !== roomId) return;
      switch (type) {
        case 'new_message': {
          const incoming: Message = {
            id: payload.id ?? payload._id ?? `ws_${Date.now()}`,
            chatId: roomId,
            senderId: payload.senderId ?? payload.sender?._id ?? '',
            content: payload.content ?? '',
            type: payload.type ?? 'text',
            createdAt: payload.createdAt ? Number(payload.createdAt) * 1000 || Date.now() : Date.now(),
            isRead: payload.isRead === true,
            reactions: payload.reactions ?? {},
            replyToId: payload.replyToId,
            replyToContent: payload.replyToContent,
            replyToSenderName: payload.replyToSenderName,
            senderName: payload.senderName ?? payload.sender?.name,
            senderAvatar: payload.senderAvatar ?? payload.sender?.avatar,
          };
          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) return current;
            const optimisticIndex = current.findIndex(
              (message) => message.id.startsWith('opt_') && message.content === incoming.content && message.senderId === incoming.senderId
            );
            if (optimisticIndex >= 0) {
              const next = [...current];
              next[optimisticIndex] = incoming;
              return next;
            }
            return [...current, incoming];
          });
          break;
        }
        case 'message_read': {
          const ids: string[] = Array.isArray(payload.messageIds) ? payload.messageIds : [];
          if (!ids.length) return;
          setMessages((current) => current.map((message) => (ids.includes(message.id) ? { ...message, isRead: true } : message)));
          break;
        }
        case 'typing_start': {
          if (payload.userId === meRef.current) return;
          setTyping(true);
          window.clearTimeout(typingTimer.current ?? undefined);
          typingTimer.current = window.setTimeout(() => setTyping(false), 5000);
          break;
        }
        case 'typing_end':
          setTyping(false);
          break;
        case 'message_reaction': {
          setMessages((current) =>
            current.map((message) => (message.id === payload.messageId ? { ...message, reactions: payload.reactions ?? {} } : message))
          );
          break;
        }
        case 'room_update': {
          const nextCount = Number(payload?.currentMembers ?? payload?.memberCount ?? memberCount);
          setMemberCount(Number.isFinite(nextCount) ? nextCount : 0);
          break;
        }
        default:
          break;
      }
    });
  }, [roomId, memberCount]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  /* ------------------------------ sending ------------------------------ */

  const sendTextMessage = async (customText?: string) => {
    const value = (customText ?? text).trim();
    if (!value || !roomId) return;
    if (!customText) setText('');
    setSending(true);
    const optimistic: Message = {
      id: `opt_${Date.now()}`,
      chatId: roomId,
      senderId: userId ?? '',
      content: value,
      type: value.length <= 10 ? 'emoji' : 'text',
      createdAt: Date.now(),
      isRead: false,
      reactions: {},
    };
    setMessages((current) => [...current, optimistic]);
    scrollToBottom();
    try {
      const saved = await apiService.sendMessage({ chatId: roomId, content: value, type: 'text' });
      setMessages((current) => current.map((message) => (message.id === optimistic.id ? saved : message)));
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      showToast('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File) => {
    if (!roomId) return;
    const optimistic: Message = {
      id: `opt_img_${Date.now()}`,
      chatId: roomId,
      senderId: userId ?? '',
      content: JSON.stringify([URL.createObjectURL(file)]),
      type: 'image',
      createdAt: Date.now(),
      isRead: false,
      reactions: {},
    };
    setMessages((current) => [...current, optimistic]);
    scrollToBottom();
    try {
      const url = await apiService.uploadImage(file);
      if (!url) throw new Error('upload failed');
      const saved = await apiService.sendMessage({ chatId: roomId, content: JSON.stringify([url]), type: 'image' });
      setMessages((current) => current.map((message) => (message.id === optimistic.id ? saved : message)));
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      showToast('Failed to upload photo');
    }
  };

  /* -------------------------------- render ------------------------------ */

  const renderShimmer = () => (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: '#026AFD' }} />
    </Box>
  );

  const renderEmpty = () => (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ fontSize: 50, lineHeight: 1 }}>🌱</Box>
      <Box sx={{ height: 12 }} />
      <Box sx={{ fontSize: 16, fontWeight: 700, color: c.isDark ? '#FFFFFF' : '#424242' }}>Welcome to {roomName}!</Box>
      <Box sx={{ height: 4 }} />
      <Box sx={{ px: '40px', textAlign: 'center', fontSize: 13, color: '#9E9E9E' }}>Be respectful, vibe out, and say hi to the room members!</Box>
    </Box>
  );

  const renderMessage = (message: Message) => {
    const isMe = message.senderId === userId;
    const senderName = isMe ? undefined : message.senderName || 'User';
    return (
      <RoomBubble
        key={message.id}
        message={message}
        isMe={isMe}
        senderName={senderName}
        senderAvatar={message.senderAvatar}
        onImageTap={(urls, index) => setCarousel({ images: urls, index })}
      />
    );
  };

  const sendDisabled = sending || !text.trim();

  return (
    <Box sx={{ height: 'var(--app-h, 100dvh)', display: 'flex', flexDirection: 'column', bgcolor: c.isDark ? '#121212' : '#F8F9FA', overflow: 'hidden', position: 'relative' }}>
      {/* app bar */}
      <Box
        component="header"
        sx={{
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          pt: 'max(12px, env(safe-area-inset-top))',
          pb: '12px',
          bgcolor: c.isDark ? 'rgba(18,18,18,0.7)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', pr: '8px' }}>
          <Box
            role="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            sx={{ width: 48, height: 48, display: 'grid', placeItems: 'center', cursor: 'pointer', color: c.text, flexShrink: 0 }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {roomAvatar ? (
                <Box component="img" src={roomAvatar} alt={roomName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Box sx={{ width: '100%', height: '100%', bgcolor: 'rgba(2,106,253,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#026AFD' }}>
                  {firstInitial(roomName)}
                </Box>
              )}
            </Box>
            <Box sx={{ width: 10 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2, color: c.isDark ? '#FFFFFF' : '#000000DE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {roomName}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mt: '2px' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#34C759' }} />
                <Box sx={{ fontSize: 11, fontWeight: 600, color: '#757575' }}>👥 {memberCount} members</Box>
              </Box>
            </Box>
          </Box>
          <Box
            role="button"
            aria-label="Menu"
            onClick={() => setLeaveOpen(true)}
            sx={{ width: 48, height: 48, display: 'grid', placeItems: 'center', cursor: 'pointer', color: c.text, flexShrink: 0 }}
          >
            <MoreHorizIcon sx={{ fontSize: 24 }} />
          </Box>
        </Box>
      </Box>

      {/* body */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {loading ? (
          renderShimmer()
        ) : messages.length === 0 ? (
          renderEmpty()
        ) : (
          <Box
            ref={listRef}
            sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', px: '16px', py: '12px', display: 'flex', flexDirection: 'column' }}
          >
            {messages.map(renderMessage)}
          </Box>
        )}

        {typing && (
          <Box sx={{ display: 'flex', alignItems: 'center', px: '24px', pb: '8px' }}>
            <Box sx={{ fontSize: 12, fontStyle: 'italic', color: '#9E9E9E' }}>Someone is typing...</Box>
          </Box>
        )}

        {/* input bar */}
        <Box sx={{ flexShrink: 0, bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF', borderTop: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`, pb: 'env(safe-area-inset-bottom)' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', p: '12px', gap: '8px' }}>
            <IconButton
              aria-label="Add photo"
              onClick={() =>
                requestImage({
                  title: 'Send a photo',
                  onPick: ([file]) => void sendImage(file),
                })
              }
              sx={{ color: '#026AFD', flexShrink: 0 }}
            >
              <PhotoLibraryOutlinedIcon sx={{ fontSize: 26 }} />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <InputBase
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type your message..."
                inputRef={inputRef}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 44,
                  px: '16px',
                  borderRadius: 22,
                  bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
                  '& .MuiInputBase-input': {
                    py: '10px 0',
                    fontSize: 14.5,
                    color: c.isDark ? '#FFFFFF' : '#000000',
                    px: 0,
                    '&::placeholder': { color: '#9E9E9E', opacity: 1 },
                  },
                }}
              />
            </Box>
            <Box sx={{ width: '8px', flexShrink: 0 }} />
            <Box
              role="button"
              aria-label="Send"
              onClick={() => void sendTextMessage()}
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                cursor: sendDisabled ? 'default' : 'pointer',
                bgcolor: sendDisabled ? (c.isDark ? '#2C2C2E' : '#EEEEEE') : '#026AFD',
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 20, color: sendDisabled ? (c.isDark ? '#757575' : '#BDBDBD') : '#FFFFFF' }} />
            </Box>
          </Box>
        </Box>
      </Box>

      {sheet}

      <ConfirmDialog
        open={leaveOpen}
        title={`Leave ${roomName}?`}
        content="You'll stop receiving messages."
        confirmLabel="Leave"
        danger
        radius={20}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={async () => {
          setLeaveOpen(false);
          try {
            await apiService.leaveRoom(roomId ?? '');
            showToast(`Left "${roomName}" successfully`);
            navigate(-1);
          } catch {
            showToast('Failed to leave room');
          }
        }}
      />

      <FullScreenViewer open={carousel != null} images={carousel?.images ?? []} initialIndex={carousel?.index ?? 0} onClose={() => setCarousel(null)} />
    </Box>
  );
};
