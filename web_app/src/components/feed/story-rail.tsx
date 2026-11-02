import { Box } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import StarIcon from '@mui/icons-material/Star';
import { usePalette } from '../../contexts/app-theme.context';
import { NearbyUser } from '../../models/chat.models';
import { firstName, formatDistance, firstInitial } from '../../utils/format';
import { Shimmer, ShimmerBox } from '../common/shimmer';

const RINGS: Record<
  string,
  { start: string; end: string; Icon: typeof BoltIcon; badge: string }
> = {
  available: { start: '#026AFD', end: '#90CAF9', Icon: BoltIcon, badge: '#026AFD' },
  busy: { start: '#FFC107', end: '#FFF176', Icon: RemoveCircleIcon, badge: '#FFC107' },
  ghost: {
    start: '#BDBDBD',
    end: '#EEEEEE',
    Icon: VisibilityOffIcon,
    badge: '#9E9E9E',
  },
  super: { start: '#E040FB', end: '#B39DDB', Icon: StarIcon, badge: '#9C27B0' },
};

interface StoryRailProps {
  users: NearbyUser[];
  currentUserId?: string | null;
  loading?: boolean;
  onOpen: (userId: string) => void;
}

/** `_buildStoryBar`: 130 px nearby rail of 80 px items (max 15). */
export const StoryRail = ({ users, currentUserId, loading, onOpen }: StoryRailProps) => {
  const c = usePalette();
  const visible = users
    .filter((user) => user.id && user.id !== currentUserId)
    .slice(0, 15);

  const band = {
    height: 130,
    py: '12px',
    bgcolor: c.isDark ? '#1C1C1E' : '#FFFFFF',
    borderBottom: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
    flexShrink: 0,
  } as const;

  if (loading) {
    return (
      <Shimmer>
        <Box sx={band}>
          <Box sx={{ display: 'flex', gap: '12px', px: '16px', height: '100%', overflow: 'hidden' }}>
            {Array.from({ length: 7 }).map((_, index) => (
              <Box
                key={index}
                sx={{ width: 80, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <ShimmerBox width={66} height={66} radius={33} />
                <Box sx={{ height: 6 }} />
                <ShimmerBox width={56} height={12} radius={4} />
                <Box sx={{ height: 4 }} />
                <ShimmerBox width={40} height={10} radius={4} />
              </Box>
            ))}
          </Box>
        </Box>
      </Shimmer>
    );
  }

  if (!visible.length) return null;

  return (
    <Box sx={band}>
      <Box
        sx={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          px: '16px',
          height: '100%',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {visible.map((user) => {
          const ring = RINGS[user.status] ?? RINGS.available;
          const image =
            user.avatar ||
            user.photos.find((photo) => photo && !photo.includes('Portrait_Placeholder.png')) ||
            null;
          return (
            <Box
              key={user.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(user.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onOpen(user.id);
              }}
              sx={{
                width: 80,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Box
                sx={{
                  width: 66,
                  height: 66,
                  borderRadius: '50%',
                  p: '3px',
                  background: `linear-gradient(135deg, ${ring.start}, ${ring.end})`,
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    bgcolor: c.isDark ? '#121212' : '#FFFFFF',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {image ? (
                    <Box
                      component="img"
                      src={image}
                      alt={user.name}
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
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#026AFD',
                      }}
                    >
                      {firstInitial(user.name)}
                    </Box>
                  )}
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    p: '2px',
                    borderRadius: '50%',
                    bgcolor: c.isDark ? '#121212' : '#FFFFFF',
                    display: 'flex',
                  }}
                >
                  <ring.Icon sx={{ fontSize: 12, color: ring.badge }} />
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  mt: '4px',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.33,
                  color: c.text,
                }}
              >
                {firstName(user.name)}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: 10,
                  lineHeight: 1.4,
                  color: c.isDark ? '#BDBDBD' : '#757575',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDistance(user.distance)}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
