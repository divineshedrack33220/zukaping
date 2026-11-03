/**
 * The app shell is sized from the visual viewport, not from `100dvh`.
 *
 * iOS Safari keeps the layout viewport at full height when the keyboard opens
 * and pans the whole page to reveal the focused field — on a chat screen that
 * drags the message list up over its own header. `visualViewport` is the only
 * measurement that reflects what is actually on screen, so every full-height
 * screen reads its height from the variable published here.
 */

const KEY = '--app-h';
/** Anything smaller than this is the URL bar collapsing, not a keyboard. */
const SHRINK_MIN = 80;

let started = false;
let lastHeight = 0;
const shrinkListeners = new Set<() => void>();

function apply(): void {
  const vv = window.visualViewport;
  const height = Math.round(vv ? vv.height : window.innerHeight);
  if (height <= 0) return;
  const dropped = lastHeight - height;
  document.documentElement.style.setProperty(KEY, `${height}px`);
  if (dropped >= SHRINK_MIN) shrinkListeners.forEach((notify) => notify());
  lastHeight = height;
}

export function startViewportTracking(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  apply();
  window.visualViewport?.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('scroll', apply);
  window.addEventListener('orientationchange', () => window.setTimeout(apply, 120));
  window.addEventListener('load', apply);
}

/**
 * Runs `onShrink` when the visible area collapses — the keyboard arriving, or a
 * sheet taking the room. Chat screens use it to stay pinned to the newest
 * message instead of leaving it under the keyboard.
 */
export function onViewportShrink(onShrink: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  startViewportTracking();
  shrinkListeners.add(onShrink);
  return () => shrinkListeners.delete(onShrink);
}
