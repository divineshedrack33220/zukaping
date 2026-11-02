import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography } from '@mui/material';
import { PRIMARY } from '../styles/tokens';

interface ToastOptions {
  backgroundColor?: string;
  duration?: number;
}

interface ToastState {
  id: number;
  message: string;
  backgroundColor: string;
}

interface SnackbarContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

/**
 * Flutter SnackBar equivalent: floating, background #026AFD, radius 20,
 * 2 second default duration, white 14px text.
 */
export const SnackbarProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    if (timer.current) window.clearTimeout(timer.current);
    counter.current += 1;
    setToast({
      id: counter.current,
      message,
      backgroundColor: options?.backgroundColor ?? PRIMARY,
    });
    timer.current = window.setTimeout(
      () => setToast(null),
      options?.duration ?? 2000
    );
  }, []);

  return (
    <SnackbarContext.Provider value={{ showToast }}>
      {children}
      {toast &&
        createPortal(
          <Box
            key={toast.id}
            role="status"
            sx={{
              position: 'fixed',
              left: '50%',
              bottom: 96,
              transform: 'translateX(-50%)',
              zIndex: 3000,
              width: 'min(88vw, 380px)',
              bgcolor: toast.backgroundColor,
              borderRadius: '20px',
              px: '16px',
              py: '14px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              animation: 'flutter-toast-in 180ms ease-out',
              '@keyframes flutter-toast-in': {
                from: { opacity: 0, transform: 'translate(-50%, 12px)' },
                to: { opacity: 1, transform: 'translate(-50%, 0)' },
              },
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: 14,
                lineHeight: 1.35,
                textAlign: 'center',
                wordBreak: 'break-word',
              }}
            >
              {toast.message}
            </Typography>
          </Box>,
          document.body
        )}
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = () => {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used inside <SnackbarProvider>');
  return ctx;
};
