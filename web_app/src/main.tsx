import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline, ThemeProvider, Box, CircularProgress } from '@mui/material';

import { buildFlutterTheme } from './theme';
import { AppThemeProvider, useAppTheme } from './contexts/app-theme.context';
import { AuthProvider, useAuth } from './contexts/auth.context';
import { MeProvider } from './contexts/me.context';
import { SnackbarProvider } from './contexts/snackbar.context';

import { MobileFrame } from './components/layout/mobile-frame';
import { BottomNav } from './components/layout/bottom-nav';
import { ConnectivityBanner } from './components/layout/connectivity-banner';
import { NavBadgesProvider, useNavBadgeCounts } from './contexts/nav-badges.context';

import { SplashScreen } from './screens/splash-screen';
import { OnboardingScreen } from './screens/onboarding-screen';
import { LoginScreen } from './screens/login-screen';
import { SignupScreen } from './screens/signup-screen';
import { FeedScreen } from './screens/feed-screen';
import { FavoritesScreen } from './screens/favorites-screen';
import { ChatsScreen } from './screens/chats-screen';
import { ProfileScreen } from './screens/profile-screen';
import { ViewProfileScreen } from './screens/view-profile-screen';
import { CreatePostScreen } from './screens/create-post-screen';
import { NearbyScreen } from './screens/nearby-screen';
import { GroupJoinScreen } from './screens/group-join-screen';
import { EditProfileScreen } from './screens/edit-profile-screen';
import { ChatScreen } from './components/chat/chat-screen';
import { RoomChatScreen } from './components/chat/room-chat-screen';

const ThemedApp = () => {
  const { mode } = useAppTheme();
  const theme = React.useMemo(() => buildFlutterTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
};

const LoadingBody = () => (
  <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <CircularProgress sx={{ color: '#026AFD' }} />
  </Box>
);

const TAB_PATHS = ['/', '/feed', '/favorites', '/chats', '/profile', '/nearby'];

const AppRoutes = () => {
  const { token, isLoading } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const badges = useNavBadgeCounts();

  const shell = (children: React.ReactNode, withNav = false) => (
    <MobileFrame>
      <ConnectivityBanner />
      {withNav ? <BottomNav chatsCount={badges.chatsCount} /> : null}
      {children}
    </MobileFrame>
  );

  const preAuth =
    path === '/splash' || path === '/onboarding' || path === '/login' || path === '/signup';

  if (preAuth) {
    if (path === '/splash') return shell(<SplashScreen />);
    if (path === '/onboarding') return shell(<OnboardingScreen />);
    if (path === '/login') return shell(<LoginScreen />);
    return shell(<SignupScreen />);
  }

  if (isLoading) return shell(<LoadingBody />);

  if (!token) {
    const hasSeenOnboarding = localStorage.getItem('has_seen_onboarding');
    return <Navigate to={hasSeenOnboarding ? '/login' : '/onboarding'} replace />;
  }

  const isTabRoute = TAB_PATHS.includes(path);

  const content = (
    <Routes>
      <Route path="/feed" element={<FeedScreen />} />
      <Route path="/favorites" element={<FavoritesScreen />} />
      <Route path="/chats" element={<ChatsScreen />} />
      <Route path="/chat/:chatId" element={<ChatScreen />} />
      <Route path="/room/:roomId" element={<RoomChatScreen />} />
      <Route path="/profile" element={<ProfileScreen />} />
      <Route path="/edit-profile" element={<EditProfileScreen />} />
      <Route path="/view-profile/:userId" element={<ViewProfileScreen />} />
      <Route path="/view-profile" element={<ViewProfileScreen />} />
      <Route path="/user/:userId" element={<ViewProfileScreen />} />
      <Route path="/create-post" element={<CreatePostScreen />} />
      <Route path="/nearby" element={<NearbyScreen />} />
      <Route path="/join-group/:code" element={<GroupJoinScreen />} />
      <Route path="/" element={<FeedScreen />} />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );

  return shell(content, isTabRoute);
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <SnackbarProvider>
        <AuthProvider>
          <MeProvider>
            <NavBadgesProvider>
              <ThemedApp />
            </NavBadgesProvider>
          </MeProvider>
        </AuthProvider>
      </SnackbarProvider>
    </AppThemeProvider>
  </React.StrictMode>
);

export { AppRoutes, ThemedApp };
