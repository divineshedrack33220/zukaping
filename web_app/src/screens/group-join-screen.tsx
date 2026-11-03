import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Card, CardContent, CircularProgress, IconButton, Typography } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import StarsIcon from '@mui/icons-material/Stars';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import { useAuth } from '../contexts/auth.context';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { FlutterAppBar } from '../components/layout/flutter-app-bar';
import { AppLogo } from '../components/common/app-logo';
import { PRIMARY } from '../styles/tokens';

export const GroupJoinScreen: React.FC = () => {
  const navigate = useNavigate();
  const { code: routeCode } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const c = usePalette();
  const { showToast } = useSnackbar();

  const inviteCode = routeCode || searchParams.get('code') || searchParams.get('inviteCode') || '';
  const isLoggedIn = Boolean(token);

  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [groupName, setGroupName] = useState('Group Chat');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [groupDescription, setGroupDescription] = useState('No description provided.');
  const [memberCount, setMemberCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await apiService.getGroupInfoByInviteCode(inviteCode);
        if ((data as any)?.error) throw new Error((data as any).error);
        if (cancelled) return;
        setGroupInfo(data);
        setGroupName((data as any)?.groupName || (data as any)?.name || 'Group Chat');
        setGroupAvatar((data as any)?.groupAvatar || (data as any)?.avatar || null);
        setGroupDescription((data as any)?.groupDescription || (data as any)?.description || 'No description provided.');
        setMemberCount(Number((data as any)?.memberCount ?? (data as any)?.participants?.length ?? 0));
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(
          err?.response?.data?.error || err?.response?.data?.message || err?.message || 'This invite code is expired or invalid. Please check the URL and try again.'
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!inviteCode) return;
    setIsJoining(true);
    try {
      const res = await apiService.joinGroupByInviteCode(inviteCode);
      const chatId = (res as any)?.chatId || res?.id;
      if (!chatId) throw new Error('Failed to retrieve chat session');
      showToast('Successfully joined group chat!');
      navigate(`/chat/${chatId}`, { replace: true });
    } catch (err: any) {
      showToast(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to join group.');
      setIsJoining(false);
    }
  };

  const renderLoading = () => (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: PRIMARY }} />
    </Box>
  );

  const renderError = () => (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '24px' }}>
      <Box sx={{ width: '100%', maxWidth: 450, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <ErrorOutlineRoundedIcon sx={{ fontSize: 64, color: '#FF5252', mb: '16px' }} />
        <Box sx={{ fontSize: 20, fontWeight: 700, mb: '8px' }}>Invalid Invite Link</Box>
        <Box sx={{ fontSize: 14, color: 'textSecondary', mb: '24px' }}>
          {errorMessage || 'This invite code is expired or invalid. Please check the URL and try again.'}
        </Box>
        <Button
          variant="contained"
          onClick={() => navigate('/feed')}
          sx={{ height: 56, borderRadius: '16px', px: '32px', fontSize: 14, fontWeight: 500, bgcolor: PRIMARY, color: '#FFFFFF' }}
        >
          Back to Home
        </Button>
      </Box>
    </Box>
  );

  const renderDetails = () => (
    <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 450,
          p: '24px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '100%',
            p: '32px',
            borderRadius: '28px',
            bgcolor: c.card,
            border: `1px solid ${c.border}`,
            boxShadow: c.isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          {/* Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              px: '16px',
              py: '6px',
              borderRadius: '20px',
              background: 'rgba(2,106,253,0.1)',
            }}
          >
            <StarsIcon sx={{ fontSize: 16, color: PRIMARY }} />
            <Box sx={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>You are Invited!</Box>
          </Box>
          <Box sx={{ height: '24px' }} />
          {/* Group avatar */}
          <Box
            sx={{
              width: 108,
              height: 108,
              borderRadius: '50%',
              mx: 'auto',
              mb: '20px',
              overflow: 'hidden',
              bgcolor: '#EEEEEE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {groupAvatar ? (
              <Box
                component="img"
                src={groupAvatar}
                alt={groupName}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ width: '100%', height: '100%', bgcolor: 'rgba(2,106,253,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ fontSize: 36, fontWeight: 700, color: PRIMARY }}>{groupName ? groupName[0].toUpperCase() : 'G'}</Box>
                </Box>
              </Box>
            )}
          </Box>
          <Box sx={{ height: '20px' }} />
          {/* Group name */}
          <Box sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5', mb: '8px', color: 'text.primary' }}>{groupName}</Box>
          <Box sx={{ height: '8px' }} />
          {/* Member count */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', mb: '20px' }}>
            <PeopleAltRoundedIcon sx={{ fontSize: 16, color: 'textSecondary' }} />
            <Box sx={{ fontSize: 14, fontWeight: 600, color: 'textSecondary' }}>{memberCount} members</Box>
          </Box>
          <Box sx={{ width: '60px', height: 3, borderRadius: '1.5px', background: 'rgba(2,106,253,0.3)', mx: 'auto', mb: '20px' }} />
          <Box sx={{ fontSize: 15, lineHeight: '1.4', color: 'textSecondary', mb: '32px', textAlign: 'center' }}>{groupDescription}</Box>
          <Box sx={{ height: '32px' }} />
          {isLoggedIn ? (
            <Box sx={{ width: '100%', height: 54 }}>
              <Button
                fullWidth
                variant="contained"
                disabled={isJoining}
                onClick={() => void handleJoin()}
                sx={{ width: '100%', height: 54, borderRadius: '16px', fontSize: 16, fontWeight: 700, bgcolor: PRIMARY, color: '#FFFFFF', boxShadow: '0 4px 14px rgba(2,106,253,0.3)' }}
              >
                {isJoining ? <CircularProgress size={36} sx={{ color: '#FFFFFF' }} /> : 'Accept Invitation'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ width: '100%' }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => navigate(`/signup?code=${encodeURIComponent(inviteCode)}`)}
                sx={{ width: '100%', height: 54, borderRadius: '16px', fontSize: 16, fontWeight: 700, bgcolor: PRIMARY, color: '#FFFFFF', boxShadow: '0 4px 14px rgba(2,106,253,0.3)' }}
              >
                Sign Up & Join Group
              </Button>
              <Box sx={{ height: '12px' }} />
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(`/login?code=${encodeURIComponent(inviteCode)}`)}
                sx={{ width: '100%', height: 52, borderRadius: '16px', border: `1.5px solid ${PRIMARY}`, fontSize: 15, fontWeight: 700, color: PRIMARY, bgcolor: 'background.paper' }}
              >
                Log In & Join
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ height: 'var(--app-h, 100dvh)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FlutterAppBar showBack title="Group Invitation" />
      {isLoading ? (
        renderLoading()
      ) : errorMessage ? (
        renderError()
      ) : (
        renderDetails()
      )}
    </Box>
  );
};
