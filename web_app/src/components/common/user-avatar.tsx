import { Box } from '@mui/material';
import { usePalette } from '../../contexts/app-theme.context';
import { firstInitial, pickAvatar } from '../../utils/format';
import { PRIMARY } from '../../styles/tokens';

interface UserAvatarProps {
  name?: string | null;
  avatar?: string | null;
  photos?: string[] | null;
  images?: string[] | null;
  size: number;
  /** Continue the Flutter status ring? Pass the user status. */
  status?: string | null;
  ring?: boolean;
  border?: string;
  bgAlpha?: number;
  fontSize?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * Generic avatar with the exact Flutter placeholder treatment:
 * `#026AFD @ 0.2` circle, bold `#026AFD` initial.
 */
export const UserAvatar = ({
  name,
  avatar,
  photos,
  images,
  size,
  ring,
  border,
  bgAlpha = 0.2,
  fontSize,
  onClick,
  style,
}: UserAvatarProps) => {
  const c = usePalette();
  const src = pickAvatar(avatar, photos, images);
  const initialSize = fontSize ?? Math.round(size * 0.375);

  return (
    <Box
      onClick={onClick}
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        bgcolor: `rgba(2,106,253,${bgAlpha})`,
        border: ring
          ? `3px solid ${c.isDark ? '#121212' : '#FFFFFF'}`
          : border || 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={name ?? ''}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Box
          component="span"
          sx={{
            fontSize: initialSize,
            fontWeight: 700,
            color: PRIMARY,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {firstInitial(name)}
        </Box>
      )}
    </Box>
  );
};
