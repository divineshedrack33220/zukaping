import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSnackbar } from './snackbar.context';

interface AuthContextProps {
  userId: string | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, userId: string, remember?: boolean) => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useSnackbar();

  // Restore session on first load
  useEffect(() => {
    const storedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');

    if (storedToken) {
      setToken(storedToken);
      setUserId(storedUserId);
    }
    setIsLoading(false);
  }, []);

  const login = (authToken: string, newUserId: string, remember = true) => {
    setToken(authToken);
    setUserId(newUserId);

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', authToken);
    storage.setItem('userId', newUserId);

    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem('token');
    otherStorage.removeItem('userId');
  };

  const logout = useCallback(() => {
    setToken(null);
    setUserId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userId');
  }, []);

  // api.service drops a rejected token from storage and announces it here.
  // Clearing the React state is what makes the route guard send the user to
  // /login instead of letting every screen keep replaying a dead token.
  useEffect(() => {
    const onSessionExpired = () => {
      logout();
      showToast('Your session expired. Please sign in again.');
    };
    window.addEventListener('auth:expired', onSessionExpired);
    return () => window.removeEventListener('auth:expired', onSessionExpired);
  }, [logout, showToast]);

  const refreshToken = async () => {
    logout();
  };

  return (
    <AuthContext.Provider
      value={{ userId, token, isLoading, login, logout, refreshToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
