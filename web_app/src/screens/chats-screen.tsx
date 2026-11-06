import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import AddAPhotoRoundedIcon from '@mui/icons-material/AddAPhotoRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate } from 'react-router-dom';
import { usePalette } from '../contexts/app-theme.context';
import { useAuth } from '../contexts/auth.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService, isImageContent } from '../services/api.service';
import { wsService } from '../services/ws.service';
import { Chat, NearbyUser, Room } from '../models/chat.models';
import { CHAT_STATUSES, useStatusCycle } from '../hooks/use-status-cycle';
import { FlutterAppBar } from '../components/layout/flutter-app-bar';
import { usePublishChatsCount } from '../contexts/nav-badges.context';
import { AppLogo } from '../components/common/app-logo';
import { StatusPill } from '../components/feed/status-pill';
import { RoomCarousel } from '../components/rooms/room-carousel';
import { FlutterSheet } from '../components/common/flutter-sheet';
import { useImageSourceSheet } from '../components/common/image-source-sheet';
import { firstInitial, formatChatTimestamp, pickAvatar } from '../utils/format';
import { readCache, writeCache } from '../utils/screen-cache';
import { NAV_CLEARANCE } from '../styles/tokens';

const AVATAR_PLACEHOLDER_DARK = '#1C1C1E';
const AVATAR_PLACEHOLDER_LIGHT = '#F5F5F5';

/** `_getLastMessagePreview` — 30 char truncation, photo marker, empty copy. */
const messagePreview = (chat: Chat): string => {
  const text = chat.lastMessage ?? '';
  if (!text) return 'No messages yet';
  if (chat.lastMessageType === 'image') return '📷 Photo';
  return text.length > 30 ? `${text.substring(0, 30)}...` : text;
};

/** Avatar disc with depth: lit rim, drop shadow and an inner highlight arc.
 *  No presence ring, no colour wash — only the red unread pill stands out. */
const PulseAvatar = ({
  image,
  name,
  size = 60,
}: {
  image: string | null;
  name: string;
  size?: number;
}) => {
  const c = usePalette();
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: c.isDark ? AVATAR_PLACEHOLDER_DARK : AVATAR_PLACEHOLDER_LIGHT,
        border: `1px solid ${c.isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0'}`,
        boxShadow: c.isDark ? '0 4px 10px rgba(0,0,0,0.55)' : '0 4px 10px rgba(0,0,0,0.12)',
      }}
    >
      {image && (
        <Box
          component="img"
          src={image}
          alt={name}
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.4,
          fontWeight: 700,
          color: c.isDark ? '#9E9E9E' : '#757575',
        }}
      >
        {firstInitial(name)}
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
    </Box>
  );
};

/** `_buildTypingIndicator` — blue "Typing" + three phase-shifted dots. */
const TypingIndicator = () => (
  <Box sx={{ display: 'flex', alignItems: 'center' }}>
    <Box component="span" sx={{ fontSize: 14, fontWeight: 700, color: '#026AFD', lineHeight: 1.43 }}>
      Typing
    </Box>
    <Box sx={{ width: 4 }} />
    {[0, 1, 2].map((index) => (
      <Box
        key={index}
        sx={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          bgcolor: '#026AFD',
          mx: '1px',
          animation: 'chat-typing-dot 1200ms linear infinite',
          animationDelay: `${index * 200}ms`,
          '@keyframes chat-typing-dot': {
            '0%, 100%': { opacity: 0.3 },
            '50%': { opacity: 1 },
          },
        }}
      />
    ))}
  </Box>
);

