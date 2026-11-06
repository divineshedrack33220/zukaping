import { useRef, useState } from 'react';
import { Box } from '@mui/material';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import { usePalette } from '../../contexts/app-theme.context';
import { Message } from '../../models/chat.models';
import {
  emojiFontSize,
  isImageMessage,
  isOnlyEmoji,
  parseImageUrls,
  senderColor,
} from '../../utils/messages';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  /** Group chats prefix other-user bubbles with a coloured sender name. */
  showSender: boolean;
  /** Optional override; defaults to senderName → 'Member'. */
  senderName?: string;
  onLongPress?: (message: Message) => void;
  onSwipeReply?: (message: Message) => void;
  onQuoteTap?: (messageId: string) => void;
  onImageTap?: (urls: string[], index: number) => void;
}

const IMAGE_BG_DARK = '#1C1C1E';
const IMAGE_BG_LIGHT = '#EEEEEE';

const MessageImages = ({
  urls,
  onTap,
}: {
  urls: string[];
  onTap?: (index: number) => void;
}) => {
  const c = usePalette();
  const cells = urls.slice(0, 4);
  const count = urls.length;

  // The 2px cell gaps are the only separator a grid has, so they must read as
  // the chat backdrop rather than whatever the bubble is painted with.
  const shell = {
    width: 240,
    maxWidth: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    bgcolor: c.isDark ? '#121212' : '#F8F9FA',
  };

  const image = (url: string, index: number) => (
    <Box
      key={`${url}-${index}`}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onTap?.(index);
      }}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        bgcolor: c.isDark ? IMAGE_BG_DARK : IMAGE_BG_LIGHT,
        cursor: 'pointer',
      }}
    >
      <Box
        component="img"
        src={url}
        alt=""
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={(event) => {
          const target = event.currentTarget as HTMLImageElement;
          target.style.display = 'none';
          const sibling = target.nextElementSibling as HTMLElement | null;
          if (sibling) sibling.style.display = 'block';
        }}
      />
      <BrokenImageIcon
        sx={{
          display: 'none',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
          color: '#9E9E9E',
        }}
      />
      {index === 3 && count > 4 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 20,
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          +{count - 4}
        </Box>
      )}
    </Box>
  );

  if (count === 1) {
    return (
      <Box sx={{ ...shell, aspectRatio: '1 / 1' }}>
        {image(urls[0], 0)}
      </Box>
    );
  }
  if (count === 2) {
    return (
      <Box
        sx={{
          ...shell,
          aspectRatio: '7 / 5',
          display: 'flex',
          gap: '2px',
        }}
      >
        {cells.map((url, index) => (
          <Box key={`${url}-${index}`} sx={{ flex: 1, minWidth: 0 }}>
            {image(url, index)}
          </Box>
        ))}
      </Box>
    );
  }
  if (count === 3) {
    return (
      <Box
        sx={{
          ...shell,
          aspectRatio: '1 / 1',
          display: 'flex',
          gap: '2px',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>{image(cells[0], 0)}</Box>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>{image(cells[1], 1)}</Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>{image(cells[2], 2)}</Box>
        </Box>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        ...shell,
        aspectRatio: '1 / 1',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '2px',
      }}
    >
      {cells.map((url, index) => image(url, index))}
    </Box>
  );
};

