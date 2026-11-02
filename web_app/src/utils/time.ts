/**
 * The Go backend stores all timestamps as Unix seconds. Be defensive and also
 * accept values that are already in milliseconds.
 */
export function toMillis(value?: number | null): number {
  if (!value || value <= 0) return 0;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

export function formatClock(value?: number | null): string {
  const ms = toMillis(value);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value?: number | null): string {
  const ms = toMillis(value);
  if (!ms) return '';
  return new Date(ms).toLocaleString();
}

export function formatTime(value?: number | null): string {
  const ms = toMillis(value);
  if (!ms) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - ms) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return formatClock(value);
  if (diffSec < 86400 * 2) return 'Yesterday';
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatRelativeDay(value?: number | null): string {
  const ms = toMillis(value);
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? formatClock(value) : date.toLocaleDateString();
}
