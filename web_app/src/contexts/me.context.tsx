import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { apiService, UserProfile } from '../services/api.service';
import { useAuth } from './auth.context';

interface MeContextValue {
  me: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setMe: (profile: UserProfile | null) => void;
}

const MeContext = createContext<MeContextValue | undefined>(undefined);

/** Holds GET /me for the signed-in user (used by nav, feed, profile…). */
export const MeProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setMe(null);
      return;
    }
    setLoading(true);
    try {
      const profile = await apiService.getProfile();
      setMe(profile);
    } catch {
      /* keep the previous profile */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Someone who paid and then closed the checkout tab still has an open charge.
  // Asking once per load settles it, so the photo appears without a hunt.
  useEffect(() => {
    if (!token) return;
    void apiService.reconcilePayments().catch(() => undefined);
  }, [token]);

  return (
    <MeContext.Provider value={{ me, loading, refresh, setMe }}>
      {children}
    </MeContext.Provider>
  );
};

export const useMe = () => {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used inside <MeProvider>');
  return ctx;
};