/** `_buildMessageBubble` + `SwipeToReply` from chat_screen.dart. */
export const MessageBubble = ({
  message,
  isMe,
  showSender,
  senderName,
  onLongPress,
  onSwipeReply,
  onQuoteTap,
  onImageTap,
}: MessageBubbleProps) => {
  const c = usePalette();
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const triggered = useRef(false);

  const images = isImageMessage(message) ? parseImageUrls(message.content) : [];
  const content = message.content ?? '';
  // Older and mobile-sent messages arrive as plain text even when they are
  // nothing but emoji, so the size/bubble treatment keys off the content too.
  const isEmoji =
    message.type === 'emoji' || (!images.length && message.type !== 'image' && isOnlyEmoji(content));
  const quotedSender = message.replyToSenderName ?? 'Partner';
  const reactions = message.reactions ? Object.values(message.reactions) : [];
  // A lone emoji reads better bare than boxed in a bubble that is mostly empty
  // padding; its reaction then sits under it instead of clipping the corner.
  const bareEmoji = isEmoji && images.length === 0 && !message.replyToId && !(showSender && !isMe);
  const reactionHangsBelow = bareEmoji && reactions.length > 0;
  // A caption is only present when the content is an object rather than the
  // plain URL array the composer sends, so an image message is usually bare.
  const hasCaption = images.length > 0 && content.includes('"') && !content.trim().startsWith('[');
  // A group photo still needs its padding: the coloured sender name lives
  // inside the bubble and would otherwise sit flush against the picture.
  const imageOnly = images.length > 0 && !hasCaption && !(showSender && !isMe);
  // The chip hangs 16px up into the bubble from its corner; without extra
  // bottom padding it lands on the descenders of the last line of text.
  const roomForReaction = reactions.length > 0 && !reactionHangsBelow && !imageOnly;

  const onTouchStart = (event: React.TouchEvent) => {
    startX.current = event.touches[0]?.clientX ?? null;
    triggered.current = false;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (startX.current == null) return;
    const delta = (event.touches[0]?.clientX ?? 0) - startX.current;
    if (delta > 0) setDrag(Math.min(delta, 90));
  };
  const onTouchEnd = () => {
    if (drag >= 55 && !triggered.current) {
      triggered.current = true;
      onSwipeReply?.(message);
    }
    setDrag(0);
    startX.current = null;
  };

  const bubbleText = isEmoji ? (
    <Box
      component="span"
      sx={{ fontSize: emojiFontSize(content), lineHeight: 1.1, whiteSpace: 'pre-wrap' }}
    >
      {content}
    </Box>
  ) : (
    <Box
      component="span"
      sx={{
        fontSize: 14,
        lineHeight: 1.43,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: isMe ? '#FFFFFF' : c.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.87)',
      }}
    >
      {content}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        position: 'relative',
        width: '100%',
        mb: reactionHangsBelow ? '22px' : '12px',
        mt: '4px',
      }}
    >
      {/* swipe reply affordance */}
      <Box
        sx={{
          position: 'absolute',
          left: `calc(${isMe ? 'auto' : '0px'} + ${isMe ? 0 : -35 + drag * 0.45}px)`,
          right: isMe ? `calc(0px + ${-35 + drag * 0.45}px)` : 'auto',
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: Math.min(drag / 55, 1),
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: '#026AFD',
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <ReplyRoundedIcon sx={{ fontSize: 16, color: '#FFFFFF' }} />
      </Box>

      <Box
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={() => onLongPress?.(message)}
        onContextMenu={(event) => {
          event.preventDefault();
          onLongPress?.(message);
        }}
        sx={{
          transform: `translateX(${drag}px)`,
          transition: drag === 0 ? 'transform 200ms cubic-bezier(0.175,0.885,0.32,1.275)' : 'none',
          maxWidth: '75%',
          position: 'relative',
          zIndex: 1,
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        <Box
          sx={{
            p: bareEmoji || imageOnly ? 0 : roomForReaction ? '10px 16px 18px' : '10px 16px',
            overflow: imageOnly ? 'hidden' : undefined,
            background: isMe && !bareEmoji ? '#026AFD' : undefined,
            // Received bubbles need to lift off the chat backdrop (#121212 /
            // #F8F9FA); matching the backdrop left only a hairline rim, which
            // reads as an empty outlined box on short messages.
            bgcolor: isMe || bareEmoji ? undefined : c.isDark ? '#1C1C1E' : '#FFFFFF',
            border:
              isMe || bareEmoji || imageOnly
                ? undefined
                : `1px solid ${c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
            // A photo fills its bubble corner to corner, so the bubble takes the
            // grid's radius; the larger text radius would leave a wedge of the
            // bubble's own colour showing at each corner.
            borderRadius: imageOnly ? '12px' : '20px',
            borderBottomLeftRadius: imageOnly ? '12px' : isMe ? '20px' : '4px',
            borderBottomRightRadius: imageOnly ? '12px' : isMe ? '4px' : '20px',
            boxShadow: bareEmoji
              ? 'none'
              : isMe
              ? '0 6px 12px rgba(2,106,253,0.2), inset 0 -1px 0 -1px rgba(255,255,255,0.2)'
              : c.isDark
              ? '0 4px 14px rgba(0,0,0,0.45)'
              : '0 2px 8px rgba(0,0,0,0.06)',
            minWidth: 0,
          }}
        >
          {showSender && !isMe && (
            <Box
              sx={{
                mb: '5px',
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: '0.1px',
                lineHeight: 1.3,
                color: senderColor(message.senderId),
              }}
            >
              {senderName ?? message.senderName ?? 'Member'}
            </Box>
          )}

          {message.replyToId && (
            <Box
              role="button"
              onClick={() => onQuoteTap?.(message.replyToId as string)}
              sx={{
                mb: '8px',
                p: '8px 12px',
                borderRadius: '8px',
                bgcolor: isMe
                  ? 'rgba(0,0,0,0.08)'
                  : c.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : '#F1F5F9',
                borderLeft: `3.5px solid ${isMe ? 'rgba(255,255,255,0.9)' : '#026AFD'}`,
                cursor: 'pointer',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReplyRoundedIcon
                  sx={{
                    fontSize: 12,
                    color: isMe ? 'rgba(255,255,255,0.9)' : '#026AFD',
                    mr: '4px',
                  }}
                />
                <Box
                  component="span"
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.27,
                    color: isMe ? '#FFFFFF' : '#026AFD',
                  }}
                >
                  {quotedSender}
                </Box>
              </Box>
              <Box sx={{ height: 3 }} />
              <Box
                sx={{
                  fontSize: 11.5,
                  lineHeight: 1.3,
                  color: isMe
                    ? 'rgba(255,255,255,0.85)'
                    : c.isDark
                    ? '#E0E0E0'
                    : 'rgba(0,0,0,0.54)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {message.replyToContent ?? ''}
              </Box>
            </Box>
          )}

          {images.length > 0 ? (
            <>
              <MessageImages
                urls={images}
                onTap={(index) => onImageTap?.(images, index)}
              />
              {hasCaption && <Box sx={{ p: '8px 12px 10px' }}>{bubbleText}</Box>}
            </>
          ) : (
            bubbleText
          )}
        </Box>

        {reactions.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: reactionHangsBelow ? 'auto' : -4,
              top: reactionHangsBelow ? '100%' : 'auto',
              marginTop: reactionHangsBelow ? '2px' : 0,
              right: isMe ? 4 : 'auto',
              left: isMe ? 'auto' : 4,
              p: '4px',
              borderRadius: '50%',
              bgcolor: c.isDark ? '#2C2C2E' : '#FFFFFF',
              border: `1px solid ${c.isDark ? '#424242' : '#F5F5F5'}`,
              fontSize: 12,
              lineHeight: 1,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {reactions[0]}
          </Box>
        )}
      </Box>
    </Box>
  );
};
