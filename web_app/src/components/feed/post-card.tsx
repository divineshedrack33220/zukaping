import { Box } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CheckIcon from '@mui/icons-material/Check';
import { usePalette } from '../../contexts/app-theme.context';
import { FeedPost } from '../../models/chat.models';
import {
  cleanPostContent,
  firstInitial,
  formatDistance,
  formatTime,
  pickAvatar,
} from '../../utils/format';

interface PostCardProps {
  post: FeedPost;
  index: number;
  isOwn: boolean;
  isFavorited: boolean;
  onOpen: (userId: string) => void;
  onIgnore: (post: FeedPost) => void;
  onFavorite: (post: FeedPost) => void;
  onAccept: (post: FeedPost) => void;
}

const ACTION_SX = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  cursor: 'pointer',
  boxShadow: '0 3px 6px rgba(0,0,0,0.04)',
  transition: 'background-color 200ms linear, transform 150ms ease-in-out',
  '&:active': { transform: 'scale(0.85)' },
} as const;

/** Inline `_buildPostCard` (feed_screen.dart). */
export const PostCard = ({
  post,
  index,
  isOwn,
  isFavorited,
  onOpen,
  onIgnore,
  onFavorite,
  onAccept,
}: PostCardProps) => {
  const c = usePalette();
  const isSuper = post.userStatus === 'super';
  const avatar = pickAvatar(post.userAvatar, post.userPhotos, post.images);
  const content = cleanPostContent(post.content);
  const duration = 300 + index * 50;

  const cardBg = isSuper
    ? c.isDark
      ? '#1C2C3E'
      : '#F0F7FF'
    : c.isDark
    ? '#1C1C1E'
    : '#FAFAFA';

  return (
    <Box
      onClick={() => onOpen(post.userId)}
      sx={{
        mb: '16px',
        p: '20px',
        borderRadius: '16px',
        bgcolor: cardBg,
        border: isSuper
          ? '2px solid rgba(2,106,253,0.3)'
          : `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
        boxShadow: isSuper ? '0 0 15px 2px rgba(2,106,253,0.1)' : 'none',
        cursor: 'pointer',
        animation: `feed-card-in ${duration}ms linear both`,
        '@keyframes feed-card-in': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            flexShrink: 0,
            animation: `post-avatar-pulse 2s linear infinite`,
            '@keyframes post-avatar-pulse': {
              '0%': {
                boxShadow: `0 0 0 0 ${
                  isSuper ? 'rgba(124,77,255,1)' : 'rgba(2,106,253,1)'
                }`,
              },
              '100%': {
                boxShadow: `0 0 0 ${
                  isSuper ? 8 : 5
                }px ${isSuper ? 'rgba(124,77,255,0)' : 'rgba(2,106,253,0)'}`,
                filter: 'none',
              },
            },
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              overflow: 'hidden',
              bgcolor: 'rgba(2,106,253,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {avatar ? (
              <Box
                component="img"
                src={avatar}
                alt={post.userName}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Box
                component="span"
                sx={{ fontSize: 24, fontWeight: 700, color: '#026AFD' }}
              >
                {firstInitial(post.userName)}
              </Box>
            )}
          </Box>
        </Box>

        <Box sx={{ ml: '16px', minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.33,
              color: c.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {post.userName}
          </Box>
          <Box
            sx={{
              mt: '4px',
              fontSize: 14,
              lineHeight: 1.43,
              color: c.isDark ? '#BDBDBD' : '#666666',
            }}
          >
            {formatDistance(post.distance)}
          </Box>
          <Box
            sx={{
              mt: '4px',
              fontSize: 12,
              lineHeight: 1.33,
              color: '#026AFD',
            }}
          >
            🔵 Live now
          </Box>
        </Box>
      </Box>

      {post.category != null && (
        <Box
          sx={{
            mt: '12px',
            display: 'inline-flex',
            px: '12px',
            py: '4px',
            borderRadius: '16px',
            bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE',
            fontSize: 14,
            lineHeight: 1.43,
            color: c.text,
          }}
        >
          {post.category}
        </Box>
      )}

      {content && (
        <Box
          sx={{
            mt: '12px',
            fontSize: 16,
            lineHeight: 1.4,
            color: c.isDark ? '#E0E0E0' : '#333333',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </Box>
      )}

      <Box
        sx={{
          mt: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <AccessTimeIcon sx={{ fontSize: 16, color: '#FFD700' }} />
          <Box
            component="span"
            sx={{
              ml: '8px',
              fontSize: 14,
              lineHeight: 1.43,
              color: c.isDark ? '#BDBDBD' : '#666666',
              whiteSpace: 'nowrap',
            }}
          >
            {formatTime(post.createdAt)}
          </Box>
        </Box>

        {isOwn ? (
          <Box
            sx={{
              px: '16px',
              py: '8px',
              borderRadius: '20px',
              bgcolor: 'rgba(2,106,253,0.1)',
              color: '#026AFD',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.43,
              whiteSpace: 'nowrap',
            }}
          >
            ✨ My Request
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: '12px' }}>
            <Box
              role="button"
              aria-label="Ignore"
              onClick={(event) => {
                event.stopPropagation();
                onIgnore(post);
              }}
              sx={{
                ...ACTION_SX,
                bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
              }}
            >
              <CloseIcon sx={{ fontSize: 24, color: c.isDark ? '#BDBDBD' : '#757575' }} />
            </Box>
            <Box
              role="button"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              onClick={(event) => {
                event.stopPropagation();
                onFavorite(post);
              }}
              sx={{
                ...ACTION_SX,
                bgcolor: isFavorited ? '#FFECEF' : c.isDark ? '#2C2C2E' : '#F5F5F5',
              }}
            >
              {isFavorited ? (
                <FavoriteIcon sx={{ fontSize: 24, color: '#E91E63' }} />
              ) : (
                <FavoriteBorderIcon
                  sx={{ fontSize: 24, color: c.isDark ? '#BDBDBD' : '#757575' }}
                />
              )}
            </Box>
            <Box
              role="button"
              aria-label="Accept request"
              onClick={(event) => {
                event.stopPropagation();
                onAccept(post);
              }}
              sx={{ ...ACTION_SX, bgcolor: '#E5F7FD' }}
            >
              <CheckIcon sx={{ fontSize: 24, color: '#026AFD' }} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
