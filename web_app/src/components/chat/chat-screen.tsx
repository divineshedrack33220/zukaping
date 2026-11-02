import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Dialog } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import BlockIcon from '@mui/icons-material/Block';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import GroupIcon from '@mui/icons-material/Group';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useNavigate, useParams } from 'react-router-dom';
import { usePalette } from '../../contexts/app-theme.context';
import { useAuth } from '../../contexts/auth.context';
import { useMe } from '../../contexts/me.context';
import { useSnackbar } from '../../contexts/snackbar.context';
import { apiService } from '../../services/api.service';
import { wsService } from '../../services/ws.service';
import { Chat, ChatParticipantProfile, Message, NearbyUser } from '../../models/chat.models';
import { firstInitial, formatTime, pickAvatar } from '../../utils/format';
import { isOnlyEmoji, keywordEffect } from '../../utils/messages';
import { MessageBubble } from './message-bubble';
import { FlutterSheet } from '../common/flutter-sheet';
import { ConfirmDialog } from '../common/confirm-dialog';
import { FullScreenViewer } from '../common/fullscreen-viewer';
import { useImageSourceSheet } from '../common/image-source-sheet';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const PARTNER_FALLBACK = 'User';

const PulseAvatar = ({
  image,
  name,
  size = 40,
  online,
}: {
  image: string | null;
  name: string;
  size?: number;
  online?: boolean;
}) => {
  const c = usePalette();
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE',
        overflow: 'hidden',
        flexShrink: 0,
        animation: online ? 'chat-head-pulse 2s ease-in-out infinite' : undefined,
        '@keyframes chat-head-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(2,106,253,0.8)' },
          '50%': { boxShadow: '0 0 0 5px rgba(2,106,253,0)' },
        },
      }}
    >
      {image ? (
        <Box
          component="img"
          src={image}
          alt={name}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(2,106,253,0.1)',
            display: 'grid',
            placeItems: 'center',
            fontSize: size * 0.35,
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

const IcebreakerHub = ({ onPick }: { onPick: (text: string) => void }) => {
  const c = usePalette();
  const cards = [
    { emoji: '👋', label: 'Hey! How are you?' },
    { emoji: '✨', label: 'Love your profile!' },
    { emoji: '🍕', label: 'Best food in town?' },
  ];
  return (
    <Box
      sx={{
        height: 90,
        my: '10px',
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        px: '16px',
        flexShrink: 0,
      }}
    >
      {cards.map((card) => (
        <Box
          key={card.label}
          role="button"
          onClick={() => onPick(card.label)}
          sx={{
            width: 150,
            flexShrink: 0,
            p: '12px',
            bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
            borderRadius: '20px',
            border: `1px solid ${c.isDark ? '#424242' : '#EEEEEE'}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <Box component="span" sx={{ fontSize: 18, lineHeight: 1.4 }}>
            {card.emoji}
          </Box>
          <Box
            sx={{
              fontSize: 12,
              lineHeight: 1.33,
              color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.87)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {card.label}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

const EFFECT_KEYFRAMES = {
  '@keyframes zp-confetti': {
    '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: 1 },
    '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: 0 },
  },
  '@keyframes zp-hearts': {
    '0%': { transform: 'translateY(5vh) scale(1)', opacity: 1 },
    '100%': { transform: 'translateY(-110vh) scale(1.4)', opacity: 0 },
  },
};

const EffectsOverlay = ({ effect }: { effect: 'confetti' | 'hearts' | null }) => {
  if (!effect) return null;
  const count = effect === 'confetti' ? 50 : 20;
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1400,
        ...EFFECT_KEYFRAMES,
      }}
    >
      {Array.from({ length: count }).map((_, index) => {
        const left = (index * 37) % 100;
        const delay = (index % 10) * 0.08;
        const duration = 2.4 + ((index * 13) % 10) / 10;
        if (effect === 'hearts') {
          return (
            <Box
              key={index}
              sx={{
                position: 'absolute',
                bottom: 0,
                left: `${left}%`,
                fontSize: 24,
                animation: `zp-hearts ${duration}s linear ${delay}s forwards`,
              }}
            >
              ❤️
            </Box>
          );
        }
        return (
          <Box
            key={index}
            sx={{
              position: 'absolute',
              top: 0,
              left: `${left}%`,
              width: 8,
              height: 8,
              bgcolor: ['#F44336', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0'][
                index % 6
              ],
              animation: `zp-confetti ${duration}s linear ${delay}s forwards`,
            }}
          />
        );
      })}
    </Box>
  );
};

const TypingDots = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
    {[0, 1, 2].map((index) => (
      <Box
        key={index}
        sx={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          bgcolor: '#026AFD',
          animation: 'chat-dot-bounce 1200ms ease-in-out infinite',
          animationDelay: `${index * 160}ms`,
          '@keyframes chat-dot-bounce': {
            '0%, 100%': { opacity: 0.3 },
            '50%': { opacity: 1 },
          },
        }}
      />
    ))}
  </Box>
);

/* ------------------------------------------------------------------ */
/* sub-sheets                                                          */
/* ------------------------------------------------------------------ */

const ReactionSheet = ({
  message,
  onClose,
  onReact,
  onReply,
}: {
  message: Message | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
}) => {
  const c = usePalette();
  const emojis = ['❤️', '😂', '🔥', '👍', '🙏'];
  return (
    <FlutterSheet
      open={message != null}
      onClose={onClose}
      radius={30}
      handle={false}
      background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      maxHeight="60dvh"
    >
      <Box sx={{ p: '20px 24px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-around', py: '8px' }}>
          {emojis.map((emoji) => (
            <Box
              key={emoji}
              role="button"
              tabIndex={0}
              onClick={() => onReact(emoji)}
              sx={{ fontSize: 32, lineHeight: 1, cursor: 'pointer', userSelect: 'none' }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
        <Box sx={{ height: 24 }} />
        <Box sx={{ height: 1, bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE' }} />
        <Box sx={{ height: 8 }} />
        <Box
          role="button"
          tabIndex={0}
          onClick={onReply}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            py: '12px',
            cursor: 'pointer',
          }}
        >
          <ReplyRoundedIcon sx={{ fontSize: 24, color: '#026AFD' }} />
          <Box sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>Reply to message</Box>
        </Box>
        <Box sx={{ height: 8 }} />
      </Box>
    </FlutterSheet>
  );
};

const GroupInfoSheet = ({
  open,
  chat,
  currentUserId,
  onClose,
  onRefresh,
}: {
  open: boolean;
  chat: Chat;
  currentUserId: string;
  onClose: () => void;
  onRefresh: () => void;
}) => {
  const c = usePalette();
  const { showToast } = useSnackbar();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const members: ChatParticipantProfile[] = chat.participantsProfiles.length
    ? chat.participantsProfiles
    : chat.participants.map((id) => ({
        id,
        name: id === currentUserId ? 'You' : 'Member',
        avatar: null,
        photos: [],
        status: 'offline',
      }));

  const isAdmin = chat.adminIds.includes(currentUserId);

  const promote = async (member: ChatParticipantProfile) => {
    try {
      await apiService.promoteToAdmin(chat.id, member.id);
      showToast(`${member.name} is now an Admin`);
      onRefresh();
    } catch {
      showToast('Failed to promote member');
    }
  };

  const remove = async (member: ChatParticipantProfile) => {
    try {
      await apiService.removeGroupMember(chat.id, member.id);
      showToast(`${member.name} removed`);
      onRefresh();
    } catch {
      showToast('Failed to remove member');
    }
  };

  const openInvite = async () => {
    setInviteOpen(true);
    try {
      const code = await apiService.generateGroupInviteCode(chat.id);
      setInviteCode(code);
    } catch {
      setInviteCode('');
      showToast('Failed to generate invite code');
    }
  };

  const inviteUrl = inviteCode
    ? `https://zukaping.app/join-group?code=${inviteCode}`
    : '';

  return (
    <>
      <FlutterSheet
        open={open}
        onClose={onClose}
        handle={false}
        maxHeight="85dvh"
        background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
        padding={0}
      >
        <Box sx={{ height: '85dvh', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ height: 12, flexShrink: 0 }} />
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
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <PulseAvatar
              image={pickAvatar(chat.groupAvatar ?? chat.partnerAvatar)}
              name={chat.partnerName}
              size={90}
            />
          </Box>
          <Box sx={{ height: 12 }} />
          <Box
            sx={{
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.2,
              textAlign: 'center',
              color: c.text,
            }}
          >
            {chat.partnerName}
          </Box>
          <Box sx={{ height: 8 }} />
          <Box
            sx={{
              px: '32px',
              fontSize: 14,
              lineHeight: 1.43,
              textAlign: 'center',
              color: c.isDark ? '#BDBDBD' : '#757575',
            }}
          >
            {chat.groupDescription?.trim() ? chat.groupDescription : 'No description provided.'}
          </Box>
          <Box sx={{ height: 16 }} />

          {isAdmin ? (
            <Box sx={{ px: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              <Box
                role="button"
                onClick={() => setEditOpen(true)}
                sx={{
                  height: 36,
                  px: '12px',
                  borderRadius: '20px',
                  bgcolor: '#026AFD',
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <EditIcon sx={{ fontSize: 14 }} /> Edit Details
              </Box>
              <Box
                role="button"
                onClick={() => void openInvite()}
                sx={{
                  height: 36,
                  px: '12px',
                  borderRadius: '20px',
                  border: '1px solid #026AFD',
                  color: '#026AFD',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <LinkRoundedIcon sx={{ fontSize: 14 }} /> Invite Link
              </Box>
              <Box
                role="button"
                onClick={() => setAddOpen(true)}
                sx={{
                  height: 36,
                  px: '12px',
                  borderRadius: '20px',
                  border: '1px solid #026AFD',
                  color: '#026AFD',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PersonAddAlt1RoundedIcon sx={{ fontSize: 14 }} /> Add Member
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                px: '16px',
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 16, color: '#9E9E9E' }} />
              <Box sx={{ fontSize: 14, color: '#9E9E9E' }}>
                Only admins can edit group details.
              </Box>
            </Box>
          )}

          <Box
            sx={{ height: 1, bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE', my: '16px', flexShrink: 0 }}
          />
          <Box
            sx={{
              px: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <Box sx={{ fontSize: 16, fontWeight: 700, color: c.text }}>
              Members ({members.length})
            </Box>
            <PeopleOutlineIcon sx={{ fontSize: 24, color: '#9E9E9E' }} />
          </Box>
          <Box sx={{ height: 12 }} />
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: '20px' }}>
            {members.map((member) => {
              const self = member.id === currentUserId;
              const memberAdmin = chat.adminIds.includes(member.id);
              return (
                <Box
                  key={member.id}
                  sx={{ display: 'flex', alignItems: 'center', py: '8px' }}
                >
                  <PulseAvatar
                    image={pickAvatar(member.avatar, member.photos)}
                    name={member.name}
                    size={40}
                  />
                  <Box sx={{ ml: '16px', flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: self ? '#026AFD' : c.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {member.name}
                      </Box>
                      {self && (
                        <>
                          <Box sx={{ width: 6 }} />
                          <Box sx={{ fontSize: 12, color: '#9E9E9E' }}>(You)</Box>
                        </>
                      )}
                    </Box>
                    <Box
                      sx={{
                        fontSize: 12,
                        color: memberAdmin ? '#026AFD' : '#9E9E9E',
                      }}
                    >
                      {memberAdmin ? 'Admin' : 'Member'}
                    </Box>
                  </Box>
                  {memberAdmin ? (
                    <Box
                      sx={{
                        px: '8px',
                        py: '2px',
                        borderRadius: '10px',
                        bgcolor: 'rgba(2,106,253,0.1)',
                        border: '1px solid rgba(2,106,253,0.3)',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#026AFD',
                      }}
                    >
                      Admin
                    </Box>
                  ) : isAdmin && !self ? (
                    <Select
                      value=""
                      displayEmpty
                      onChange={(event) => {
                        if (event.target.value === 'promote') void promote(member);
                        if (event.target.value === 'remove') void remove(member);
                      }}
                      renderValue={() => <MoreHorizIcon sx={{ color: '#9E9E9E' }} />}
                      sx={{
                        '& .MuiSelect-select': { p: 0, pr: '0 !important', display: 'grid' },
                        '& fieldset': { border: 'none' },
                        width: 32,
                        minWidth: 32,
                      }}
                    >
                      <MenuItem value="promote">
                        <ShieldOutlinedIcon sx={{ fontSize: 20, mr: 1 }} /> Make Admin
                      </MenuItem>
                      <MenuItem value="remove">
                        <PersonRemoveOutlinedIcon sx={{ fontSize: 20, mr: 1, color: '#F44336' }} />
                        Remove Member
                      </MenuItem>
                    </Select>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        </Box>
      </FlutterSheet>

      <EditGroupSheet
        open={editOpen}
        chat={chat}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          onRefresh();
        }}
      />

      <AddMembersSheet
        open={addOpen}
        chat={chat}
        onClose={() => setAddOpen(false)}
        onAdded={onRefresh}
      />

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 380,
            borderRadius: '24px',
            bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
            p: '24px',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LinkRoundedIcon sx={{ fontSize: 28, color: '#026AFD' }} />
          <Box sx={{ fontSize: 18, fontWeight: 700, color: c.text }}>Group Invite Link</Box>
        </Box>
        <Box sx={{ height: 16 }} />
        <Box sx={{ fontSize: 13, lineHeight: 1.4, color: c.isDark ? '#BDBDBD' : '#757575' }}>
          Anyone with this link can join this group chat, even if they are not currently a user.
        </Box>
        <Box sx={{ height: 16 }} />
        <Box
          sx={{
            p: '10px 12px',
            bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
            borderRadius: '12px',
            border: `1px solid ${c.isDark ? '#424242' : '#E0E0E0'}`,
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 1.4,
            wordBreak: 'break-all',
            color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.87)',
            userSelect: 'all',
          }}
        >
          {inviteUrl || 'Generating…'}
        </Box>
        <Box sx={{ mt: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Box
            role="button"
            onClick={() => setInviteOpen(false)}
            sx={{
              px: '12px',
              py: '10px',
              borderRadius: '8px',
              fontSize: 14,
              color: '#9E9E9E',
              cursor: 'pointer',
            }}
          >
            Cancel
          </Box>
          <Box
            role="button"
            onClick={async () => {
              if (!inviteUrl) return;
              try {
                await navigator.clipboard.writeText(inviteUrl);
                setInviteOpen(false);
                showToast('Invite link copied to clipboard!');
              } catch {
                showToast('Invite link copied to clipboard!');
              }
            }}
            sx={{
              height: 40,
              px: '16px',
              borderRadius: '16px',
              bgcolor: '#026AFD',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LinkRoundedIcon sx={{ fontSize: 16 }} /> Copy Link
          </Box>
        </Box>
      </Dialog>
    </>
  );
};

const EditGroupSheet = ({
  open,
  chat,
  onClose,
  onSaved,
}: {
  open: boolean;
  chat: Chat;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const c = usePalette();
  const { showToast } = useSnackbar();
  const [name, setName] = useState(chat.groupName ?? chat.partnerName);
  const [description, setDescription] = useState(chat.groupDescription ?? '');
  const [avatar, setAvatar] = useState<string | null>(chat.groupAvatar ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const { requestImage, sheet } = useImageSourceSheet();

  useEffect(() => {
    if (open) {
      setName(chat.groupName ?? chat.partnerName);
      setDescription(chat.groupDescription ?? '');
      setAvatar(chat.groupAvatar ?? null);
      setFile(null);
    }
  }, [open, chat]);

  const save = async () => {
    if (!name.trim()) {
      showToast('Group name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      let avatarUrl: string | undefined;
      if (file) avatarUrl = (await apiService.uploadImage(file)) ?? undefined;
      await apiService.updateGroup(chat.id, {
        groupName: name.trim(),
        groupDescription: description.trim(),
        groupAvatar: avatarUrl ?? chat.groupAvatar,
      });
      showToast('Group updated!');
      onSaved();
    } catch {
      showToast('Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FlutterSheet
      open={open}
      onClose={onClose}
      handle={false}
      maxHeight="80dvh"
      background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      padding={0}
    >
      <Box sx={{ height: '80dvh', px: '20px', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ height: 12 }} />
        <Box
          sx={{
            width: 48,
            height: 5,
            borderRadius: '2.5px',
            bgcolor: c.isDark ? '#424242' : '#E0E0E0',
            mx: 'auto',
          }}
        />
        <Box sx={{ height: 16 }} />
        <Box sx={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: c.text }}>
          Edit Group Info
        </Box>
        <Box sx={{ height: 20 }} />
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            role="button"
            onClick={() =>
              requestImage({
                title: 'Group photo',
                onPick: ([picked]) => {
                  setFile(picked);
                  setAvatar(URL.createObjectURL(picked));
                },
              })
            }
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: c.isDark ? '#424242' : '#EEEEEE',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            {avatar ? (
              <Box
                component="img"
                src={avatar}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <AddAPhotoIcon sx={{ fontSize: 28, color: '#9E9E9E' }} />
            )}
          </Box>
          {sheet}
        </Box>
        <Box sx={{ height: 24 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 52,
            borderRadius: '16px',
            bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
            px: '16px',
          }}
        >
          <GroupIcon sx={{ fontSize: 20, color: '#9E9E9E', mr: '12px' }} />
          <Box
            component="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Group Name"
            sx={{
              flex: 1,
              border: 'none',
              outline: 'none',
              bgcolor: 'transparent',
              color: c.text,
              fontSize: 16,
              fontFamily: 'inherit',
            }}
          />
        </Box>
        <Box sx={{ height: 16 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            minHeight: 88,
            borderRadius: '16px',
            bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
            p: '14px 16px',
          }}
        >
          <DescriptionIcon sx={{ fontSize: 20, color: '#9E9E9E', mr: '12px', mt: '2px' }} />
          <Box
            component="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            rows={3}
            sx={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              bgcolor: 'transparent',
              color: c.text,
              fontSize: 16,
              fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          />
        </Box>
        <Box sx={{ height: 24 }} />
        <Box
          role="button"
          onClick={() => void save()}
          sx={{
            height: 50,
            borderRadius: '25px',
            bgcolor: '#026AFD',
            color: '#FFFFFF',
            display: 'grid',
            placeItems: 'center',
            fontSize: 16,
            fontWeight: 700,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.8 : 1,
          }}
        >
          {saving ? (
            <CircularProgress size={20} thickness={2} sx={{ color: '#FFFFFF' }} />
          ) : (
            'Save Changes'
          )}
        </Box>
      </Box>
    </FlutterSheet>
  );
};

const AddMembersSheet = ({
  open,
  chat,
  onClose,
  onAdded,
}: {
  open: boolean;
  chat: Chat;
  onClose: () => void;
  onAdded: () => void;
}) => {
  const c = usePalette();
  const { showToast } = useSnackbar();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NearbyUser[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    let cancelled = false;
    void apiService
      .searchUsers(trimmed)
      .then((users) => {
        if (!cancelled) setResults(users);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const memberIds = new Set(chat.participants);

  return (
    <FlutterSheet
      open={open}
      onClose={onClose}
      handle={false}
      maxHeight="75dvh"
      background={c.isDark ? '#1C1C1E' : '#FFFFFF'}
      padding={0}
    >
      <Box sx={{ height: '75dvh', display: 'flex', flexDirection: 'column', px: '20px' }}>
        <Box sx={{ height: 12 }} />
        <Box
          sx={{
            width: 48,
            height: 5,
            borderRadius: '2.5px',
            bgcolor: c.isDark ? '#424242' : '#E0E0E0',
            mx: 'auto',
          }}
        />
        <Box sx={{ height: 16 }} />
        <Box sx={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: c.text }}>
          Add Members to Group
        </Box>
        <Box sx={{ height: 16 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 50,
            borderRadius: '16px',
            bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
            px: '16px',
            flexShrink: 0,
          }}
        >
          <SearchIcon sx={{ fontSize: 20, color: '#9E9E9E', mr: '12px' }} />
          <Box
            component="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users by name..."
            sx={{
              flex: 1,
              border: 'none',
              outline: 'none',
              bgcolor: 'transparent',
              color: c.text,
              fontSize: 16,
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <CloseRoundedIcon
              role="button"
              onClick={() => setQuery('')}
              sx={{ fontSize: 20, color: '#9E9E9E', cursor: 'pointer' }}
            />
          )}
        </Box>
        <Box sx={{ height: 12 }} />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <Box sx={{ textAlign: 'center', pt: '32px', fontSize: 14, color: '#9E9E9E' }}>
              {query.trim() ? 'No users found' : 'Type to search registered users'}
            </Box>
          ) : (
            results.map((user) => {
              const isMember = memberIds.has(user.id);
              return (
                <Box
                  key={user.id}
                  sx={{ display: 'flex', alignItems: 'center', py: '8px' }}
                >
                  <PulseAvatar
                    image={pickAvatar(user.avatar, user.photos)}
                    name={user.name}
                    size={40}
                  />
                  <Box
                    sx={{
                      ml: '16px',
                      flex: 1,
                      fontSize: 16,
                      fontWeight: 600,
                      color: c.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.name}
                  </Box>
                  {isMember ? (
                    <Box sx={{ fontSize: 13, fontWeight: 700, color: '#9E9E9E' }}>Member</Box>
                  ) : (
                    <Box
                      role="button"
                      onClick={async () => {
                        try {
                          await apiService.addGroupMember(chat.id, user.id);
                          showToast(`${user.name} added to group!`);
                          onAdded();
                        } catch {
                          showToast(`Failed to add ${user.name}`);
                        }
                      }}
                      sx={{
                        height: 32,
                        px: '16px',
                        borderRadius: '12px',
                        bgcolor: '#026AFD',
                        color: '#FFFFFF',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Add
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </FlutterSheet>
  );
};

/* ------------------------------------------------------------------ */
/* main screen                                                         */
/* ------------------------------------------------------------------ */

interface StagedImage {
  id: string;
  file: File;
  preview: string;
}

export const ChatScreen = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const c = usePalette();
  const { userId } = useAuth();
  const { me } = useMe();
  const { showToast } = useSnackbar();

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<Message | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [carousel, setCarousel] = useState<{ images: string[]; index: number } | null>(null);
  const [effect, setEffect] = useState<'confetti' | 'hearts' | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const effectTimer = useRef<number | null>(null);
  const meRef = useRef<string>(userId ?? '');

  useEffect(() => {
    meRef.current = userId ?? '';
  }, [userId]);

  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const loadChat = useCallback(async () => {
    if (!chatId) return;
    try {
      const [data, history] = await Promise.all([
        apiService.getChat(chatId),
        apiService.getMessages(chatId),
      ]);
      setChat(data);
      setMessages(history);
      wsService.send('subscribe_chat', { chatId });
      setLoading(false);

      // Opening the chat is what marks it read, per the chat list behaviour:
      // one call clears every unread message in it, so pass the newest incoming id.
      const newestIncoming = [...history]
        .reverse()
        .find((message) => message.senderId !== userId && !message.isRead);
      if (newestIncoming) {
        void apiService.markAsRead(newestIncoming.id).then((cleared) => {
          if (cleared > 0) window.dispatchEvent(new Event('chats:refresh'));
        });
      }
    } catch {
      setLoading(false);
      showToast('Failed to load chat');
    }
  }, [chatId, showToast, userId]);

  useEffect(() => {
    void loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, typing, scrollToBottom]);

  /* ------------------------------ websocket ------------------------------ */

  useEffect(() => {
    if (!chatId) return;
    return wsService.subscribe(({ type, payload }) => {
      if (!payload) return;
      if (payload.chatId && payload.chatId !== chatId) return;
      switch (type) {
        case 'new_message': {
          const incoming: Message = {
            id: payload.id ?? payload._id ?? `ws_${Date.now()}`,
            chatId,
            senderId: payload.senderId ?? payload.sender?._id ?? '',
            content: payload.content ?? '',
            type: payload.type ?? 'text',
            createdAt: payload.createdAt?.toString().length === 10
              ? Number(payload.createdAt) * 1000
              : payload.createdAt ?? Date.now(),
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
              (message) =>
                message.id.startsWith('opt_') &&
                message.content === incoming.content &&
                message.senderId === incoming.senderId
            );
            if (optimisticIndex >= 0) {
              const next = [...current];
              next[optimisticIndex] = incoming;
              return next;
            }
            return [...current, incoming];
          });
          if (incoming.senderId !== meRef.current) {
            wsService.send('message_read', { chatId, messageIds: [incoming.id] });
          }
          const trigger = keywordEffect(incoming.content);
          if (trigger) {
            setEffect(trigger);
            if (effectTimer.current) window.clearTimeout(effectTimer.current);
            effectTimer.current = window.setTimeout(() => setEffect(null), 3200);
          }
          break;
        }
        case 'message_read': {
          const ids: string[] = Array.isArray(payload.messageIds) ? payload.messageIds : [];
          if (!ids.length) return;
          setMessages((current) =>
            current.map((message) => (ids.includes(message.id) ? { ...message, isRead: true } : message))
          );
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
            current.map((message) =>
              message.id === payload.messageId
                ? { ...message, reactions: payload.reactions ?? {} }
                : message
            )
          );
          break;
        }
        case 'user_status_update':
          setChat((current) =>
            current && current.partnerId === payload.userId
              ? {
                  ...current,
                  isOnline: payload.isOnline === true,
                  partnerStatus: payload.status ?? current.partnerStatus,
                }
              : current
          );
          break;
        default:
          break;
      }
    });
  }, [chatId]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (effectTimer.current) window.clearTimeout(effectTimer.current);
    };
  }, []);

  /* ------------------------------ derived ------------------------------ */

  const partnerName = useMemo(() => {
    if (!chat) return '...';
    return chat.isGroup ? chat.groupName || partnerNameOrFallback(chat.partnerName) : chat.partnerName;
  }, [chat]);

  const avatar = pickAvatar(chat?.partnerAvatar, chat?.partnerPhotos);

  const subtitle = typing
    ? 'typing...'
    : chat?.isGroup
    ? `${chat.participants.length || chat.participantsProfiles.length} members`
    : chat?.isOnline
    ? 'online'
    : chat?.partnerStatus ?? 'offline';

  const allImageUrls = useMemo(
    () =>
      messages
        .slice()
        .reverse()
        .flatMap((message) =>
          message.type === 'image'
            ? parseMessageImages(message.content)
            : []
        ),
    [messages]
  );

  /* ------------------------------ sending ------------------------------ */

  const triggerEffectFor = (content: string) => {
    const trigger = keywordEffect(content);
    if (!trigger) return;
    setEffect(trigger);
    if (effectTimer.current) window.clearTimeout(effectTimer.current);
    effectTimer.current = window.setTimeout(() => setEffect(null), 3200);
  };

  const sendTextMessage = async (customText?: string) => {
    if (!chatId) return;
    const value = (customText ?? text).trim();
    if (!value) return;
    if (!customText) setText('');
    triggerEffectFor(value);
    const optimistic: Message = {
      id: `opt_text_${Date.now()}`,
      chatId,
      senderId: userId ?? '',
      content: value,
      type: isOnlyEmoji(value) ? 'emoji' : 'text',
      createdAt: Date.now(),
      isRead: false,
      reactions: {},
      replyToId: replyTo?.id,
      replyToContent: replyTo?.content,
      replyToSenderName: replyTo ? replyToSenderName(replyTo) : undefined,
      senderName: me?.name,
      senderAvatar: me?.avatar,
    };
    const reply = replyTo;
    setReplyTo(null);
    setEmojiOpen(false);
    setMessages((current) => [...current, optimistic]);
    scrollToBottom();
    try {
      const saved = await apiService.sendMessage({
        chatId,
        content: value,
        type: 'text',
        replyToId: reply?.id,
        replyToContent: reply?.content,
        replyToSenderName: reply ? replyToSenderName(reply) : undefined,
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === optimistic.id ? { ...saved, senderId: saved.senderId || userId || '' } : message
        )
      );
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      showToast('Failed to send');
    }
  };

  const sendStagedImages = async (caption: string) => {
    if (!chatId || staged.length === 0) return;
    const batch = staged;
    const reply = replyTo;
    setStaged([]);
    setReplyTo(null);
    const localUrls = batch.map((item) => item.preview);
    const optimistic: Message = {
      id: `opt_${Date.now()}`,
      chatId,
      senderId: userId ?? '',
      content: JSON.stringify(localUrls),
      type: 'image',
      createdAt: Date.now(),
      isRead: false,
      reactions: {},
      senderName: me?.name,
      senderAvatar: me?.avatar,
    };
    setMessages((current) => [...current, optimistic]);
    setUploadProgress({ done: 0, total: batch.length });
    const urls: string[] = [];
    for (let i = 0; i < batch.length; i += 1) {
      try {
        const url = await apiService.uploadImage(batch[i].file);
        if (url) urls.push(url);
        else showToast(`Failed to upload ${batch[i].file.name}`);
      } catch {
        showToast(`Failed to upload ${batch[i].file.name}`);
      }
      setUploadProgress({ done: i + 1, total: batch.length });
    }
    try {
      if (!urls.length) throw new Error('no images');
      const saved = await apiService.sendMessage({
        chatId,
        content: JSON.stringify(urls),
        type: 'image',
        replyToId: reply?.id,
        replyToContent: reply?.content,
        replyToSenderName: reply ? replyToSenderName(reply) : undefined,
      });
      setMessages((current) =>
        current.map((message) => (message.id === optimistic.id ? saved : message))
      );
      if (caption.trim()) void sendTextMessage(caption.trim());
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      showToast('Failed to send images');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleSend = () => {
    if (uploadProgress) return;
    if (staged.length > 0) {
      const caption = text;
      setText('');
      void sendStagedImages(caption);
      return;
    }
    void sendTextMessage();
  };

  const stageFiles = (files: FileList | null, fromCamera = false) => {
    if (!files?.length) return;
    const list = Array.from(files);
    if (fromCamera) {
      const file = list[0];
      setStaged((current) =>
        current.length >= 10
          ? (showToast('Max 10 images already staged'), current)
          : [...current, { id: `${Date.now()}_cam`, file, preview: URL.createObjectURL(file) }]
      );
      return;
    }
    setStaged((current) => {
      const remaining = 10 - current.length;
      if (remaining <= 0) {
        showToast('Max 10 images already staged');
        return current;
      }
      if (list.length > remaining) {
        showToast(
          `Only ${remaining} more image${remaining > 1 ? 's' : ''} allowed (max 10)`
        );
      }
      return [
        ...current,
        ...list.slice(0, remaining).map((file, index) => ({
          id: `${Date.now()}_${index}`,
          file,
          preview: URL.createObjectURL(file),
        })),
      ];
    });
  };

  const onInputChange = (value: string) => {
    setText(value);
    if (!chatId) return;
    wsService.send(value.trim() ? 'typing_start' : 'typing_end', { chatId });
  };

  const react = async (emoji: string) => {
    if (!reactionTarget) return;
    try {
      await apiService.reactToMessage(reactionTarget.id, emoji);
      setMessages((current) =>
        current.map((message) =>
          message.id === reactionTarget.id
            ? { ...message, reactions: { ...message.reactions, [userId ?? 'me']: emoji } }
            : message
        )
      );
    } catch {
      /* ignore */
    }
    setReactionTarget(null);
  };

  const mediaMessages = useMemo(
    () =>
      messages
        .slice()
        .reverse()
        .flatMap((message) =>
          message.type === 'image' ? parseMessageImages(message.content) : []
        ),
    [messages]
  );

  /* -------------------------------- render ------------------------------ */

  const renderShimmer = () => (
    <Box sx={{ p: '20px 16px' }}>
      {Array.from({ length: 8 }).map((_, index) => {
        const isMe = index % 2 === 0;
        const width = 100 + ((index * 37) % 100);
        const height = 40 + ((index * 17) % 20);
        return (
          <Box
            key={index}
            sx={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', mb: '12px' }}
          >
            <Box
              sx={{
                width,
                height,
                borderRadius: '16px',
                borderBottomLeftRadius: isMe ? '16px' : '4px',
                borderBottomRightRadius: isMe ? '4px' : '16px',
                bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE',
              }}
            />
          </Box>
        );
      })}
    </Box>
  );

  const renderEmpty = () => (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: '16px',
      }}
    >
      <Box
        sx={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          bgcolor: 'rgba(2,106,253,0.08)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <ForumRoundedIcon sx={{ fontSize: 48, color: '#026AFD' }} />
      </Box>
      <Box sx={{ height: 20 }} />
      <Box sx={{ fontSize: 18, fontWeight: 700, color: c.isDark ? '#FFFFFF' : '#424242' }}>
        No messages yet
      </Box>
      <Box sx={{ height: 8 }} />
      <Box sx={{ px: '40px', textAlign: 'center', fontSize: 14, color: '#9E9E9E' }}>
        {chat
          ? `Start a conversation with ${partnerName}`
          : 'Say hello to start the chat!'}
      </Box>
    </Box>
  );

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`chat-message-${messageId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const emojiSets = [
    ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋'],
    ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌'],
    ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊'],
    ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅'],
    ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦'],
  ];

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: c.isDark ? '#121212' : '#F8F9FA',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* blurred custom app bar */}
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
            sx={{
              width: 48,
              height: 48,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              color: c.text,
              flexShrink: 0,
            }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box
            role="button"
            onClick={() => {
              if (chat?.isGroup) {
                setGroupOpen(true);
              } else if (chat?.partnerId) {
                navigate(`/view-profile/${chat.partnerId}`, {
                  state: {
                    user: {
                      id: chat.partnerId,
                      name: partnerName,
                      avatar: chat.partnerAvatar,
                      photos: chat.partnerPhotos,
                      status: chat.partnerStatus,
                    },
                  },
                });
              }
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <PulseAvatar image={avatar} name={partnerName} size={40} online={chat?.isOnline} />
            <Box sx={{ width: 12 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
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
                {partnerName}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {typing ? (
                  <>
                    <Box
                      sx={{
                        fontSize: 12,
                        lineHeight: 1.33,
                        fontWeight: 700,
                        color: '#026AFD',
                      }}
                    >
                      typing...
                    </Box>
                    <TypingDots />
                  </>
                ) : (
                  <Box
                    sx={{
                      fontSize: 12,
                      lineHeight: 1.33,
                      color: '#757575',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {subtitle}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
          <Box
            role="button"
            aria-label="More"
            onClick={() => setMenuOpen((value) => !value)}
            sx={{
              width: 48,
              height: 48,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              color: '#026AFD',
              flexShrink: 0,
            }}
          >
            <MoreVertIcon sx={{ fontSize: 24 }} />
          </Box>
        </Box>

        {menuOpen && (
          <>
            <Box
              onClick={() => setMenuOpen(false)}
              sx={{ position: 'fixed', inset: 0, zIndex: 30 }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 'calc(100% - 4px)',
                right: 12,
                bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
                borderRadius: '12px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                py: '8px',
                minWidth: 200,
                zIndex: 31,
              }}
            >
              <Box
                role="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (mediaMessages.length === 0) {
                    showToast('No media shared yet');
                  } else {
                    setMediaOpen(true);
                  }
                }}
                sx={{ px: '16px', py: '12px', fontSize: 14, color: c.text, cursor: 'pointer' }}
              >
                Shared Media
              </Box>
              <Box
                role="button"
                onClick={() => {
                  setMenuOpen(false);
                  setBlockOpen(true);
                }}
                sx={{
                  px: '16px',
                  py: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}
              >
                <BlockIcon sx={{ fontSize: 20, color: '#F44336' }} />
                <Box sx={{ fontSize: 14, fontWeight: 600, color: '#F44336' }}>Block Contact</Box>
              </Box>
            </Box>
          </>
        )}
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
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overscrollBehaviorY: 'contain',
              px: '16px',
              py: '20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {typing && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: '20px' }}>
                <PulseAvatar image={avatar} name={partnerName} size={30} online />
                <Box sx={{ width: 8 }} />
                <Box
                  sx={{
                    px: '12px',
                    py: '8px',
                    borderRadius: '20px',
                    bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
                    fontWeight: 700,
                    color: '#026AFD',
                    letterSpacing: '2px',
                  }}
                >
                  ...
                </Box>
              </Box>
            )}
            {messages.map((message) => {
              const isMe = message.senderId === userId;
              const sender =
                message.senderName ||
                chat?.participantsProfiles.find((entry) => entry.id === message.senderId)?.name;
              return (
                <Box key={message.id} id={`chat-message-${message.id}`}>
                  <MessageBubble
                    message={message}
                    isMe={isMe}
                    showSender={Boolean(chat?.isGroup)}
                    senderName={sender}
                    onLongPress={(target) => setReactionTarget(target)}
                    onSwipeReply={(target) => {
                      setReplyTo(target);
                      inputRef.current?.focus();
                    }}
                    onQuoteTap={scrollToMessage}
                    onImageTap={(urls, index) => setCarousel({ images: urls, index })}
                  />
                </Box>
              );
            })}
          </Box>
        )}

        {!loading && messages.length === 0 && (
          <IcebreakerHub
            onPick={(value) => {
              setText(value);
              void sendTextMessage(value);
            }}
          />
        )}
      </Box>

      {/* composer */}
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: c.isDark ? 'rgba(18,18,18,0.75)' : 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 -5px 15px rgba(0,0,0,0.04)',
          borderTop: `1px solid ${c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        {uploadProgress && (
          <>
            <Box sx={{ height: 2, bgcolor: 'transparent' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${(uploadProgress.done / Math.max(1, uploadProgress.total)) * 100}%`,
                  bgcolor: '#026AFD',
                  transition: 'width 200ms ease',
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                px: '16px',
                py: '4px',
                fontSize: 10,
                fontWeight: 700,
                color: '#026AFD',
              }}
            >
              <span>
                Uploading {uploadProgress.done} of {uploadProgress.total}...
              </span>
              <span>
                {Math.floor(
                  (uploadProgress.done / Math.max(1, uploadProgress.total)) * 100
                )}
                %
              </span>
            </Box>
          </>
        )}

        {staged.length > 0 && (
          <Box sx={{ pt: '8px', px: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ fontSize: 12, fontWeight: 700, color: '#026AFD' }}>
                {staged.length} image{staged.length > 1 ? 's' : ''} selected
              </Box>
              <Box sx={{ flex: 1 }} />
              <Box
                role="button"
                onClick={() => setStaged([])}
                sx={{ fontSize: 12, fontWeight: 600, color: '#F44336', cursor: 'pointer' }}
              >
                Clear all
              </Box>
            </Box>
            <Box sx={{ height: 8 }} />
            <Box sx={{ height: 85, display: 'flex', gap: '12px', overflowX: 'auto' }}>
              {staged.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    flexShrink: 0,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <Box
                    component="img"
                    src={item.preview}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Box
                    role="button"
                    onClick={() => setStaged((current) => current.filter((x) => x.id !== item.id))}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 14,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: 'rgba(0,0,0,0.54)',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {replyTo && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mx: '12px',
              my: '4px',
              p: '10px 16px',
              bgcolor: c.isDark ? '#1C1C1E' : '#F0F2F5',
              borderRadius: '16px',
              borderLeft: '4px solid #026AFD',
            }}
          >
            <ReplyRoundedIcon sx={{ fontSize: 18, color: '#026AFD', mr: '8px' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ fontSize: 12, fontWeight: 700, color: '#026AFD' }}>
                {replyToSenderName(replyTo)}
              </Box>
              <Box sx={{ height: 2 }} />
              <Box
                sx={{
                  fontSize: 13,
                  color: c.isDark ? '#E0E0E0' : '#616161',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {replyTo.content}
              </Box>
            </Box>
            <Box
              role="button"
              onClick={() => setReplyTo(null)}
              sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                bgcolor: c.isDark ? '#424242' : '#E0E0E0',
                display: 'grid',
                placeItems: 'center',
                ml: '8px',
                cursor: 'pointer',
              }}
            >
              <CloseRoundedIcon
                sx={{ fontSize: 14, color: c.isDark ? 'rgba(255,255,255,0.7)' : '#9E9E9E' }}
              />
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-end', px: '8px', pt: '10px', pb: '12px' }}>
          {/* prefix chips */}
          {text.trim().length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <InputIconButton
                active={emojiOpen}
                onClick={() => setEmojiOpen((value) => !value)}
                icon={
                  emojiOpen ? (
                    <KeyboardRoundedIcon sx={{ fontSize: 20, color: '#026AFD' }} />
                  ) : (
                    <EmojiEmotionsOutlinedIcon sx={{ fontSize: 20, color: '#026AFD' }} />
                  )
                }
              />
              <Box sx={{ width: 4 }} />
              <InputIconButton
                onClick={() => cameraInputRef.current?.click()}
                icon={<CameraAltOutlinedIcon sx={{ fontSize: 20, color: '#026AFD' }} />}
              />
              <Box sx={{ width: 4 }} />
              <InputIconButton
                active={staged.length > 0}
                badge={staged.length}
                onClick={() => fileInputRef.current?.click()}
                icon={
                  <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20, color: '#026AFD' }} />
                }
              />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <InputIconButton
                active={mediaMenuOpen}
                onClick={() => setMediaMenuOpen((value) => !value)}
                icon={
                  <AddRoundedIcon
                    sx={{
                      fontSize: 24,
                      color: '#026AFD',
                      transform: mediaMenuOpen ? 'rotate(45deg)' : 'none',
                      transition: 'transform 250ms ease',
                    }}
                  />
                }
              />
              {mediaMenuOpen && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ width: 8 }} />
                  <InputIconButton
                    active={emojiOpen}
                    onClick={() => setEmojiOpen((value) => !value)}
                    icon={<EmojiEmotionsOutlinedIcon sx={{ fontSize: 20, color: '#026AFD' }} />}
                  />
                  <Box sx={{ width: 4 }} />
                  <InputIconButton
                    onClick={() => cameraInputRef.current?.click()}
                    icon={<CameraAltOutlinedIcon sx={{ fontSize: 20, color: '#026AFD' }} />}
                  />
                  <Box sx={{ width: 4 }} />
                  <InputIconButton
                    active={staged.length > 0}
                    badge={staged.length}
                    onClick={() => fileInputRef.current?.click()}
                    icon={
                      <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20, color: '#026AFD' }} />
                    }
                  />
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ width: 4 }} />
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 46,
              maxHeight: 150,
              borderRadius: '23px',
              bgcolor: c.isDark ? 'rgba(28,28,30,0.8)' : 'rgba(240,242,245,0.8)',
              p: '11px 16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box
              component="textarea"
              ref={inputRef}
              value={text}
              rows={1}
              onChange={(event) => onInputChange(event.target.value)}
              onFocus={() => setEmojiOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              sx={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                bgcolor: 'transparent',
                color: c.isDark ? '#FFFFFF' : '#1A1A2E',
                fontSize: 15,
                lineHeight: 1.3,
                fontFamily: 'inherit',
                maxHeight: 128,
                overflowY: 'auto',
                '&::placeholder': { color: '#9E9E9E', opacity: 1 },
              }}
            />
          </Box>
          <Box sx={{ width: 8 }} />
          <Box
            role="button"
            aria-label="Send"
            onClick={handleSend}
            sx={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              cursor: uploadProgress ? 'default' : 'pointer',
              background:
                text.trim() || staged.length > 0 ? '#026AFD' : undefined,
              bgcolor:
                text.trim() || staged.length > 0
                  ? undefined
                  : c.isDark
                  ? '#424242'
                  : '#EEEEEE',
              boxShadow:
                text.trim() || staged.length > 0
                  ? '0 4px 10px rgba(2,106,253,0.35)'
                  : 'none',
              transition: 'background 200ms ease',
            }}
          >
            <SendRoundedIcon
              sx={{
                fontSize: 18,
                color:
                  text.trim() || staged.length > 0
                    ? '#FFFFFF'
                    : c.isDark
                    ? '#757575'
                    : '#BDBDBD',
              }}
            />
          </Box>
        </Box>

        {emojiOpen && (
          <Box
            sx={{
              height: 320,
              bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
              borderTop: `1px solid ${c.isDark ? '#424242' : '#EEEEEE'}`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '12px',
                p: '16px',
                overflowY: 'auto',
                alignContent: 'start',
              }}
            >
              {emojiSets[emojiTab].map((emoji) => (
                <Box
                  key={emoji}
                  role="button"
                  onClick={() => setText((current) => current + emoji)}
                  sx={{
                    fontSize: 26,
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {emoji}
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                height: 50,
                bgcolor: c.isDark ? '#121212' : '#FAFAFA',
                borderTop: `1px solid ${c.isDark ? '#424242' : '#EEEEEE'}`,
                display: 'flex',
                alignItems: 'stretch',
              }}
            >
              {[
                <EmojiEmotionsOutlinedIcon key="a" sx={{ fontSize: 22 }} />,
                <span key="b" style={{ fontSize: 22 }}>❤️</span>,
                <span key="c" style={{ fontSize: 22 }}>✋</span>,
                <span key="d" style={{ fontSize: 22 }}>🐾</span>,
                <span key="e" style={{ fontSize: 22 }}>🍔</span>,
              ].map((icon, index) => (
                <Box
                  key={index}
                  role="button"
                  onClick={() => setEmojiTab(index)}
                  sx={{
                    flex: 1,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    color: emojiTab === index ? '#026AFD' : '#BDBDBD',
                    borderBottom: emojiTab === index ? '2px solid #026AFD' : '2px solid transparent',
                  }}
                >
                  {icon}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          stageFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          stageFiles(event.target.files, true);
          event.target.value = '';
        }}
      />

      <ReactionSheet
        message={reactionTarget}
        onClose={() => setReactionTarget(null)}
        onReact={(emoji) => void react(emoji)}
        onReply={() => {
          if (reactionTarget) setReplyTo(reactionTarget);
          setReactionTarget(null);
          inputRef.current?.focus();
        }}
      />

      {chat?.isGroup && groupOpen && (
        <GroupInfoSheet
          open={groupOpen}
          chat={chat}
          currentUserId={userId ?? ''}
          onClose={() => setGroupOpen(false)}
          onRefresh={() => void loadChat()}
        />
      )}

      <ConfirmDialog
        open={blockOpen}
        title="Block Contact?"
        content={`Are you sure you want to block ${partnerName}? You will no longer receive messages from them.`}
        confirmLabel="Block"
        danger
        radius={16}
        onCancel={() => setBlockOpen(false)}
        onConfirm={async () => {
          setBlockOpen(false);
          if (!chat) return;
          try {
            await apiService.blockUser(chat.partnerId);
            showToast('User blocked');
            navigate(-1);
          } catch {
            showToast('Error blocking user');
          }
        }}
      />

      {/* media gallery */}
      <Dialog
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        fullScreen
        PaperProps={{
          sx: { bgcolor: c.isDark ? '#121212' : '#FFFFFF', backgroundImage: 'none' },
        }}
      >
        <Box sx={{ p: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Box
            role="button"
            onClick={() => setMediaOpen(false)}
            sx={{ cursor: 'pointer', display: 'grid', placeItems: 'center', width: 40, height: 40 }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 20, color: c.text }} />
          </Box>
          <Box>
            <Box sx={{ fontSize: 16, fontWeight: 700, color: c.text }}>
              Media, Links, and Docs
            </Box>
            <Box sx={{ fontSize: 12, color: c.isDark ? '#BDBDBD' : '#757575' }}>
              {mediaMessages.length} items
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '2px',
            p: '2px',
          }}
        >
          {mediaMessages.map((url, index) => (
            <Box
              key={`${url}-${index}`}
              role="button"
              onClick={() => setCarousel({ images: mediaMessages, index })}
              sx={{
                aspectRatio: '1 / 1',
                overflow: 'hidden',
                bgcolor: c.isDark ? '#1C1C1E' : '#F5F5F5',
                cursor: 'pointer',
              }}
            >
              <Box
                component="img"
                src={url}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </Box>
          ))}
        </Box>
      </Dialog>

      <FullScreenViewer
        open={carousel != null}
        images={carousel?.images ?? []}
        initialIndex={carousel?.index ?? 0}
        onClose={() => setCarousel(null)}
      />

      <EffectsOverlay effect={effect} />

      <style>{`
        @keyframes zp-break-image { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const InputIconButton = ({
  icon,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) => {
  const c = usePalette();
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      sx={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        bgcolor: active ? 'rgba(2,106,253,0.12)' : c.isDark ? '#2C2C2E' : '#F5F5F5',
        transition: 'background 200ms ease',
      }}
    >
      {icon}
      {badge != null && badge > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            minHeight: 16,
            p: '4px',
            borderRadius: '50%',
            bgcolor: '#F44336',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {badge}
        </Box>
      )}
    </Box>
  );
};

function partnerNameOrFallback(name: string): string {
  return name || PARTNER_FALLBACK;
}

function replyToSenderName(message: Message): string {
  return message.senderName || 'Partner';
}

function parseMessageImages(content: string): string[] {
  if (!content) return [];
  const value = content.trim();
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
      if (typeof parsed === 'string') return [parsed];
    } catch {
      return [];
    }
    return [];
  }
  if (value.startsWith('http') || value.startsWith('blob:')) return [value];
  return [];
}

/* re-export small utility so the room screen can share the bubble */
export { BrokenImageIcon, formatTime, isOnlyEmoji };
