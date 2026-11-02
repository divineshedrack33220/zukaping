import { Message } from '../models/chat.models';

/** Flutter `_parseImageUrls` — JSON list, JSON string or bare http URL. */
export function parseImageUrls(content?: string | null): string[] {
  const value = (content ?? '').trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string');
      }
      if (typeof parsed === 'string') return [parsed];
    } catch {
      return [];
    }
    return [];
  }
  if (value.startsWith('http')) return [value];
  return [];
}

/** Flutter `_isImageMessage`. */
export function isImageMessage(message: Message): boolean {
  if (message.type === 'image') return true;
  const content = (message.content ?? '').trim();
  if (content.startsWith('[')) {
    const urls = parseImageUrls(content);
    return urls.length > 0 && urls.every((url) => url.startsWith('http'));
  }
  if (content.startsWith('http')) {
    return (
      content.includes('cloudinary') ||
      /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(content)
    );
  }
  return false;
}

const EMOJI_RE =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s){1,10}$/u;

/** Flutter `_isOnlyEmoji` — ≤10 chars made up of emoji. */
export function isOnlyEmoji(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 10) return false;
  return EMOJI_RE.test(trimmed);
}

/** Flutter `_getEmojiSize` based on grapheme count. */
export function emojiFontSize(text: string): number {
  const count = Array.from(text.trim()).length;
  if (count <= 1) return 48;
  if (count <= 3) return 38;
  return 32;
}

export const GROUP_SENDER_COLORS = [
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#6366F1',
  '#8B5CF6',
  '#EF4444',
  '#06B6D4',
  '#14B8A6',
];

export function senderColor(senderId?: string | null): string {
  const key = senderId ?? '';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i)) % 100000;
  }
  return GROUP_SENDER_COLORS[hash % GROUP_SENDER_COLORS.length];
}

/** `_checkKeywordEffects` trigger. */
export function keywordEffect(content: string): 'confetti' | 'hearts' | null {
  const text = content.toLowerCase();
  if (['congratulations', 'yay', 'hbd'].some((word) => text.includes(word))) {
    return 'confetti';
  }
  if (text.includes('love') || text.includes('❤️')) return 'hearts';
  return null;
}