/** FAB menu — the two ways to start something from the Chats tab. */
const ChatActionMenuSheet = ({
  open,
  onClose,
  onOpenFindFriends,
  onOpenCreateGroup,
}: {
  open: boolean;
  onClose: () => void;
  onOpenFindFriends: () => void;
  onOpenCreateGroup: () => void;
}) => {
  const c = usePalette();

  const actions = [
    {
      key: 'find',
      label: 'Find friends',
      caption: 'Search people and start a chat',
      Icon: PersonAddAlt1RoundedIcon,
      run: onOpenFindFriends,
    },
    {
      key: 'group',
      label: 'Create group',
      caption: 'Name a group and invite people in',
      Icon: GroupRoundedIcon,
      run: onOpenCreateGroup,
    },
  ];

  return (
    <FlutterSheet open={open} onClose={onClose} padding={0}>
      <Box sx={{ px: '20px', pt: '20px', pb: 'calc(20px + env(safe-area-inset-bottom))' }}>
        <Box
          sx={{
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.4,
            textAlign: 'center',
            color: c.text,
            mb: '20px',
          }}
        >
          New chat or group
        </Box>
        {actions.map(({ key, label, caption, Icon, run }) => (
          <Box
            key={key}
            role="button"
            tabIndex={0}
            onClick={() => {
              onClose();
              run();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                onClose();
                run();
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              p: '16px',
              mb: '12px',
              borderRadius: '16px',
              bgcolor: c.surface,
              cursor: 'pointer',
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: `${c.primary}1F`,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Icon sx={{ fontSize: 24, color: c.primary }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: 16, fontWeight: 600, color: c.text }}>{label}</Box>
              <Box sx={{ fontSize: 13, color: c.textSecondary }}>{caption}</Box>
            </Box>
          </Box>
        ))}
      </Box>
    </FlutterSheet>
  );
};

/** `_GlobalUserSearchModal` — 85 % tall sheet, 500 ms debounced search. */
const FindFriendsSheet = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const c = usePalette();
  const { showToast } = useSnackbar();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NearbyUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSearching(false);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const users = await apiService.searchUsers(trimmed);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [query]);

  const startChat = async (user: NearbyUser) => {
    try {
      const chat = await apiService.createChat(user.id);
      onClose();
      navigate(`/chat/${chat.id}`);
    } catch {
      showToast('Failed to start chat');
    }
  };

  return (
    <FlutterSheet
      open={open}
      onClose={onClose}
      handle={false}
      maxHeight="calc(var(--app-h, 100dvh) * 0.85)"
      background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      padding={0}
    >
      <Box sx={{ height: 'calc(var(--app-h, 100dvh) * 0.85)', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ height: 12 }} />
        <Box
          sx={{
            width: 48,
            height: 5,
            borderRadius: '2.5px',
            bgcolor: c.isDark ? '#424242' : '#E0E0E0',
            mx: 'auto',
            flexShrink: 0,
          }}
        />
        <Box sx={{ height: 16 }} />
        <Box
          sx={{
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.4,
            textAlign: 'center',
            color: c.isDark ? '#FFFFFF' : '#000000DE',
            flexShrink: 0,
          }}
        >
          Find Friends
        </Box>
        <Box sx={{ height: 16 }} />
        <Box sx={{ px: '20px', flexShrink: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: 48,
              borderRadius: '25px',
              bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
              px: '20px',
            }}
          >
            <SearchIcon sx={{ fontSize: 24, color: '#9E9E9E', mr: '12px' }} />
            <Box
              component="input"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name..."
              aria-label="Search friends by name"
              sx={{
                flex: 1,
                border: 'none',
                outline: 'none',
                bgcolor: 'transparent',
                color: c.isDark ? '#FFFFFF' : '#000000DE',
                fontSize: 16,
                fontFamily: 'inherit',
                p: 0,
                '&::placeholder': { color: '#9E9E9E', opacity: 1 },
              }}
            />
          </Box>
        </Box>
        <Box sx={{ height: 16 }} />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: '20px' }}>
          {searching ? (
            <Box sx={{ display: 'grid', placeItems: 'center', pt: '40px' }}>
              <CircularProgress size={36} thickness={4} sx={{ color: '#026AFD' }} />
            </Box>
          ) : results.length === 0 ? (
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                pt: '40px',
                fontSize: 14,
                color: '#757575',
                textAlign: 'center',
              }}
            >
              {query.trim() ? 'No users found' : 'Type a name to search globally'}
            </Box>
          ) : (
            results.map((user) => {
              const avatar = pickAvatar(user.avatar, user.photos);
              const slug = user.name.toLowerCase().replace(/\s+/g, '');
              return (
                <Box
                  key={user.id}
                  onClick={() => navigate(`/view-profile/${user.id}`)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: '8px',
                    cursor: 'pointer',
                    '&:active': { opacity: 0.8 },
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      bgcolor: c.isDark ? AVATAR_PLACEHOLDER_DARK : AVATAR_PLACEHOLDER_LIGHT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {avatar ? (
                      <Box
                        component="img"
                        src={avatar}
                        alt={user.name}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Box
                        component="span"
                        sx={{ fontSize: 22, fontWeight: 700, color: '#026AFD' }}
                      >
                        {firstInitial(user.name)}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ ml: '16px', flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: 1.4,
                        color: c.isDark ? '#FFFFFF' : '#000000DE',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.name || 'Unknown'}
                    </Box>
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: 1.43,
                        color: '#757575',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      @{slug}
                    </Box>
                  </Box>
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void startChat(user);
                    }}
                    sx={{
                      height: 36,
                      px: '16px',
                      borderRadius: '20px',
                      bgcolor: '#026AFD',
                      color: '#FFFFFF',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 14,
                      fontWeight: 500,
                      flexShrink: 0,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Chat
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </FlutterSheet>
  );
};

/** `_CreateGroupModal` — group avatar, name, description, member search & selection */
const CreateGroupSheet = ({
  open,
  onClose,
  recentPartners,
  onGroupCreated,
}: {
  open: boolean;
  onClose: () => void;
  recentPartners: Array<{ id: string; name: string; avatar?: string | null; photos?: string[]; status?: string }>;
  onGroupCreated: (chatId: string) => void;
}) => {
  const c = usePalette();
  const navigate = useNavigate();
  const { showToast } = useSnackbar();

  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const { requestImage, sheet } = useImageSourceSheet();

  useEffect(() => {
    if (open) {
      setSearchResults(recentPartners);
      setGroupName('');
      setGroupDesc('');
      setSearchQuery('');
      setSelectedUsers([]);
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [open, recentPartners]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(recentPartners);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const users = await apiService.searchUsers(trimmed);
        setSearchResults(users);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchQuery, recentPartners]);

  const toggleSelectUser = (user: any) => {
    const id = user.id || user._id;
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => (u.id || u._id) === id);
      if (exists) {
        return prev.filter((u) => (u.id || u._id) !== id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreate = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      showToast('Please enter a group name');
      return;
    }
    if (selectedUsers.length === 0) {
      showToast('Please select at least one member');
      return;
    }

    setIsCreating(true);
    try {
      let avatarUrl: string | undefined = undefined;
      if (avatarFile) {
        const uploaded = await apiService.uploadImage(avatarFile);
        if (uploaded) avatarUrl = uploaded;
      }

      const userIds = selectedUsers
        .map((u) => u.id || u._id)
        .filter(Boolean);

      const newChat = await apiService.createGroupChat(userIds, trimmedName, {
        groupDescription: groupDesc.trim() || undefined,
        groupAvatar: avatarUrl,
      });

      if (newChat?.id) {
        onClose();
        onGroupCreated(newChat.id);
        navigate(`/chat/${newChat.id}`);
      } else {
        throw new Error('Failed to create group');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FlutterSheet
      open={open}
      onClose={onClose}
      handle={false}
      maxHeight="calc(var(--app-h, 100dvh) * 0.90)"
      background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      padding={0}
    >
      <Box sx={{ height: 'calc(var(--app-h, 100dvh) * 0.90)', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ height: 12, flexShrink: 0 }} />
        <Box
          sx={{
            width: 48,
            height: 5,
            borderRadius: '2.5px',
            bgcolor: c.isDark ? '#3A3A3C' : '#E0E0E0',
            mx: 'auto',
            flexShrink: 0,
          }}
        />
        <Box sx={{ height: 16, flexShrink: 0 }} />
        <Box
          sx={{
            fontSize: 20,
            fontWeight: 700,
            textAlign: 'center',
            color: c.text,
            flexShrink: 0,
          }}
        >
          New Group Chat
        </Box>
        <Box sx={{ height: 20, flexShrink: 0 }} />

        {/* Scrollable Form Header */}
        <Box sx={{ px: '20px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Avatar Picker */}
          <Box
            onClick={() =>
              requestImage({
                title: 'Group photo',
                onPick: ([file]) => {
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                },
              })
            }
            sx={{
              position: 'relative',
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              mb: '16px',
            }}
          >
            {avatarPreview ? (
              <Box component="img" src={avatarPreview} alt="Group Avatar" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <AddAPhotoRoundedIcon sx={{ fontSize: 30, color: '#9E9E9E' }} />
            )}
            {sheet}
          </Box>

          {/* Group Name Input */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              height: 48,
              borderRadius: '16px',
              bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
              px: '16px',
              mb: '12px',
            }}
          >
            <GroupRoundedIcon sx={{ fontSize: 22, color: '#9E9E9E', mr: '10px' }} />
            <Box
              component="input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group Name"
              sx={{
                flex: 1,
                border: 'none',
                outline: 'none',
                bgcolor: 'transparent',
                color: c.text,
                fontSize: 16,
                p: 0,
                '&::placeholder': { color: '#9E9E9E', opacity: 1 },
              }}
            />
          </Box>

          {/* Group Description Input */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              borderRadius: '16px',
              bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
              p: '12px 16px',
              mb: '16px',
            }}
          >
            <DescriptionOutlinedIcon sx={{ fontSize: 22, color: '#9E9E9E', mr: '10px', mt: '2px' }} />
            <Box
              component="textarea"
              rows={2}
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="Group Description (Optional)"
              sx={{
                flex: 1,
                border: 'none',
                outline: 'none',
                bgcolor: 'transparent',
                color: c.text,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'none',
                p: 0,
                '&::placeholder': { color: '#9E9E9E', opacity: 1 },
              }}
            />
          </Box>

          {/* Selected Members Horizontal Carousel */}
          {selectedUsers.length > 0 && (
            <Box sx={{ width: '100%', mb: '12px' }}>
              <Box
                sx={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  py: '4px',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                {selectedUsers.map((user) => {
                  const avatar = pickAvatar(user.avatar, user.photos);
                  const name = user.name || 'User';
                  return (
                    <Box
                      key={user.id || user._id}
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexShrink: 0,
                        width: 56,
                      }}
                    >
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {avatar ? (
                          <Box component="img" src={avatar} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Box component="span" sx={{ fontSize: 20, fontWeight: 700, color: '#026AFD' }}>
                            {firstInitial(name)}
                          </Box>
                        )}
                      </Box>
                      <Box
                        onClick={() => toggleSelectUser(user)}
                        sx={{
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          bgcolor: '#F44336',
                          color: '#FFFFFF',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <CloseRoundedIcon sx={{ fontSize: 12 }} />
                      </Box>
                      <Box
                        sx={{
                          fontSize: 12,
                          color: c.text,
                          mt: '4px',
                          textAlign: 'center',
                          maxWidth: 54,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name.length > 8 ? `${name.substring(0, 8)}...` : name}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ height: 1, bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE', mt: '8px' }} />
            </Box>
          )}

          {/* Member Search Input */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              height: 48,
              borderRadius: '16px',
              bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
              px: '16px',
              mb: '12px',
            }}
          >
            <SearchIcon sx={{ fontSize: 22, color: '#9E9E9E', mr: '10px' }} />
            <Box
              component="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members to add..."
              sx={{
                flex: 1,
                border: 'none',
                outline: 'none',
                bgcolor: 'transparent',
                color: c.text,
                fontSize: 16,
                p: 0,
                '&::placeholder': { color: '#9E9E9E', opacity: 1 },
              }}
            />
          </Box>
        </Box>

        {/* Member List */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: '20px' }}>
          {isSearching ? (
            <Box sx={{ display: 'grid', placeItems: 'center', pt: '30px' }}>
              <CircularProgress size={32} thickness={4} sx={{ color: '#026AFD' }} />
            </Box>
          ) : searchResults.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: c.isDark ? '#9E9E9E' : '#757575', pt: '30px', fontSize: 14 }}>
              {searchQuery.trim() ? 'No users found' : 'Type to search users'}
            </Box>
          ) : (
            searchResults.map((user) => {
              const id = user.id || user._id;
              const name = user.name || 'Unknown';
              const avatar = pickAvatar(user.avatar, user.photos);
              const isSelected = selectedUsers.some((u) => (u.id || u._id) === id);
              const slug = name.toLowerCase().replace(/\s+/g, '');

              return (
                <Box
                  key={id}
                  onClick={() => toggleSelectUser(user)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: '10px',
                    cursor: 'pointer',
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      bgcolor: c.isDark ? AVATAR_PLACEHOLDER_DARK : AVATAR_PLACEHOLDER_LIGHT,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      mr: '14px',
                    }}
                  >
                    {avatar ? (
                      <Box component="img" src={avatar} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Box component="span" sx={{ fontSize: 20, fontWeight: 700, color: '#026AFD' }}>
                        {firstInitial(name)}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontSize: 16, fontWeight: 600, color: c.text }}>{name}</Box>
                    <Box sx={{ fontSize: 14, color: c.isDark ? '#9E9E9E' : '#757575' }}>@{slug}</Box>
                  </Box>
                  <Box sx={{ flexShrink: 0, ml: '12px' }}>
                    {isSelected ? (
                      <CheckCircleRoundedIcon sx={{ fontSize: 24, color: '#026AFD' }} />
                    ) : (
                      <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 24, color: '#9E9E9E' }} />
                    )}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* Bottom Create Button */}
        <Box sx={{ p: '20px', flexShrink: 0 }}>
          <Box
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!isCreating) void handleCreate();
            }}
            sx={{
              width: '100%',
              height: 50,
              borderRadius: '25px',
              bgcolor: '#026AFD',
              color: '#FFFFFF',
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
              fontWeight: 700,
              cursor: isCreating ? 'default' : 'pointer',
              userSelect: 'none',
              opacity: isCreating ? 0.7 : 1,
            }}
          >
            {isCreating ? (
              <CircularProgress size={22} thickness={4} sx={{ color: '#FFFFFF' }} />
            ) : (
              `Create Group (${selectedUsers.length})`
            )}
          </Box>
        </Box>
      </Box>
    </FlutterSheet>
  );
};

/** `ChatsScreen` (mobile_app/lib/screens/chats_screen.dart). */
export const ChatsScreen = () => {
  const c = usePalette();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { showToast } = useSnackbar();
  const status = useStatusCycle(CHAT_STATUSES, true);

  const cachedChats = useMemo(() => readCache<Chat[]>('chats'), []);
  const [chats, setChats] = useState<Chat[]>(cachedChats ?? []);
  const [rooms, setRooms] = useState<Room[]>(() => readCache<Room[]>('rooms') ?? []);
  const [loading, setLoading] = useState(cachedChats === null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typingChats, setTypingChats] = useState<Record<string, boolean>>({});
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [findFriendsOpen, setFindFriendsOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const recentPartners = useMemo(() => {
    return chats
      .filter((chat) => !chat.isGroup && chat.partnerId)
      .map((chat) => ({
        id: chat.partnerId,
        name: chat.partnerName,
        avatar: chat.partnerAvatar,
        photos: chat.partnerPhotos,
        status: chat.partnerStatus,
      }));
  }, [chats]);

  const typingTimers = useRef<Record<string, number>>({});

  const loadChats = useCallback(async (showError = true) => {
    try {
      const list = await apiService.getChats();
      list.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setChats(list);
      if (showError) setError(null);
    } catch {
      if (showError) setError('Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const list = await apiService.getRooms();
      setRooms(list);
    } catch {
      /* Flutter leaves the carousel empty on failure. */
    }
  }, []);

  /* Written from the state, not the fetch, so websocket edits to the list are in
     the snapshot the next mount reads. */
  useEffect(() => {
    if (!loading) writeCache('chats', chats.slice(0, 120));
  }, [chats, loading]);

  useEffect(() => {
    writeCache('rooms', rooms.slice(0, 40));
  }, [rooms]);

  useEffect(() => {
    void loadChats();
    void loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 60 s periodic refresh + refresh on tab resume.
  useEffect(() => {
    const timer = window.setInterval(() => void loadChats(false), 60000);
    return () => window.clearInterval(timer);
  }, [loadChats]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadChats(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadChats]);

  // An open chat marks its thread read and asks this list to re-count, so the
  // badge disappears without waiting for the 60 s refresh.
  useEffect(() => {
    const onRefresh = () => void loadChats(false);
    window.addEventListener('chats:refresh', onRefresh);
    return () => window.removeEventListener('chats:refresh', onRefresh);
  }, [loadChats]);

  /* ------------------------------ websocket ------------------------------ */

  useEffect(() => {
    return wsService.subscribe(({ type, payload }) => {
      switch (type) {
        case 'new_message': {
          if (!payload) return;
          const chatId = payload.chatId;
          if (!chatId) return;
          setChats((current) => {
            const index = current.findIndex((chat) => chat.id === chatId);
            if (index === -1) {
              void loadChats(false);
              return current;
            }
            const next = [...current];
            const msgType = payload.type || (isImageContent(payload.content) ? 'image' : next[index].lastMessageType);
            const updated: Chat = {
              ...next[index],
              lastMessage: payload.content ?? next[index].lastMessage,
              lastMessageType: msgType,
              lastMessageTime: payload.createdAt
                ? Number(payload.createdAt) * 1000
                : Date.now(),
            };
            next.splice(index, 1);
            return [updated, ...next];
          });
          if (payload.senderId !== userId) {
            showToast(
              payload.senderName
                ? `📩 ${payload.senderName}: ${payload.content ?? 'New message'}`
                : '📩 New message'
            );
          }
          break;
        }
        case 'message_read':
        case 'chat_created':
          void loadChats(false);
          break;
        case 'typing_start': {
          const chatId = payload?.chatId;
          if (!chatId || payload?.userId === userId) return;
          setTypingChats((current) => ({ ...current, [chatId]: true }));
          window.clearTimeout(typingTimers.current[chatId]);
          typingTimers.current[chatId] = window.setTimeout(() => {
            setTypingChats((current) => ({ ...current, [chatId]: false }));
          }, 3000);
          break;
        }
        case 'typing_end': {
          const chatId = payload?.chatId;
          if (!chatId) return;
          window.clearTimeout(typingTimers.current[chatId]);
          setTypingChats((current) => ({ ...current, [chatId]: false }));
          break;
        }
        case 'user_status_update': {
          if (!payload?.userId) return;
          setChats((current) =>
            current.map((chat) =>
              chat.partnerId === payload.userId
                ? {
                    ...chat,
                    partnerStatus: payload.status ?? chat.partnerStatus,
                    isOnline:
                      payload.isOnline != null ? payload.isOnline === true : chat.isOnline,
                  }
                : chat
            )
          );
          break;
        }
        default:
          break;
      }
    });
  }, [loadChats, showToast, userId]);

  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  /* -------------------------------- list --------------------------------- */

  const filtered = (() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return chats;
    return chats.filter(
      (chat) =>
        chat.partnerName.toLowerCase().includes(needle) ||
        chat.lastMessage.toLowerCase().includes(needle)
    );
  })();

  const unreadTotal = chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
  usePublishChatsCount(unreadTotal);

  const openChat = (chat: Chat) => {
    const isRoom = rooms.some((room) => room.id === chat.id);
    navigate(isRoom ? `/room/${chat.id}` : `/chat/${chat.id}`);
  };

  /* ------------------------------- render -------------------------------- */

  const renderShimmer = () => (
    <Box sx={{ px: '24px', overflow: 'hidden' }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Box
          key={index}
          sx={{ py: '12px', display: 'flex', alignItems: 'center' }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: c.isDark ? AVATAR_PLACEHOLDER_DARK : AVATAR_PLACEHOLDER_LIGHT,
              flexShrink: 0,
            }}
          />
          <Box sx={{ width: 16 }} />
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{
                width: 120,
                height: 16,
                borderRadius: '8px',
                bgcolor: c.isDark ? AVATAR_PLACEHOLDER_DARK : AVATAR_PLACEHOLDER_LIGHT,
              }}
            />
            <Box sx={{ height: 8 }} />
            <Box
              sx={{
                width: 200,
                height: 14,
                borderRadius: '8px',
                bgcolor: c.isDark ? AVATAR_PLACEHOLDER_DARK : AVATAR_PLACEHOLDER_LIGHT,
              }}
            />
          </Box>
        </Box>
      ))}
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
        p: '24px',
        textAlign: 'center',
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 60, color: '#9E9E9E' }} />
      <Box sx={{ height: 16 }} />
      <Box sx={{ fontSize: 14, lineHeight: 1.43, color: '#9E9E9E' }}>
        {error ?? 'Unknown error'}
      </Box>
      <Box
        role="button"
        tabIndex={0}
        onClick={() => {
          setError(null);
          setLoading(true);
          void loadChats();
        }}
        sx={{
          mt: '8px',
          px: '12px',
          height: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '20px',
          color: '#026AFD',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        Retry
      </Box>
    </Box>
  );

  const renderEmpty = () => {
    const hasSearch = query.trim().length > 0;
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: '24px',
          textAlign: 'center',
        }}
      >
        <Box component="span" sx={{ fontSize: 60, lineHeight: 1 }}>
          💬
        </Box>
        <Box sx={{ height: 16 }} />
        <Box sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, color: c.text }}>
          {hasSearch ? 'No results found' : 'No chats yet'}
        </Box>
        {hasSearch && (
          <Box
            role="button"
            tabIndex={0}
            onClick={() => setQuery('')}
            sx={{
              mt: '8px',
              px: '12px',
              height: 40,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '20px',
              color: '#026AFD',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            Clear search
          </Box>
        )}
      </Box>
    );
  };

  const renderRow = (chat: Chat) => {
    const avatar = pickAvatar(chat.partnerAvatar, chat.partnerPhotos);
    const isTyping = typingChats[chat.id] === true;
    const unread = chat.unreadCount > 0;
    return (
      <Box
        key={chat.id}
        role="button"
        tabIndex={0}
        onClick={() => openChat(chat)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') openChat(chat);
        }}
        sx={{
          py: '12px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Box
          role="button"
          aria-label={`View ${chat.partnerName} profile`}
          onClick={(event) => {
            if (!chat.isGroup && chat.partnerId) {
              event.stopPropagation();
              navigate(`/view-profile/${chat.partnerId}`, {
                state: {
                  user: {
                    id: chat.partnerId,
                    name: chat.partnerName,
                    avatar: chat.partnerAvatar,
                    photos: chat.partnerPhotos,
                    status: chat.partnerStatus,
                  },
                },
              });
            }
          }}
          sx={{ position: 'relative', flexShrink: 0 }}
        >
          <PulseAvatar image={avatar} name={chat.partnerName} />
        </Box>

        <Box sx={{ width: 16 }} />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.25,
              color: c.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {chat.partnerName}
          </Box>
          <Box sx={{ height: 4 }} />
          {isTyping ? (
            <TypingIndicator />
          ) : (
            <Box
              sx={{
                fontSize: 14,
                lineHeight: 1.43,
                color: c.isDark ? '#BDBDBD' : '#757575',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {messagePreview(chat)}
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            flexShrink: 0,
            ml: '8px',
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 12,
              lineHeight: 1.33,
              color: c.isDark ? '#BDBDBD' : '#9E9E9E',
              whiteSpace: 'nowrap',
            }}
          >
            {formatChatTimestamp(chat.lastMessageTime)}
          </Box>
          {unread && (
            <Box
              sx={{
                mt: '8px',
                px: '8px',
                py: '2px',
                bgcolor: '#F44336',
                borderRadius: '10px',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.6,
                color: '#FFFFFF',
              }}
            >
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  const renderBody = () => {
    if (loading) return renderShimmer();
    if (error) return renderError();
    if (!filtered.length) return renderEmpty();
    return <Box sx={{ px: '24px', pb: NAV_CLEARANCE }}>{filtered.map(renderRow)}</Box>;
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
        position: 'relative',
      }}
    >
      <FlutterAppBar
        leading={<AppLogo size={40} />}
        actions={
          <StatusPill
            label={status.label}
            dot={status.dot}
            opacity={status.opacity}
            onClick={() => void status.cycle()}
          />
        }
      />

      {/* Search bar — white in light mode, lifted in dark, exactly like Flutter */}
      <Box
        sx={{
          p: '16px',
          flexShrink: 0,
          bgcolor: c.isDark ? c.surface : c.scaffold,
          borderBottom: `1px solid ${c.border}`,
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
            pl: '12px',
            pr: '20px',
          }}
        >
          <SearchIcon sx={{ fontSize: 24, color: '#9E9E9E', mr: '8px' }} />
          <Box
            component="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats by name or message..."
            sx={{
              flex: 1,
              border: 'none',
              outline: 'none',
              bgcolor: 'transparent',
              color: c.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.87)',
              fontSize: 16,
              fontFamily: 'inherit',
              p: 0,
              '&::placeholder': {
                color: c.isDark ? '#8E8E8E' : '#9E9E9E',
                opacity: 1,
              },
            }}
          />
        </Box>
      </Box>

      {/* One scroll surface, so the rooms rail rides away with the list instead
          of pinning the chats to the bottom half of a short iPhone screen. */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overscrollBehaviorY: 'contain',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <RoomCarousel rooms={rooms} onRefresh={() => void loadChats(false)} />
        {renderBody()}
      </Box>

      {/* FAB — endFloat above the bottom nav */}
      <Box
        role="button"
        aria-label="New chat or group"
        tabIndex={0}
        onClick={() => setActionMenuOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setActionMenuOpen(true);
        }}
        sx={{
          position: 'absolute',
          bottom: 'calc(76px + env(safe-area-inset-bottom))',
          right: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: '#026AFD',
          boxShadow: '0 4px 12px rgba(2,106,253,0.35)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        <PersonAddAlt1RoundedIcon sx={{ fontSize: 24, color: '#FFFFFF' }} />
      </Box>

      <ChatActionMenuSheet
        open={actionMenuOpen}
        onClose={() => setActionMenuOpen(false)}
        onOpenFindFriends={() => setFindFriendsOpen(true)}
        onOpenCreateGroup={() => setCreateGroupOpen(true)}
      />
      <FindFriendsSheet open={findFriendsOpen} onClose={() => setFindFriendsOpen(false)} />
      <CreateGroupSheet
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        recentPartners={recentPartners}
        onGroupCreated={() => void loadChats(false)}
      />
    </Box>
  );
};
