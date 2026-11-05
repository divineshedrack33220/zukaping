/**
 * Install state for the PWA prompt.
 *
 * Chrome only hands out a `beforeinstallprompt` event once, and it can arrive
 * before React has mounted, so the event is parked here at module scope and the
 * sheet subscribes to it. iOS Safari never fires the event at all — there the
 * only route is the browser's own Share > Add to Home Screen menu, which the
 * sheet falls back to.
 */

const DISMISS_KEY = 'zukaping_install_dismissed_at';
const INSTALLED_KEY = 'zukaping_installed';

/** A visitor who declines gets asked again after a week, not on every visit. */
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
/** Long enough that the sheet does not land on top of the splash. */
const AUTO_DELAY_MS = 1800;

interface PromptEvent {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'desktop';

export interface InstallState {
  /** Chrome/Edge gave us an event we can trigger ourselves. */
  canPrompt: boolean;
  /** Already running as an installed app, in which case there is nothing to offer. */
  installed: boolean;
  platform: Platform;
  visible: boolean;
}

const listeners = new Set<() => void>();
let promptEvent: PromptEvent | null = null;
let visible = false;
let started = false;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  // iPadOS on Safari 13+ reports a desktop "Macintosh" UA, so touch points
  // are the only way to tell it apart from a real Mac.
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/mac/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

function isRunningStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari sets this once the page was opened from a home-screen icon.
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    sessionStorage.getItem('zukaping_from_home_screen') === '1'
  );
}

function markSessionOrigin(): void {
  // A PWA opened twice in a row from the home screen stays "installed" as far as
  // the prompt is concerned, even though display-mode can report false on iOS.
  if (isRunningStandalone()) sessionStorage.setItem('zukaping_from_home_screen', '1');
}

function buildSnapshot(): InstallState {
  return {
    canPrompt: promptEvent !== null,
    installed: isRunningStandalone() || localStorage.getItem(INSTALLED_KEY) === '1',
    platform: detectPlatform(),
    visible,
  };
}

/* React reads the state through useSyncExternalStore, which re-renders whenever
   the snapshot reference changes — so it is rebuilt only on real transitions. */
let cached = buildSnapshot();

function emit(): void {
  cached = buildSnapshot();
  listeners.forEach((notify) => notify());
}

function setVisible(next: boolean): void {
  if (visible === next) return;
  visible = next;
  emit();
}

function snoozed(): boolean {
  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
  return dismissedAt > 0 && Date.now() - dismissedAt < SNOOZE_MS;
}

/**
 * Call once, before render: the prompt event can fire while the bundle is still
 * booting, and an event that is missed is gone until the next navigation.
 */
export function initPwaInstall(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  markSessionOrigin();

  window.addEventListener('beforeinstallprompt', (event) => {
    // Stopping the browser's own mini-infobar keeps the sheet the only offer.
    event.preventDefault();
    promptEvent = event as unknown as PromptEvent;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    localStorage.setItem(INSTALLED_KEY, '1');
    setVisible(false);
  });

  const standalone = window.matchMedia('(display-mode: standalone)');
  standalone.addEventListener('change', () => {
    markSessionOrigin();
    if (isRunningStandalone()) setVisible(false);
    emit();
  });

  window.setTimeout(() => {
    if (buildSnapshot().installed || snoozed()) return;
    setVisible(true);
  }, AUTO_DELAY_MS);
}

export function subscribeInstall(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getInstallState(): InstallState {
  return cached;
}

export function openInstallPrompt(): void {
  setVisible(true);
}

export function dismissInstallPrompt(): void {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  setVisible(false);
}

/**
 * Fires the browser install dialog where one is available. Returns false when
 * the platform has no prompt, which is the sheet's cue to show manual steps.
 */
export async function runInstall(): Promise<boolean> {
  if (!promptEvent) return false;
  const choice = await promptEvent.prompt();
  promptEvent = null;
  emit();
  if (choice.outcome === 'accepted') {
    // The browser takes over from here; `appinstalled` closes the sheet.
    return true;
  }
  dismissInstallPrompt();
  return false;
}
