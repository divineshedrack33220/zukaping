import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import CloseIcon from '@mui/icons-material/Close';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import { usePalette } from '../contexts/app-theme.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { apiService } from '../services/api.service';
import { useImageSourceSheet } from '../components/common/image-source-sheet';
import { PRIMARY } from '../styles/tokens';

export const EditProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const c = usePalette();
  const { showToast } = useSnackbar();

  // form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [statusVal, setStatusVal] = useState<string | null>(null);

  // avatar
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newAvatarPreview, setNewAvatarPreview] = useState<string | null>(null);
  const { requestImage, sheet } = useImageSourceSheet();

  // photos (6 slots)
  const [photos, setPhotos] = useState<(string | null)[]>(Array(6).fill(null));
  const [newPhotoFiles, setNewPhotoFiles] = useState<(File | null)[]>(Array(6).fill(null));
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<(string | null)[]>(Array(6).fill(null));

  // ui state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const genderOptions = ['male', 'female', 'other'];
  const interestedInOptions = ['men', 'women', 'everyone'];
  const statusOptions = ['available', 'busy'];

  // ── load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getProfile();
        if (cancelled) return;
        setName(data.name ?? '');
        setUsername((data as any).username ?? '');
        setBio(data.bio ?? '');
        setGender((data as any).gender ?? null);
        setStatusVal((data as any).status ?? null);
        if (Array.isArray((data as any).interestedIn)) {
          setInterestedIn((data as any).interestedIn);
        }
        const av = (data.avatar ?? '').toString();
        if (av && !av.includes('Portrait_Placeholder')) setCurrentAvatar(av);
        const existingPhotos: (string | null)[] = Array(6).fill(null);
        let idx = 0;
        for (const p of ((data as any).photos ?? []) as string[]) {
          if (p && !p.includes('Portrait_Placeholder') && idx < 6) {
            existingPhotos[idx++] = p;
          }
        }
        setPhotos(existingPhotos);
      } catch {
        showToast('Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // ── avatar picker ─────────────────────────────────────────────────────────
  function pickAvatar() {
    requestImage({
      title: 'Change profile photo',
      onPick: ([f]) => {
        setNewAvatarFile(f);
        setNewAvatarPreview(URL.createObjectURL(f));
      },
    });
  }

  // ── photo slot picker ─────────────────────────────────────────────────────
  function pickPhoto(idx: number) {
    requestImage({
      title: 'Update photo',
      onPick: ([f]) => void applyPhotoFile(idx, f),
    });
  }

  async function applyPhotoFile(idx: number, f: File) {
    const preview = URL.createObjectURL(f);
    // try to upload immediately
    const url = await apiService.uploadImage(f);
    if (url) {
      setPhotos((prev) => {
        const n = [...prev];
        n[idx] = url;
        return n;
      });
      setNewPhotoFiles((prev) => {
        const n = [...prev];
        n[idx] = null;
        return n;
      });
      setNewPhotoPreviews((prev) => {
        const n = [...prev];
        n[idx] = null;
        return n;
      });
      showToast('Photo uploaded');
    } else {
      // store locally for save
      setNewPhotoFiles((prev) => {
        const n = [...prev];
        n[idx] = f;
        return n;
      });
      setNewPhotoPreviews((prev) => {
        const n = [...prev];
        n[idx] = preview;
        return n;
      });
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const n = [...prev];
      n[idx] = null;
      return n;
    });
    setNewPhotoFiles((prev) => {
      const n = [...prev];
      n[idx] = null;
      return n;
    });
    setNewPhotoPreviews((prev) => {
      const n = [...prev];
      n[idx] = null;
      return n;
    });
  }

  // ── toggle interested-in ──────────────────────────────────────────────────
  function toggleInterest(val: string) {
    setInterestedIn((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  }

  // ── save ──────────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Flutter shows inline field errors (`validator`), never a toast.
    let invalid = false;
    if (!name.trim()) {
      setNameError('Name is required');
      invalid = true;
    } else {
      setNameError(null);
    }
    if (!username.trim()) {
      setUsernameError('Username is required');
      invalid = true;
    } else {
      setUsernameError(null);
    }
    if (invalid) return;
    setSaving(true);
    try {
      // upload avatar
      let avatarUrl: string | null = currentAvatar;
      if (newAvatarFile) {
        avatarUrl = (await apiService.uploadImage(newAvatarFile)) ?? currentAvatar;
      }
      // upload pending photos
      const finalPhotos = [...photos];
      for (let i = 0; i < 6; i++) {
        if (newPhotoFiles[i]) {
          const url = await apiService.uploadImage(newPhotoFiles[i]!);
          if (url) finalPhotos[i] = url;
        }
      }
      await apiService.updateProfile({
        name: name.trim(),
        username: username.trim().replace('@', ''),
        bio: bio.trim(),
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
        ...(gender ? { gender } : {}),
        interestedIn,
        ...(statusVal ? { status: statusVal } : {}),
        photos: finalPhotos.filter(Boolean) as string[],
      });
      showToast('Profile updated successfully!');
      setTimeout(() => navigate('/profile'), 900);
    } catch {
      showToast('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  // ── derived avatar src (Flutter falls back to the first photo) ────────────
  const avatarSrc = newAvatarPreview || currentAvatar || photos.find(Boolean) || null;
  const avatarInitial = name.trim()[0]?.toUpperCase() ?? '?';

  const inputBg = c.isDark ? '#1C1C1E' : '#FAFAFA';
  const inputBorder = c.isDark ? '#2C2C2E' : '#E0E0E0';
  const labelColor = c.isDark ? '#BDBDBD' : '#666666';
  const fieldError = c.isDark ? '#F2B8B5' : '#B3261E';

  if (loading) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.scaffold }}>
        <CircularProgress size={40} sx={{ color: PRIMARY }} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: c.scaffold, overflow: 'hidden' }}>
      {/* ── Flutter AppBar ── */}
      <Box
        component="header"
        sx={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          px: '12px',
          bgcolor: c.isDark ? '#121212' : '#FFFFFF',
          flexShrink: 0,
        }}
      >
        <IconButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          sx={{ color: c.isDark ? '#FFFFFF' : '#000000' }}
        >
          <ArrowBackIcon sx={{ fontSize: 24 }} />
        </IconButton>
        <Typography
          sx={{
            flex: 1,
            textAlign: 'center',
            fontWeight: 600,
            fontSize: 18,
            color: c.isDark ? '#FFFFFF' : '#000000',
            mr: '40px', // balance back button
          }}
        >
          Edit Profile
        </Typography>
      </Box>

      {/* ── Form content ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box component="form" onSubmit={handleSave} sx={{ p: '24px 20px 40px' }}>
          {/* ── Avatar (circular with ring) ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: '32px' }}>
            <Box
              onClick={pickAvatar}
              sx={{ position: 'relative', cursor: 'pointer', width: 120, height: 120 }}
            >
              {/* ring */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: -3,
                  borderRadius: '50%',
                  border: `2px solid ${PRIMARY}`,
                  boxShadow: `0 0 0 4px rgba(2,106,253,0.1)`,
                }}
              />
              {/* circle avatar */}
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  bgcolor: avatarSrc ? 'transparent' : 'rgba(2,106,253,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {avatarSrc ? (
                  <Box
                    component="img"
                    src={avatarSrc}
                    alt="avatar"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Box component="span" sx={{ fontSize: 48, fontWeight: 700, color: PRIMARY }}>
                    {avatarInitial}
                  </Box>
                )}
              </Box>
              {/* camera badge */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: PRIMARY,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                }}
              >
                <AddAPhotoIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />
              </Box>
            </Box>
            <Button
              type="button"
              onClick={pickAvatar}
              sx={{
                mt: '16px',
                textTransform: 'none',
                color: PRIMARY,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Change Avatar
            </Button>
          </Box>

          {/* ── Name ── */}
          <Box sx={{ mb: 3 }}>
            <Box component="label" sx={{ display: 'block', fontSize: 14, fontWeight: 500, color: labelColor, mb: 1 }}>
              Name
            </Box>
            <Box
              component="input"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setName(e.target.value);
                setNameError(null);
              }}
              placeholder="Your name"
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              sx={{
                width: '100%',
                p: '12px 16px',
                fontSize: 15,
                borderRadius: '12px',
                outline: 'none',
                bgcolor: inputBg,
                color: c.text,
                border: `1px solid ${focusedField === 'name' ? PRIMARY : inputBorder}`,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.18s',
                '&::placeholder': { color: c.isDark ? '#757575' : '#9E9E9E' },
              }}
            />
            {nameError && (
              <Box sx={{ fontSize: 12, color: fieldError, mt: 0.5 }}>{nameError}</Box>
            )}
          </Box>

          {/* ── Username ── */}
          <Box sx={{ mb: 3 }}>
            <Box component="label" sx={{ display: 'block', fontSize: 14, fontWeight: 500, color: labelColor, mb: 1 }}>
              Username
            </Box>
            <Box
              component="input"
              type="text"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setUsername(e.target.value);
                setUsernameError(null);
              }}
              placeholder="@username"
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              sx={{
                width: '100%',
                p: '12px 16px',
                fontSize: 15,
                borderRadius: '12px',
                outline: 'none',
                bgcolor: inputBg,
                color: c.text,
                border: `1px solid ${focusedField === 'username' ? PRIMARY : inputBorder}`,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.18s',
                '&::placeholder': { color: c.isDark ? '#757575' : '#9E9E9E' },
              }}
            />
            {usernameError && (
              <Box sx={{ fontSize: 12, color: fieldError, mt: 0.5 }}>{usernameError}</Box>
            )}
          </Box>

          {/* ── Bio ── */}
          <Box sx={{ mb: 3 }}>
            <Box component="label" sx={{ display: 'block', fontSize: 14, fontWeight: 500, color: labelColor, mb: 1 }}>
              Bio
            </Box>
            <Box
              component="textarea"
              value={bio}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              maxLength={150}
              rows={4}
              onFocus={() => setFocusedField('bio')}
              onBlur={() => setFocusedField(null)}
              sx={{
                width: '100%',
                p: '12px 16px',
                fontSize: 15,
                borderRadius: '12px',
                outline: 'none',
                resize: 'none',
                bgcolor: inputBg,
                color: c.text,
                border: `1px solid ${focusedField === 'bio' ? PRIMARY : inputBorder}`,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.18s',
                '&::placeholder': { color: c.isDark ? '#757575' : '#9E9E9E' },
              }}
            />
            <Box component="span" sx={{ fontSize: 11, color: c.isDark ? '#757575' : '#9E9E9E', float: 'right', mt: 0.5 }}>
              {bio.length}/150
            </Box>
          </Box>

          {/* ── Gender ── */}
          <Box sx={{ mb: 3 }}>
            <Box component="label" sx={{ display: 'block', fontSize: 14, fontWeight: 500, color: labelColor, mb: 1.5 }}>
              Gender
            </Box>
            <Box sx={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {genderOptions.map((g) => {
                const selected = gender === g;
                return (
                  <Box
                    key={g}
                    component="label"
                    onClick={() => setGender(g)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: c.text,
                    }}
                  >
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: `2px solid ${selected ? PRIMARY : c.isDark ? '#48484A' : '#CCCCCC'}`,
                        bgcolor: selected ? PRIMARY : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      {selected && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FFFFFF' }} />
                      )}
                    </Box>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* ── Interested In ── */}
          <Box sx={{ mb: 3 }}>
            <Box component="label" sx={{ display: 'block', fontSize: 14, fontWeight: 500, color: labelColor, mb: 1.5 }}>
              Interested In
            </Box>
            <Box sx={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {interestedInOptions.map((opt) => {
                const checked = interestedIn.includes(opt);
                return (
                  <Box
                    key={opt}
                    component="label"
                    onClick={() => toggleInterest(opt)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: c.text,
                    }}
                  >
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '6px',
                        border: `2px solid ${checked ? PRIMARY : c.isDark ? '#48484A' : '#CCCCCC'}`,
                        bgcolor: checked ? PRIMARY : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      {checked && (
                        <Box component="span" sx={{ color: '#FFFFFF', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                          ✓
                        </Box>
                      )}
                    </Box>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* ── Additional Photos (rounded squares) ── */}
          <Box sx={{ mb: '32px' }}>
            <Box component="label" sx={{ display: 'block', fontSize: 14, fontWeight: 500, color: labelColor, mb: 0.5 }}>
              Additional Photos
            </Box>
            <Typography sx={{ fontSize: 12, color: c.isDark ? '#757575' : '#9E9E9E', mb: 1.5 }}>
              You can add or replace up to 6 photos.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {Array.from({ length: 6 }, (_, i) => {
                const photoSrc = newPhotoPreviews[i] || photos[i];
                const hasPhoto = Boolean(photoSrc);
                return (
                  <Box key={i} sx={{ position: 'relative', aspectRatio: '1 / 1' }}>
                    <Box
                      onClick={() => pickPhoto(i)}
                      sx={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '16px',
                        border: `1px solid ${hasPhoto ? PRIMARY : inputBorder}`,
                        bgcolor: inputBg,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {hasPhoto ? (
                        <Box
                          component="img"
                          src={photoSrc!}
                          alt=""
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <>
                          <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 32, color: '#BDBDBD' }} />
                          <Typography sx={{ fontSize: 12, color: '#9E9E9E' }}>
                            Add photo
                          </Typography>
                        </>
                      )}
                    </Box>

                    {hasPhoto && (
                      <Box
                        component="button"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(i);
                        }}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          bgcolor: 'rgba(255,255,255,0.9)',
                          border: '1px solid #E0E0E0',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          p: 0,
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 16, color: '#000000' }} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* ── Status ── */}
          <Box sx={{ mb: 4 }}>
            <Box component="label" sx={{ display: 'block', fontSize: 14, fontWeight: 500, color: labelColor, mb: '12px' }}>
              Status
            </Box>
            <Box
              component="select"
              value={statusVal ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusVal(e.target.value || null)}
              onFocus={() => setFocusedField('status')}
              onBlur={() => setFocusedField(null)}
              sx={{
                width: '100%',
                p: '12px 16px',
                fontSize: 15,
                borderRadius: '12px',
                outline: 'none',
                bgcolor: inputBg,
                color: c.text,
                border: `1px solid ${focusedField === 'status' ? PRIMARY : inputBorder}`,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'border-color 0.18s',
              }}
            >
              <option value="" style={{ background: inputBg, color: c.text }}>No status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s} style={{ background: inputBg, color: c.text }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Box>
          </Box>

          {/* ── Save Button ── */}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={saving}
            sx={{
              height: 56,
              borderRadius: '12px',
              bgcolor: PRIMARY,
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: PRIMARY },
            }}
          >
            {saving ? (
              <CircularProgress size={20} sx={{ color: '#FFFFFF' }} />
            ) : (
              'Save Changes'
            )}
          </Button>
        </Box>
      </Box>

      {sheet}
    </Box>
  );
};
