import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api.service';
import { useMe } from '../contexts/me.context';
import { useAuth } from '../contexts/auth.context';
import { useSnackbar } from '../contexts/snackbar.context';
import { wsService } from '../services/ws.service';

export interface StatusOption {
  value: string;
  label: string;
  dot: string;
}

/** Feed app-bar cycle: Available / Busy / Ghost / Super / Offline. */
export const FEED_STATUSES: StatusOption[] = [
  { value: 'available', label: 'Available', dot: '#026AFD' },
  { value: 'busy', label: 'Busy', dot: '#FFEB3B' },
  { value: 'ghost', label: 'Ghost', dot: 'rgba(158,158,158,0.5)' },
  { value: 'super', label: 'Super', dot: '#7C4DFF' },
  { value: 'offline', label: 'Offline', dot: '#9E9E9E' },
];

/** Chats app-bar cycle: identical, but Ghost is rendered as "Stealth". */
export const CHAT_STATUSES: StatusOption[] = [
  { value: 'available', label: 'Available', dot: '#026AFD' },
  { value: 'busy', label: 'Busy', dot: '#FFFF00' },
  { value: 'ghost', label: 'Stealth', dot: 'rgba(158,158,158,0.5)' },
  { value: 'super', label: 'Super', dot: '#7C4DFF' },
  { value: 'offline', label: 'Offline', dot: '#9E9E9E' },
];

/** Favorites app-bar cycle: only Available / Busy / Offline. */
export const FAVORITE_STATUSES: StatusOption[] = [
  { value: 'available', label: 'Available', dot: '#026AFD' },
  { value: 'busy', label: 'Busy', dot: '#FFFF00' },
  { value: 'offline', label: 'Offline', dot: '#9E9E9E' },
];

/**
 * Flutter `_updateStatus`:
 *  - advance one step optimistically
 *  - `PUT /me {status}`
 *  - success: toast + WS status_update
 *  - failure: roll forward two steps (one back) + failure toast
 */
export function useStatusCycle(options: StatusOption[], ghostOpacity = false) {
  const { me, refresh } = useMe();
  const { userId } = useAuth();
  const { showToast } = useSnackbar();

  const initialIndex = useMemo(() => {
    const found = options.findIndex((option) => option.value === me?.status);
    return found >= 0 ? found : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.status, options.length]);

  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const update = useCallback(async () => {
    const current = index;
    const nextIndex = (current + 1) % options.length;
    const next = options[nextIndex];
    setIndex(nextIndex);
    try {
      await apiService.updateUserStatus(next.value);
      showToast(`Status changed to ${next.label}`);
      wsService.send('status_update', {
        status: next.value,
        userId: userId ?? undefined,
      });
      void refresh();
    } catch {
      setIndex((current + 2) % options.length);
      showToast('Failed to update status');
    }
  }, [index, options, refresh, showToast, userId]);

  const option = options[index];
  const label = option?.label ?? 'Available';
  const dot = option?.dot ?? '#026AFD';

  return {
    index,
    option,
    label,
    dot,
    /** Chats dims the whole chip to 0.6 for ghost/Stealth. */
    opacity: ghostOpacity && option?.value === 'ghost' ? 0.6 : 1,
    cycle: update,
  };
}
