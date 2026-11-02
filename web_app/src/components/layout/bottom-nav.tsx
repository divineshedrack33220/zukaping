import { Box, Typography } from '@mui/material';
import {
  ChatBubble,
  ChatBubbleOutline,
  Explore,
  Favorite,
  FavoriteBorder,
  Person,
  PersonOutline,
  Add as AddIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePalette } from '../../contexts/app-theme.context';
import { useMe } from '../../contexts/me.context';
import { pickAvatar, firstInitial } from '../../utils/format';
import { PRIMARY } from '../../styles/tokens';

interface NavItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  /** `CustomBottomNavBar` count badge (favorites / chats). */
  badge?: number;
}

const NavItem = ({ label, active, onClick, icon, activeIcon, badge }: NavItemProps) => {
  const c = usePalette();
  const color = active ? PRIMARY : c.isDark ? '#BDBDBD' : '#666666';
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        cursor: 'pointer',
        color,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Box sx={{ position: 'relative', display: 'flex', color }}>
        {active && activeIcon ? activeIcon : icon}
        {badge != null && badge > 0 && (
          <Box
            sx={{
              position: 'absolute',
              right: -6,
              top: -4,
              minWidth: 16,
              minHeight: 16,
              p: '4px',
              borderRadius: '50%',
              bgcolor: '#F44336',
              display: 'grid',
              placeItems: 'center',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {badge > 9 ? '9+' : badge}
          </Box>
        )}
      </Box>
      <Typography
        component="span"
        sx={{
          fontSize: 11,
          lineHeight: '13px',
          fontWeight: active ? 600 : 400,
          color,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

/**
 * `CustomBottomNavBar` from mobile_app/lib/widgets/custom_bottom_nav_bar.dart.
 * 60 px bar + safe-area, 56 px raised centre FAB (top: -24), no badges on feed.
 */
export const BottomNav = ({
  chatsCount,
}: {
  chatsCount?: number;
} = {}) => {
  const c = usePalette();
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useMe();

  const path = location.pathname;
  const isFeed = path === '/feed' || path === '/';
  const isFavorites = path.startsWith('/favorites');
  const isChats = path === '/chats';
  const isProfile = path.startsWith('/profile') || path.startsWith('/edit-profile');

  const avatar = pickAvatar(me?.avatar, me?.photos);
  const profileBorder = isProfile ? PRIMARY : c.isDark ? '#3A3A3C' : '#E0E0E0';

  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        height: 'calc(60px + env(safe-area-inset-bottom))',
        pb: 'env(safe-area-inset-bottom)',
        bgcolor: c.nav,
        borderTop: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 1100,
      }}
    >
      <NavItem
        label="Live"
        active={isFeed}
        onClick={() => navigate('/feed', { replace: true })}
        icon={<Explore sx={{ fontSize: 26 }} />}
        activeIcon={<Explore sx={{ fontSize: 26 }} />}
      />
      <NavItem
        label="Favorites"
        active={isFavorites}
        onClick={() => navigate('/favorites', { replace: true })}
        icon={<FavoriteBorder sx={{ fontSize: 26 }} />}
        activeIcon={<Favorite sx={{ fontSize: 26 }} />}
      />

      {/* Centre spacer + raised create button */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Box
          role="button"
          aria-label="Create post"
          tabIndex={0}
          onClick={() => navigate('/create-post')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') navigate('/create-post');
          }}
          sx={{
            position: 'absolute',
            top: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: PRIMARY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(2,106,253,0.3)',
          }}
        >
          <AddIcon sx={{ fontSize: 32, color: '#FFFFFF' }} />
        </Box>
      </Box>

      <NavItem
        label="Chats"
        active={isChats}
        onClick={() => navigate('/chats', { replace: true })}
        icon={<ChatBubbleOutline sx={{ fontSize: 26 }} />}
        activeIcon={<ChatBubble sx={{ fontSize: 26 }} />}
        badge={chatsCount}
      />

      <Box
        role="button"
        tabIndex={0}
        onClick={() => navigate('/profile', { replace: true })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') navigate('/profile', { replace: true });
        }}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          cursor: 'pointer',
          color: isProfile ? PRIMARY : c.isDark ? '#BDBDBD' : '#666666',
          userSelect: 'none',
        }}
      >
        {avatar ? (
          <Box
            component="img"
            src={avatar}
            alt=""
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${profileBorder}`,
            }}
          />
        ) : me?.name ? (
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: 'rgba(2,106,253,0.15)',
              color: PRIMARY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              border: `2px solid ${profileBorder}`,
            }}
          >
            {firstInitial(me.name)}
          </Box>
        ) : isProfile ? (
          <Person sx={{ fontSize: 26 }} />
        ) : (
          <PersonOutline sx={{ fontSize: 26 }} />
        )}
        <Typography
          component="span"
          sx={{
            fontSize: 11,
            lineHeight: '13px',
            fontWeight: isProfile ? 600 : 400,
            color: 'inherit',
          }}
        >
          Profile
        </Typography>
      </Box>
    </Box>
  );
};
