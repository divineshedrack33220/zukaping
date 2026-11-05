import { Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { usePalette } from '../../contexts/app-theme.context';
import { NearbyUser } from '../../models/chat.models';
import { firstInitial, formatDistance, pickAvatar } from '../../utils/format';

interface RadarOverlayProps {
  open: boolean;
  users: NearbyUser[];
  scanning: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onChat: (userId: string) => void;
  onView: (userId: string) => void;
}

/** Decorative contacts inside the dish: angle runs clockwise from 12 o'clock. */
const BLIPS = [
  { angle: 22, radius: 82 },
  { angle: 64, radius: 47 },
  { angle: 112, radius: 93 },
  { angle: 151, radius: 61 },
  { angle: 197, radius: 86 },
  { angle: 238, radius: 38 },
  { angle: 286, radius: 72 },
  { angle: 331, radius: 54 },
];

/** `_buildBroadcastOverlay` — full-body radar scan sheet. */
export const RadarOverlay = ({
  open,
  users,
  scanning,
  title,
  subtitle,
  onClose,
  onChat,
  onView,
}: RadarOverlayProps) => {
  const c = usePalette();
  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        bgcolor: c.isDark ? 'rgba(18,18,18,0.98)' : 'rgba(255,255,255,0.98)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        role="button"
        aria-label="Close radar"
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: c.isDark ? '#1C1C1E' : '#F5F5F5',
          border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 3,
        }}
      >
        <CloseIcon sx={{ fontSize: 24, color: c.isDark ? '#FFFFFF' : '#333333' }} />
      </Box>

      {users.length > 0 ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            pt: '72px',
          }}
        >
          {/* The count is the payload of the whole scan, so it gets a header
              instead of being silently replaced by the list. */}
          <Box sx={{ px: '16px', pb: '12px', flexShrink: 0 }}>
            <Box sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: c.text }}>
              {title}
            </Box>
            <Box
              sx={{
                mt: '4px',
                fontSize: 14,
                lineHeight: 1.43,
                color: c.isDark ? '#9E9E9E' : '#757575',
              }}
            >
              {subtitle}
            </Box>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: '16px', pb: '24px' }}>
            {users.map((user) => {
              const avatar = pickAvatar(user.avatar, user.photos);
              return (
                <Box
                  key={user.id}
                  sx={{
                    mb: '12px',
                    p: '16px',
                    borderRadius: '12px',
                    bgcolor: c.isDark ? '#1C1C1E' : '#FAFAFA',
                    border: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      flexShrink: 0,
                      bgcolor: 'rgba(2,106,253,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                      <Box sx={{ fontSize: 28, fontWeight: 700, color: '#026AFD' }}>
                        {firstInitial(user.name)}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ ml: '12px', flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: 1.5,
                        color: c.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.name}
                    </Box>
                    <Box
                      sx={{
                        mt: '4px',
                        fontSize: 14,
                        lineHeight: 1.43,
                        color: c.isDark ? '#BDBDBD' : '#666666',
                      }}
                    >
                      {formatDistance(user.distance)}
                    </Box>
                  </Box>
                  <Box
                    role="button"
                    aria-label="Chat"
                    onClick={() => onChat(user.id)}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      ml: '8px',
                    }}
                  >
                    <ChatBubbleOutlineIcon
                      sx={{ fontSize: 18, color: c.isDark ? '#FFFFFF' : '#333333' }}
                    />
                  </Box>
                  <Box
                    role="button"
                    aria-label="View profile"
                    onClick={() => onView(user.id)}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: c.isDark ? '#2C2C2E' : '#EEEEEE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      ml: '8px',
                    }}
                  >
                    <VisibilityIcon
                      sx={{ fontSize: 18, color: c.isDark ? '#FFFFFF' : '#333333' }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ) : (
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
          <Box sx={{ width: 300, height: 300, position: 'relative', flexShrink: 0 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 300,
                  height: 300,
                  marginLeft: '-150px',
                  marginTop: '-150px',
                  borderRadius: '50%',
                  border: '2px solid #026AFD',
                  opacity: scanning ? 0 : 0,
                  animation: scanning
                    ? `radar-wave 2s linear ${i * 0.66}s infinite`
                    : 'none',
                }}
              />
            ))}
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 210,
                height: 210,
                marginLeft: '-105px',
                marginTop: '-105px',
                borderRadius: '50%',
                border: '1px solid rgba(2,106,253,0.2)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 140,
                height: 140,
                marginLeft: '-70px',
                marginTop: '-70px',
                borderRadius: '50%',
                border: '1px solid rgba(2,106,253,0.14)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 210,
                height: 210,
                marginLeft: '-105px',
                marginTop: '-105px',
                borderRadius: '50%',
                bgcolor: 'rgba(2,106,253,0.04)',
                background:
                  'radial-gradient(circle, rgba(2,106,253,0.16) 0%, rgba(2,106,253,0.04) 55%, rgba(2,106,253,0) 72%)',
              }}
            />
            {/* Sweep: the bright edge sits at 3 o'clock and the glow fades
                counter-clockwise behind it, so the trail lags the rotation. */}
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 210,
                height: 210,
                marginLeft: '-105px',
                marginTop: '-105px',
                borderRadius: '50%',
                opacity: scanning ? 1 : 0.2,
                background:
                  'conic-gradient(from 90deg, rgba(2,106,253,0.55) 0deg, rgba(2,106,253,0) 1deg, rgba(2,106,253,0) 235deg, rgba(2,106,253,0.04) 265deg, rgba(2,106,253,0.16) 310deg, rgba(2,106,253,0.55) 360deg)',
                animation: scanning ? 'radar-sweep 2600ms linear infinite' : 'none',
              }}
            />
            {BLIPS.map((blip) => (
              <Box
                key={`${blip.angle}-${blip.radius}`}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 9,
                  height: 9,
                  marginLeft: `${Math.sin((blip.angle * Math.PI) / 180) * blip.radius - 4.5}px`,
                  marginTop: `${-Math.cos((blip.angle * Math.PI) / 180) * blip.radius - 4.5}px`,
                  borderRadius: '50%',
                  bgcolor: '#026AFD',
                  boxShadow: '0 0 10px rgba(2,106,253,0.9)',
                  opacity: scanning ? undefined : 0,
                  animation: scanning
                    ? `radar-blip 2600ms linear -${
                        2600 - ((blip.angle - 90 + 360) % 360) * (2600 / 360)
                      }ms infinite`
                    : 'none',
                }}
              />
            ))}
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 30,
                height: 30,
                marginLeft: '-15px',
                marginTop: '-15px',
                borderRadius: '50%',
                bgcolor: '#026AFD',
                boxShadow: '0 0 20px rgba(2,106,253,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: scanning ? 'radar-pulse 1600ms ease-in-out infinite' : 'none',
              }}
            >
              <LocationOnIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />
            </Box>
          </Box>
          {scanning ? (
            <>
              <Box
                sx={{
                  mt: '40px',
                  fontSize: 20,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: c.text,
                  textAlign: 'center',
                }}
              >
                {title}
              </Box>
              <Box
                sx={{
                  mt: '16px',
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: c.isDark ? '#BDBDBD' : '#666666',
                  textAlign: 'center',
                }}
              >
                {subtitle}
              </Box>
            </>
          ) : (
            <Box
              sx={{
                mt: '32px',
                p: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <LocationOffIcon sx={{ fontSize: 64, color: '#BDBDBD' }} />
              <Box
                sx={{
                  mt: '16px',
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.33,
                  color: c.isDark ? '#E0E0E0' : '#616161',
                  textAlign: 'center',
                }}
              >
                {title}
              </Box>
              <Box
                sx={{
                  mt: '8px',
                  fontSize: 14,
                  lineHeight: 1.43,
                  color: '#9E9E9E',
                  textAlign: 'center',
                }}
              >
                {subtitle}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <style>{`
        @keyframes radar-wave {
          0% { transform: scale(0.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes radar-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 12px rgba(2,106,253,0.55);
          }
          50% {
            transform: scale(1.12);
            box-shadow: 0 0 26px rgba(2,106,253,0.95);
          }
        }
        @keyframes radar-blip {
          0% { opacity: 1; transform: scale(1); }
          12% { opacity: 0.85; transform: scale(0.92); }
          55%, 100% { opacity: 0; transform: scale(0.7); }
        }
      `}</style>
    </Box>
  );
};
