/** Google Identity Services bridge for the "Continue with Google" buttons. */

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface CredentialResponse {
  credential?: string;
  error?: string;
}

interface PromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
  getNotDisplayedReason?(): string;
  getSkippedReason?(): string;
  getDismissedReason?(): string;
}

interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select: boolean;
    cancel_on_tap_outside: boolean;
  }): void;
  prompt(listener?: (notification: PromptNotification) => void): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let pendingScript: Promise<GoogleId> | null = null;

function loadGsi(): Promise<GoogleId> {
  const loaded = window.google?.accounts?.id;
  if (loaded) return Promise.resolve(loaded);
  if (!pendingScript) {
    pendingScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        const id = window.google?.accounts?.id;
        if (id) resolve(id);
        else reject(new Error('Google Identity Services loaded without an ID API.'));
      };
      script.onerror = () => {
        pendingScript = null;
        reject(new Error('Could not reach accounts.google.com.'));
      };
      document.head.appendChild(script);
    });
  }
  return pendingScript;
}

/** Opens Google's account chooser and resolves with the signed ID token. */
export async function requestGoogleCredential(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error('Google Sign-In is not configured for the web build.');
  }
  const id = await loadGsi();

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    id.initialize({
      client_id: CLIENT_ID,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (settled) return;
        settled = true;
        if (response.credential) resolve(response.credential);
        else reject(new Error(response.error ?? 'Google did not return a credential.'));
      },
    });
    id.prompt((notification) => {
      if (settled) return;
      if (!notification.isNotDisplayed() && !notification.isSkippedMoment()) return;
      const reason = notification.getNotDisplayedReason?.() ?? notification.getSkippedReason?.();
      settled = true;
      id.cancel();
      reject(
        new Error(
          reason === 'opt_out_or_no_session'
            ? 'No Google session is available in this browser to sign in with.'
            : `Google prompt was blocked${reason ? ` (${reason})` : ''}. Add this site as an Authorized JavaScript origin in Google Cloud Console.`
        )
      );
    });
  });
}
