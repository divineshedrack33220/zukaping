import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { FlutterAppBar } from '../components/layout/flutter-app-bar';
import { AppLogo } from '../components/common/app-logo';
import { UserAvatar } from '../components/common/user-avatar';
import { PRIMARY, NAV_CLEARANCE } from '../styles/tokens';
import { getCurrentPosition, wait } from '../utils/geo';
import type { NearbyUser } from '../models/chat.models';

export const NearbyScreen: React.FC = () => {
  const navigate = useNavigate();
  const c = usePalette();
  const { showToast } = useSnackbar();

  const [people, setPeople] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNearby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coords = await getCurrentPosition();
      const users = await apiService.getNearbyUsers(coords?.lat ?? 0, coords?.lng ?? 0);
      setPeople(Array.isArray(users) ? users : []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNearby();
  }, [loadNearby]);

  const openChat = async (userId: string) => {
    try {
      const chat = await apiService.createChat(userId);
      const chatId = chat?.id;
      if (chatId) navigate(`/chat/${chatId}`);
    } catch {
      showToast('Failed to start chat');
    }
  };

  const renderLoading = () => (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: PRIMARY }} />
    </Box>
  );

  const renderError = () => (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: '24px' }}>
      <Box sx={{ fontSize: 18, fontWeight: 600, color: '#9E9E9E' }}>Failed to load users</Box>
      <Box sx={{ height: 16 }} />
      <Button variant="contained" onClick={() => void loadNearby()} sx={{ height: 56, borderRadius: '26px', fontSize: 16, fontWeight: 600, bgcolor: PRIMARY, color: '#FFFFFF' }}>
        Retry
      </Button>
    </Box>
  );

  const renderEmpty = () => (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '24px' }}>
      <Box sx={{ fontSize: 18, fontWeight: 600, color: '#9E9E9E' }}>No users nearby</Box>
    </Box>
  );

  const renderRow = (user: NearbyUser) => (
    <ListItemButton
      key={user.id}
      onClick={() =>
        user.id &&
        navigate(`/view-profile/${user.id}`, {
          state: { user },
        })
      }
      sx={{ display: 'flex', alignItems: 'center', gap: '12px', py: '8px' }}
    >
      <ListItemIcon sx={{ minWidth: 56, justifyContent: 'center', pl: 0 }}>
        <Box sx={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          <UserAvatar name={user.name} avatar={user.avatar} photos={user.photos} size={56} />
        </Box>
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ fontSize: 16, fontWeight: 600, color: c.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.87)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </Box>
        }
        secondary={
          <Box sx={{ fontSize: 14, color: c.isDark ? '#BDBDBD' : '#757575' }}>{user.distance || 'Nearby'}</Box>
        }
      />
      <IconButton
        aria-label="Chat"
        onClick={(event) => {
          event.stopPropagation();
          void openChat(user.id);
        }}
        sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: PRIMARY, flexShrink: 0 }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
      </IconButton>
    </ListItemButton>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: 'var(--app-h, 100dvh)', overflow: 'hidden' }}>
      <FlutterAppBar
        leading={<AppLogo size={40} />}
        title={
          <Box sx={{ fontSize: 22, fontWeight: 600, color: c.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.87)' }}>Nearby Users</Box>
        }
        actions={
          <IconButton aria-label="Refresh" onClick={() => void loadNearby()}>
            <RefreshIcon sx={{ fontSize: 24, color: c.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.87)' }} />
          </IconButton>
        }
      />

      {loading ? (
        renderLoading()
      ) : error ? (
        renderError()
      ) : people.length === 0 ? (
        renderEmpty()
      ) : (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <Box sx={{ p: '16px', pb: NAV_CLEARANCE }}>
                  {people.map((user) => (
                <Box
                  key={user.id}
                  sx={{
                    bgcolor: c.isDark ? '#1C1C1E' : '#FAFAFA',
                    borderRadius: '16px',
                    border: `1px solid ${c.isDark ? '#2C2C2E' : '#EEEEEE'}`,
                    mb: '12px',
                    overflow: 'hidden',
                  }}
                >
                  {renderRow(user)}
                </Box>
              ))}
            </Box>
        </Box>
      )}
    </Box>
  );
};
