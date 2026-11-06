import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { useAuth } from '../contexts/auth.context';
import { useMe } from '../contexts/me.context';
import { apiService } from '../services/api.service';
import { wsService } from '../services/ws.service';
import { FlutterInput } from '../components/common/flutter-input';
import { FlutterSheet } from '../components/common/flutter-sheet';
import { GoogleMark } from '../components/common/google-mark';
import { requestGoogleCredential } from '../utils/google-auth';
import { passwordProblem } from '../utils/password';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `LoginScreen` (mobile_app/lib/screens/login_screen.dart):
 * logo 100, 80 gap, two filled fields, 52 px Continue, `or` divider,
 * Google button and sign-up row.
 */
export const LoginScreen = () => {
  const c = usePalette();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useSnackbar();
  const { login } = useAuth();
  const { refresh } = useMe();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleSheet, setGoogleSheet] = useState<string | null>(null);
  const [reset, setReset] = useState<{ step: 'email' | 'code'; sentTo: string } | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetObscure, setResetObscure] = useState(true);
  const [resetError, setResetError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  const inviteCode = new URLSearchParams(location.search).get('code') ?? '';
  const enabled = email.trim().length > 0 && password.length > 0 && EMAIL_RE.test(email.trim());

  const finish = async (token: string, userId: string) => {
    login(token, userId);
    if (inviteCode) {
      try {
        await apiService.joinGroupByInviteCode(inviteCode);
      } catch {
        /* auto join failure is ignored, as in Flutter */
      }
    }
    wsService.connect(token);
    await refresh();
    showToast('Login successful!');
    navigate('/feed', { replace: true });
  };

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiService.login(email.trim(), password);
      await finish(response.token, response.userId);
    } catch (e: any) {
      const message =
        e?.response?.data?.error ??
        e?.response?.data?.message ??
        (e?.response ? 'Invalid email or password' : 'Cannot connect to server. Please check your connection.');
      setError(String(message));
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setGoogleSheet(null);
    setLoading(true);
    setError('');
    try {
      let result: any;
      try {
        result = await apiService.login('demo@zukaping.com', 'DemoPassw0rd!');
      } catch {
        result = { error: true };
      }
      if (result?.error === true || !result?.token) {
        try {
          await apiService.signup({
            email: 'demo@zukaping.com',
            password: 'DemoPassw0rd!',
            name: 'Demo User',
            gender: 'other',
            interestedIn: ['everyone'],
          });
          result = await apiService.login('demo@zukaping.com', 'DemoPassw0rd!');
        } catch {
          /* fall through */
        }
      }
      if (result?.error === true || !result?.token) {
        throw new Error(result?.message ?? 'Failed to authenticate Demo Account');
      }
      showToast('Logged in with Demo Account!');
      await finish(result.token, result.userId);
    } catch (e: any) {
      setError(`Demo login failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const credential = await requestGoogleCredential();
      const response = await apiService.googleAuth(credential);
      await finish(response.token, response.userId);
    } catch (e: any) {
      setGoogleSheet(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const serverMessage = (e: any, fallback: string) =>
    String(
      e?.response?.data?.message ??
        e?.response?.data?.error ??
        (e?.response ? fallback : 'Cannot connect to server. Please check your connection.')
    );

  const sendResetCode = async () => {
    if (!EMAIL_RE.test(resetEmail.trim())) {
      setResetError('Please enter a valid email address');
      return;
    }
    setResetBusy(true);
    setResetError('');
    try {
      await apiService.requestResetCode(resetEmail.trim());
      setReset({ step: 'code', sentTo: resetEmail.trim() });
      setResetCode('');
    } catch (e: any) {
      setResetError(serverMessage(e, 'Could not send the code. Please try again.'));
    } finally {
      setResetBusy(false);
    }
  };

  const applyReset = async () => {
    if (!/^\d{6}$/.test(resetCode)) {
      setResetError('Enter the 6-digit code from your email');
      return;
    }
    const problem = passwordProblem(resetNewPassword);
    if (problem) {
      setResetError(problem);
      return;
    }
    setResetBusy(true);
    setResetError('');
    try {
      const response = await apiService.resetPasswordWithCode({
        email: reset?.sentTo ?? resetEmail.trim(),
        code: resetCode,
        password: resetNewPassword,
      });
      setReset(null);
      setResetNewPassword('');
      setResetCode('');
      showToast('Password updated!');
      await finish(response.token, response.userId);
    } catch (e: any) {
      setResetError(serverMessage(e, 'That code is invalid or has expired.'));
    } finally {
      setResetBusy(false);
    }
  };

  const openResetFlow = () => {
    setResetError('');
    setResetEmail(email);
    setReset({ step: 'email', sentTo: '' });
  };

  const resetButton = (label: string, onClick: () => void, disabled = false) => (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => !disabled && onClick()}
      sx={{
        width: '100%',
        height: 52,
        borderRadius: '26px',
        bgcolor: disabled ? 'rgba(2,106,253,0.30)' : '#026AFD',
        color: '#FFFFFF',
        display: 'grid',
        placeItems: 'center',
        fontSize: 17,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >
      {disabled ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} thickness={5} /> : label}
    </Box>
  );

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 'var(--app-h, 100dvh)',
        bgcolor: c.scaffold,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        px: '24px',
        py: '40px',
        overflowY: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Zukaping"
          sx={{ width: 100, height: 100, objectFit: 'contain' }}
        />
      </Box>

      <Box sx={{ height: 80 }} />

      <FlutterInput
        value={email}
        onChange={setEmail}
        hint="Email address"
        type="email"
        fill={c.isDark ? '#1C1C1E' : '#F5F5F5'}
        border={c.isDark ? '#2C2C2E' : '#E0E0E0'}
        paddingY={16}
      />

      <Box sx={{ height: 16 }} />

      <FlutterInput
        value={password}
        onChange={setPassword}
        hint="Password"
        type={obscure ? 'password' : 'text'}
        fill={c.isDark ? '#1C1C1E' : '#F5F5F5'}
        border={c.isDark ? '#2C2C2E' : '#E0E0E0'}
        paddingY={16}
        suffix={
          <Box
            role="button"
            tabIndex={0}
            aria-label="Toggle password visibility"
            onClick={() => setObscure((value) => !value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setObscure((value) => !value);
              }
            }}
            /* the eye glyph is 24 px; padding + equal negative margin makes it a 40 px target without moving it */
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#9E9E9E', p: '8px', m: '-8px' }}
          >
            {obscure ? <VisibilityOffIcon sx={{ fontSize: 24 }} /> : <VisibilityIcon sx={{ fontSize: 24 }} />}
          </Box>
        }
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: '10px' }}>
        <Box
          role="button"
          tabIndex={0}
          onClick={openResetFlow}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openResetFlow();
            }
          }}
          /* py/my pair the 21 px line into a 43 px touch target without changing the gap above the button */
          sx={{ fontSize: 14, fontWeight: 600, color: '#026AFD', cursor: 'pointer', py: '11px', my: '-11px' }}
        >
          Forgot password?
        </Box>
      </Box>

      {error && (
        <Box sx={{ mt: '8px', color: '#FF453A', fontSize: 14, textAlign: 'center' }}>
          {error}
        </Box>
      )}

      <Box sx={{ height: 24 }} />

      <Box
        role="button"
        tabIndex={0}
        onClick={() => {
          if (enabled && !loading) void submit();
        }}
        sx={{
          width: '100%',
          height: 52,
          borderRadius: '26px',
          bgcolor: enabled && !loading ? '#026AFD' : c.isDark ? '#2C2C2E' : '#E0E0E0',
          color: enabled && !loading ? '#FFFFFF' : c.isDark ? '#757575' : '#9E9E9E',
          display: 'grid',
          placeItems: 'center',
          fontSize: 17,
          fontWeight: 600,
          cursor: enabled && !loading ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {loading ? <CircularProgress size={24} sx={{ color: '#FFFFFF' }} thickness={5} /> : 'Continue'}
      </Box>

      <Box sx={{ height: 16 }} />

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1, height: '1px', bgcolor: c.isDark ? '#2C2C2E' : '#E0E0E0' }} />
        <Box sx={{ px: '16px', fontSize: 14, color: c.isDark ? '#BDBDBD' : '#757575' }}>or</Box>
        <Box sx={{ flex: 1, height: '1px', bgcolor: c.isDark ? '#2C2C2E' : '#E0E0E0' }} />
      </Box>

      <Box sx={{ height: 16 }} />

      <Box
        role="button"
        tabIndex={0}
        aria-label="Continue with Google"
        onClick={() => !loading && void googleSignIn()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!loading) void googleSignIn();
          }
        }}
        sx={{
          width: '100%',
          height: 52,
          borderRadius: '26px',
          border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <GoogleMark />
        <Box component="span" sx={{ fontSize: 17, fontWeight: 600, color: c.text }}>
          Continue with Google
        </Box>
      </Box>

      <Box sx={{ height: 24 }} />

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: '4px', fontSize: 14, color: c.text }}>
        <Box component="span">Don&apos;t have an account?</Box>
        <Box
          component="span"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/signup')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate('/signup');
            }
          }}
          sx={{ color: '#026AFD', fontWeight: 600, cursor: 'pointer', py: '11px', my: '-11px' }}
        >
          Sign up
        </Box>
      </Box>

      <FlutterSheet open={googleSheet !== null} onClose={() => setGoogleSheet(null)} radius={24}>
        <Box sx={{ p: '28px', pb: '36px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                p: '10px',
                borderRadius: '50%',
                bgcolor: 'rgba(255,193,7,0.15)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <WarningAmberRoundedIcon sx={{ fontSize: 28, color: '#FF8F00' }} />
            </Box>
            <Box sx={{ width: 16 }} />
            <Box sx={{ fontSize: 20, fontWeight: 700, color: c.text }}>Google Auth Failed</Box>
          </Box>
          <Box sx={{ height: 16 }} />
          <Box sx={{ fontSize: 14, lineHeight: 1.5, color: c.isDark ? '#BDBDBD' : '#616161' }}>
            Google authentication failed or is not configured for this environment.
            {'\n\n'}
            Error: {googleSheet}
          </Box>
          <Box sx={{ height: 28 }} />
          <Box sx={{ display: 'flex', gap: '12px' }}>
            <Box
              role="button"
              onClick={() => setGoogleSheet(null)}
              sx={{
                flex: 1,
                py: '14px',
                borderRadius: '16px',
                border: `1px solid ${c.isDark ? '#2C2C2E' : '#E0E0E0'}`,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </Box>
            <Box
              role="button"
              onClick={() => void demoLogin()}
              sx={{
                flex: 1,
                py: '14px',
                borderRadius: '16px',
                bgcolor: '#026AFD',
                color: '#FFFFFF',
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Use Demo Account
            </Box>
          </Box>
        </Box>
      </FlutterSheet>
      <FlutterSheet open={reset !== null} onClose={() => setReset(null)} radius={24}>
        {reset && (
          <Box sx={{ p: '28px', pb: '36px' }}>
            <Box sx={{ fontSize: 20, fontWeight: 700, color: c.text }}>
              {reset.step === 'email' ? 'Reset your password' : 'Check your email'}
            </Box>
            <Box sx={{ height: 12 }} />
            <Box sx={{ fontSize: 14, lineHeight: 1.5, color: c.isDark ? '#BDBDBD' : '#616161' }}>
              {reset.step === 'email'
                ? "Enter the email on your account and we'll send you a code to choose a new password."
                : `We sent a 6-digit code to ${reset.sentTo}. It expires in 10 minutes and works once.`}
            </Box>

            <Box sx={{ height: 20 }} />

            {reset.step === 'email' ? (
              <>
                <FlutterInput
                  value={resetEmail}
                  onChange={setResetEmail}
                  hint="Email address"
                  type="email"
                  fill={c.isDark ? '#1C1C1E' : '#F5F5F5'}
                  border={c.isDark ? '#2C2C2E' : '#E0E0E0'}
                  paddingY={16}
                  autoFocus
                />
                <Box sx={{ height: 20 }} />
                {resetButton('Email me a code', () => void sendResetCode(), resetBusy)}
              </>
            ) : (
              <>
                <FlutterInput
                  value={resetCode}
                  onChange={(value) => setResetCode(value.replace(/\D/g, '').slice(0, 6))}
                  hint="6-digit code"
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  fontSize={20}
                  fontWeight={600}
                  fill={c.isDark ? '#1C1C1E' : '#F5F5F5'}
                  border={c.isDark ? '#2C2C2E' : '#E0E0E0'}
                  paddingY={16}
                  autoFocus
                />
                <Box sx={{ height: 16 }} />
                <FlutterInput
                  value={resetNewPassword}
                  onChange={setResetNewPassword}
                  hint="New password"
                  type={resetObscure ? 'password' : 'text'}
                  fill={c.isDark ? '#1C1C1E' : '#F5F5F5'}
                  border={c.isDark ? '#2C2C2E' : '#E0E0E0'}
                  paddingY={16}
                  suffix={
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-label="Toggle password visibility"
                      onClick={() => setResetObscure((value) => !value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setResetObscure((value) => !value);
                        }
                      }}
                      sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#9E9E9E', p: '8px', m: '-8px' }}
                    >
                      {resetObscure ? (
                        <VisibilityOffIcon sx={{ fontSize: 24 }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: 24 }} />
                      )}
                    </Box>
                  }
                />
                <Box sx={{ height: 20 }} />
                {resetButton('Set new password', () => void applyReset(), resetBusy)}
                <Box sx={{ height: 16 }} />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: 14,
                    color: c.isDark ? '#BDBDBD' : '#757575',
                  }}
                >
                  <Box component="span">Didn&apos;t get it?</Box>
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => !resetBusy && void sendResetCode()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (!resetBusy) void sendResetCode();
                      }
                    }}
                    sx={{ color: '#026AFD', fontWeight: 600, cursor: 'pointer', py: '11px', my: '-11px' }}
                  >
                    Send a new code
                  </Box>
                </Box>
              </>
            )}

            {resetError && (
              <Box sx={{ mt: '16px', color: '#FF453A', fontSize: 14, textAlign: 'center' }}>
                {resetError}
              </Box>
            )}
          </Box>
        )}
      </FlutterSheet>
    </Box>
  );
};
