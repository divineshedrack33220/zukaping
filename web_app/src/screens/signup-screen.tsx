import { useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AddAPhotoRoundedIcon from '@mui/icons-material/AddAPhotoRounded';
import PersonIcon from '@mui/icons-material/Person';
import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';
import CheckIcon from '@mui/icons-material/Check';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { useAuth } from '../contexts/auth.context';
import { useMe } from '../contexts/me.context';
import { useImageSourceSheet } from '../components/common/image-source-sheet';
import { apiService } from '../services/api.service';
import { wsService } from '../services/ws.service';
import { FlutterInput } from '../components/common/flutter-input';
import { FlutterSheet } from '../components/common/flutter-sheet';
import { passwordProblem, signupErrorMessage } from '../utils/password';
import { requestGoogleCredential } from '../utils/google-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const INTEREST_OPTIONS = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'everyone', label: 'Everyone' },
];

const STEP_TITLES = ['', '', '', '', '', '', '', ''];

/**
 * `SignupScreen` — 8-page wizard (mobile_app/lib/screens/signup_screen.dart).
 * Page order: email/password → avatar → name/dob → gender → location →
 * photos → bio → status.
 */
export const SignupScreen = () => {
  const c = usePalette();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useSnackbar();
  const { login } = useAuth();
  const { refresh } = useMe();

  const inviteCode = new URLSearchParams(location.search).get('code') ?? '';

  const [page, setPage] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('male');
  const [interestedIn, setInterestedIn] = useState('men');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('available');
  const [busy, setBusy] = useState(false);
  const [slotUploading, setSlotUploading] = useState<number | null>(null);
  const [googleSheet, setGoogleSheet] = useState<string | null>(null);

  const photoSlot = useRef(0);
  const { requestImage, sheet } = useImageSourceSheet();

  const inputFill = c.isDark ? '#2C2C2E' : '#F5F5F5';
  const inputBorder = c.isDark ? '#3A3A3C' : '#E0E0E0';

  const go = (next: number) => {
    if (next < 0) {
      navigate(-1);
      return;
    }
    setPage(Math.max(0, Math.min(7, next)));
  };

  const upload = async (file: File): Promise<string | null> => {
    try {
      const url = await apiService.uploadImage(file);
      return url;
    } catch {
      return null;
    }
  };

  const selectAvatar = async (file: File) => {
    if (!token) {
      showToast('Please sign up first');
      return;
    }
    setBusy(true);
    showToast('Photo uploaded');
    const url = await upload(file);
    if (url) setAvatar(url);
    else showToast('Failed to upload photo');
    setBusy(false);
  };

  const selectPhoto = async (file: File) => {
    const slot = photoSlot.current;
    if (!token) {
      showToast('Please sign up first');
      return;
    }
    setSlotUploading(slot);
    const url = await upload(file);
    if (url) {
      setPhotos((current) => current.map((item, index) => (index === slot ? url : item)));
      showToast('Photo uploaded');
    } else {
      showToast('Failed to upload photo');
    }
    setSlotUploading(null);
  };

  const signup = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      showToast('Please enter a valid email');
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      showToast(problem);
      return;
    }
    setBusy(true);
    try {
      const result = await apiService.signup({
        email: email.trim(),
        password,
        name: name.trim(),
        gender: 'other',
        interestedIn: ['everyone'],
        ...(inviteCode ? { inviteCode } : {}),
      } as any);
      setToken(result.token);
      localStorage.setItem('token', result.token);
      localStorage.setItem('userId', result.userId);
      login(result.token, result.userId);
      go(1);
    } catch (e: any) {
      showToast(signupErrorMessage(e?.response?.data));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    try {
      const credential = await requestGoogleCredential();
      const result = await apiService.googleAuth(credential);
      setToken(result.token);
      login(result.token, result.userId);
      if (result.isNewUser || result.hasCompletedOnboarding === false) {
        showToast('Google account linked successfully!');
        go(1);
      } else {
        showToast('Google account linked successfully!');
        wsService.connect(result.token);
        await refresh();
        navigate('/feed', { replace: true });
      }
    } catch (e: any) {
      setGoogleSheet(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      showToast('Location permission denied. Continue without location?');
      go(5);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        go(5);
      },
      () => {
        showToast('Location permission denied. Continue without location?');
        go(5);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async () => {
    if (!token) {
      showToast('Session expired. Please sign up again.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        birthDate: birthDate ? Math.floor(new Date(`${birthDate}T00:00:00`).getTime() / 1000) : null,
        gender,
        interestedIn: interestedIn === 'everyone' ? ['men', 'women'] : [interestedIn],
        bio: bio.trim(),
        status,
        photos: photos.filter(Boolean),
      };
      if (avatar) payload.avatar = avatar;
      if (coords) {
        payload.latitude = coords.lat;
        payload.longitude = coords.lng;
      }
      await apiService.updateProfile(payload);
      showToast('Welcome to Zukaping!');
      wsService.connect(token);
      await refresh();
      navigate('/feed', { replace: true });
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed to save profile');
    } finally {
      setBusy(false);
    }
  };

  const primaryButton = (label: string, onClick: () => void, disabled = false) => (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => !disabled && onClick()}
      sx={{
        width: '100%',
        height: 52,
        borderRadius: '26px',
        bgcolor: disabled ? 'rgba(2,106,253,0.30)' : '#026AFD',
        color: disabled ? (c.isDark ? 'rgba(255,255,255,0.54)' : 'rgba(0,0,0,0.45)') : '#FFFFFF',
        display: 'grid',
        placeItems: 'center',
        fontSize: 17,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >
      {busy && label !== 'Next' ? (
        <CircularProgress size={24} thickness={5} sx={{ color: '#FFFFFF' }} />
      ) : (
        label
      )}
    </Box>
  );

  const selector = (
    value: string,
    label: string,
    selected: boolean,
    onClick: () => void,
    weight = 700
  ) => (
    <Box
      key={value}
      role="button"
      onClick={onClick}
      sx={{
        flex: 1,
        height: 52,
        borderRadius: '26px',
        border: `1px solid ${selected ? '#026AFD' : c.isDark ? '#3A3A3C' : '#E0E0E0'}`,
        bgcolor: selected ? '#026AFD' : c.isDark ? '#2C2C2E' : '#F5F5F5',
        color: selected ? '#FFFFFF' : c.text,
        display: 'grid',
        placeItems: 'center',
        fontSize: 14,
        fontWeight: weight,
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: 'center',
      }}
    >
      {label}
    </Box>
  );

  const heading = (text: string) => (
    <Box
      component="h2"
      sx={{ m: 0, fontSize: 24, fontWeight: 600, color: c.text, textAlign: 'center', width: '100%' }}
    >
      {text}
    </Box>
  );

  const renderPage = () => {
    switch (page) {
      case 0:
        return (
          <>
            <Box sx={{ height: 40 }} />
            <FlutterInput
              value={email}
              onChange={setEmail}
              hint="Email address"
              type="email"
              fill={inputFill}
              border={inputBorder}
              paddingY={16}
            />
            <Box sx={{ height: 16 }} />
            <FlutterInput
              value={password}
              onChange={setPassword}
              hint="Password"
              type={obscure ? 'password' : 'text'}
              fill={inputFill}
              border={inputBorder}
              paddingY={16}
              suffix={
                <Box
                  role="button"
                  onClick={() => setObscure((value) => !value)}
                  sx={{ display: 'flex', cursor: 'pointer', color: '#BDBDBD' }}
                >
                  {obscure ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </Box>
              }
            />
            <Box sx={{ height: 24 }} />
            {primaryButton('Sign Up', () => void signup())}
            <Box sx={{ height: 16 }} />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: inputBorder }} />
              <Box sx={{ px: '16px', fontSize: 14, color: c.isDark ? '#9E9E9E' : '#757575' }}>or</Box>
              <Box sx={{ flex: 1, height: '1px', bgcolor: inputBorder }} />
            </Box>
            <Box sx={{ height: 16 }} />
            <Box
              role="button"
              onClick={() => !busy && void googleSignIn()}
              sx={{
                width: '100%',
                height: 52,
                borderRadius: '26px',
                border: `1px solid ${c.isDark ? '#3A3A3C' : '#E0E0E0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: 'pointer',
              }}
            >
              <Box
                component="img"
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png"
                alt=""
                sx={{ width: 20, height: 20 }}
              />
              <Box component="span" sx={{ fontSize: 17, fontWeight: 600 }}>
                Continue with Google
              </Box>
            </Box>
            <Box sx={{ height: 24 }} />
            <Box sx={{ textAlign: 'center', fontSize: 14, color: c.isDark ? '#BDBDBD' : '#757575' }}>
              Already have an account?{' '}
              <Box
                component="span"
                onClick={() => navigate('/login')}
                sx={{ color: '#026AFD', fontWeight: 600, cursor: 'pointer' }}
              >
                Log in
              </Box>
            </Box>
          </>
        );

      case 1:
        return (
          <>
            <Box sx={{ height: 40 }} />
            {heading('Upload a Profile Picture')}
            <Box sx={{ height: 12 }} />
            <Box sx={{ fontSize: 15, color: c.isDark ? '#BDBDBD' : '#9E9E9E', textAlign: 'center' }}>
              Choose a clear photo of yourself. A profile picture is mandatory to help keep the
              community authentic and safe.
            </Box>
            <Box sx={{ height: 50 }} />
            <Box
              onClick={() =>
                requestImage({
                  title: 'Choose a profile photo',
                  onPick: ([file]) => void selectAvatar(file),
                })
              }
              sx={{ position: 'relative', cursor: 'pointer' }}
            >
              <Box
                sx={{
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  bgcolor: c.isDark ? '#1E1E1E' : '#F5F5F5',
                  border: `4px solid ${avatar ? '#026AFD' : inputBorder}`,
                  boxShadow: c.isDark
                    ? '0 0 15px 2px rgba(0,0,0,0.30)'
                    : '0 0 15px 2px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {busy && !slotUploading ? (
                  <CircularProgress size={32} sx={{ color: '#026AFD' }} />
                ) : avatar ? (
                  <Box
                    component="img"
                    src={avatar}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <AddAPhotoRoundedIcon sx={{ fontSize: 40, color: '#026AFD' }} />
                    <Box sx={{ height: 8 }} />
                    <Box sx={{ fontSize: 14, fontWeight: 600, color: '#8E8E8E' }}>Upload</Box>
                  </Box>
                )}
              </Box>
              {avatar && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 4,
                    bottom: 4,
                    p: '6px',
                    borderRadius: '50%',
                    bgcolor: '#026AFD',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <CheckIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
                </Box>
              )}
            </Box>
            <Box sx={{ height: 60 }} />
            {primaryButton('Next Step', () => go(2), !avatar)}
          </>
        );

      case 2:
        return (
          <>
            <Box sx={{ height: 40 }} />
            {heading('What should we call you?')}
            <Box sx={{ height: 40 }} />
            <FlutterInput
              value={name}
              onChange={setName}
              hint="Full name"
              fill={inputFill}
              border={inputBorder}
              paddingY={16}
            />
            <Box sx={{ height: 16 }} />
            <FlutterInput
              value={birthDate}
              onChange={setBirthDate}
              hint="Birth date (YYYY-MM-DD)"
              type="date"
              fill={inputFill}
              border={inputBorder}
              paddingY={16}
              suffix={<CalendarTodayIcon sx={{ fontSize: 24, color: '#026AFD' }} />}
            />
            <Box sx={{ height: 24 }} />
            {primaryButton('Next', () => go(3))}
          </>
        );

      case 3:
        return (
          <>
            <Box sx={{ height: 40 }} />
            {heading('Who are you?')}
            <Box sx={{ height: 24 }} />
            <Box sx={{ display: 'flex', gap: '12px', width: '100%' }}>
              {GENDER_OPTIONS.map((option) =>
                selector(option.value, option.label, gender === option.value, () => setGender(option.value))
              )}
            </Box>
            <Box sx={{ height: 40 }} />
            {heading('Who are you interested in?')}
            <Box sx={{ height: 24 }} />
            <Box sx={{ display: 'flex', gap: '12px', width: '100%' }}>
              {INTEREST_OPTIONS.map((option) =>
                selector(
                  option.value,
                  option.label,
                  interestedIn === option.value,
                  () => setInterestedIn(option.value)
                )
              )}
            </Box>
            <Box sx={{ height: 40 }} />
            {primaryButton('Next', () => go(4))}
          </>
        );

      case 4:
        return (
          <>
            <Box sx={{ height: 100 }} />
            <Box sx={{ textAlign: 'center', width: '100%' }}>{heading('Enable Location')}</Box>
            <Box sx={{ height: 8 }} />
            <Box
              sx={{
                fontSize: 14,
                textAlign: 'center',
                color: c.isDark ? '#BDBDBD' : '#666666',
              }}
            >
              We use your location to show nearby people
            </Box>
            <Box sx={{ height: 40 }} />
            {primaryButton('Allow location', requestLocation)}
            <Box sx={{ height: 16 }} />
            <Box
              role="button"
              onClick={() => go(5)}
              sx={{
                width: '100%',
                height: 52,
                borderRadius: '26px',
                border: `1px solid ${c.isDark ? '#3A3A3C' : '#E0E0E0'}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 17,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Skip
            </Box>
          </>
        );

      case 5:
        return (
          <>
            <Box sx={{ height: 40 }} />
            {heading('Add photos')}
            <Box sx={{ height: 24 }} />
            <Box
              sx={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: '16px',
                  bgcolor: c.isDark ? '#1E1E1E' : '#F5F5F5',
                  border: '2px solid #026AFD',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {avatar ? (
                  <Box
                    component="img"
                    src={avatar}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }}
                  />
                ) : (
                  <PersonIcon sx={{ fontSize: 24, color: '#026AFD' }} />
                )}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    px: '6px',
                    py: '2px',
                    borderRadius: '8px',
                    bgcolor: '#026AFD',
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  Main
                </Box>
              </Box>
              {photos.map((photo, index) => (
                <Box
                  key={index}
                  onClick={() => {
                    photoSlot.current = index;
                    requestImage({
                      title: 'Choose a photo',
                      onPick: ([file]) => void selectPhoto(file),
                    });
                  }}
                  sx={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: '16px',
                    bgcolor: c.isDark ? '#2C2C2E' : '#F5F5F5',
                    border: `1px solid ${c.isDark ? '#3A3A3C' : '#E0E0E0'}`,
                    overflow: 'hidden',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {slotUploading === index ? (
                    <CircularProgress size={24} sx={{ color: '#026AFD' }} />
                  ) : photo ? (
                    <Box
                      component="img"
                      src={photo}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }}
                    />
                  ) : (
                    <AddAPhotoOutlinedIcon
                      sx={{ fontSize: 24, color: c.isDark ? '#BDBDBD' : '#8E8E8E' }}
                    />
                  )}
                </Box>
              ))}
            </Box>
            <Box sx={{ height: 24 }} />
            {primaryButton('Next', () => go(6))}
          </>
        );

      case 6:
        return (
          <>
            <Box sx={{ height: 40 }} />
            {heading('Your Bio')}
            <Box sx={{ height: 40 }} />
            <FlutterInput
              value={bio}
              onChange={setBio}
              hint="Describe yourself..."
              multiline
              rows={4}
              fill={inputFill}
              border={inputBorder}
              paddingY={16}
            />
            <Box sx={{ height: 24 }} />
            {primaryButton('Next', () => go(7))}
          </>
        );

      default:
        return (
          <>
            <Box sx={{ height: 100 }} />
            {heading('Ready to connect')}
            <Box sx={{ height: 40 }} />
            <Box sx={{ display: 'flex', gap: '12px', width: '100%' }}>
              {selector('available', 'Available', status === 'available', () => setStatus('available'), 600)}
              {selector('busy', 'Busy', status === 'busy', () => setStatus('busy'), 600)}
            </Box>
            <Box sx={{ height: 40 }} />
            {primaryButton('Go Live', () => void submit())}
          </>
        );
    }
  };

  return (
    <Box sx={{ flex: 1, minHeight: 'var(--app-h, 100dvh)', bgcolor: c.scaffold, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <Box
        sx={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          px: '4px',
          position: 'relative',
          bgcolor: c.appBar,
          color: c.text,
        }}
      >
        <Box
          role="button"
          aria-label="Back"
          onClick={() => go(page - 1)}
          sx={{
            width: 48,
            height: 48,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            color: c.text,
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            left: 56,
            right: 56,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {page > 0 && (
            <Box sx={{ display: 'flex' }}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    mx: '4px',
                    bgcolor: page >= index ? '#026AFD' : c.isDark ? '#2C2C2E' : '#DDDDDD',
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            transform: `translateX(-${page * 100}%)`,
            transition: 'transform 300ms ease-in-out',
          }}
        >
          {STEP_TITLES.map((_, index) => (
            <Box
              key={index}
              sx={{
                minWidth: '100%',
                width: '100%',
                p: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflowY: index === page ? 'auto' : 'hidden',
              }}
            >
              {renderPage()}
            </Box>
          ))}
        </Box>
      </Box>

      {sheet}

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
            <Box sx={{ fontSize: 20, fontWeight: 700 }}>Google Auth Failed</Box>
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
              onClick={() => setGoogleSheet(null)}
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
    </Box>
  );
};
