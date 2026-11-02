/** Formatting helpers copied from the Flutter screens. */

export const PLACEHOLDER_AVATAR = 'Portrait_Placeholder.png';

/** Flutter parses int seconds, numeric strings and ISO strings. */
export function parseTimestamp(value: unknown): number {
  if (value == null) return Date.now();
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return Date.now();
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

/** Feed / profile `_formatTime`. */
export function formatTime(value: unknown): string {
  const ts = parseTimestamp(value);
  const diff = Math.max(0, Date.now() - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Chat-list `_formatTimestamp`: Just now / 5m / 2h / 30/10. */
export function formatChatTimestamp(value: unknown): string {
  const ts = parseTimestamp(value);
  const diff = Math.max(0, Date.now() - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const date = new Date(ts);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

/** `_formatDistance` from feed / nearby screens. */
export function formatDistance(value: unknown): string {
  if (value == null || value === '') return 'Nearby';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    // Already-formatted strings (e.g. "1.2 km") pass through untouched.
    return String(value);
  }
  if (numeric < 1000) return `${Math.round(numeric)}m away`;
  return `${(numeric / 1000).toFixed(1)}km away`;
}

/** "Last seen …" label used on chat headers / profiles. */
export function formatLastSeen(value: unknown): string {
  if (value == null) return 'Offline';
  const ts = parseTimestamp(value);
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Online now';
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  return `Last seen ${Math.floor(hours / 24)}d ago`;
}

export function cleanAvatar(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(PLACEHOLDER_AVATAR)) return null;
  return trimmed;
}

/** Avatar priority: avatar → first photo → first post image → null. */
export function pickAvatar(
  avatar?: string | null,
  photos?: string[] | null,
  fallbackImages?: string[] | null
): string | null {
  const direct = cleanAvatar(avatar);
  if (direct) return direct;
  const fromPhotos = (photos ?? []).map(cleanAvatar).find(Boolean);
  if (fromPhotos) return fromPhotos;
  const fromImages = (fallbackImages ?? []).map(cleanAvatar).find(Boolean);
  return fromImages ?? null;
}

export function firstInitial(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function firstName(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.split(/\s+/)[0] : 'User';
}

/** Flutter feed strips " (Duration: N min)" from content. */
export function cleanPostContent(content?: string | null): string {
  return (content ?? '').replace(/\s*\(Duration:\s*\d+\s*mins?\)\s*/gi, '').trim();
}

/** 12 August 1998 style used by profile screens. */
export function formatBirthDate(value: unknown): string {
  if (value == null) return 'Not set';
  const ts = parseTimestamp(value);
  const date = new Date(ts);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function calculateAge(value: unknown): number | null {
  if (value == null) return null;
  const ts = parseTimestamp(value);
  if (!Number.isFinite(ts)) return null;
  const birth = new Date(ts);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age > 0 && age < 130 ? age : null;
}

export function capitalize(value?: string | null): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
