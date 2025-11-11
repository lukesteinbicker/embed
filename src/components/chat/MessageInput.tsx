// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { useMessages, useTyping } from '@ably/chat/react';
import { LogOut, Video, Send } from 'lucide-react';

interface MessageInputProps {
  currentFields: any;
  onCallClick: () => void;
  onCancelClick: () => void;
  onCloseClick: () => void;
  isConnecting?: boolean;
}

const styles = {
  wrapper: {
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'transparent',
    flexShrink: 0
  },
  card: {
    borderTop: '1px solid hsl(var(--border) / 0.4)',
    borderRadius: '24px',
    backgroundColor: 'hsl(var(--background))',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  inputRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  textarea: (isDisabled: boolean) => ({
    width: '100%',
    padding: '12px 48px 12px 14px',
    border: '1px solid hsl(var(--border) / 0.3)',
    borderRadius: '24px',
    resize: 'none',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    backgroundColor: isDisabled ? 'hsl(var(--muted))' : 'hsl(var(--background) / 0.95)',
    color: isDisabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
    cursor: isDisabled ? 'not-allowed' : 'text'
  }),
  sendButton: (isDisabled: boolean, isEmpty: boolean) => ({
    position: 'absolute',
    right: '8px',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    color: isDisabled ? 'hsl(var(--muted-foreground))' : (isEmpty ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))'),
    border: 'none',
    borderRadius: '50%',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0
  })
} as const;

const callStyles = {
  container: {
    padding: '0',
    backgroundColor: 'transparent',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0
  },
  ghostButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '10px 8px',
    background: 'transparent',
    color: 'hsl(var(--foreground))',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    whiteSpace: 'nowrap',
    minHeight: '32px',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '9999px',
    background: 'linear-gradient(to bottom, hsl(var(--constructive)), hsl(var(--constructive) / 0.85))',
    color: 'hsl(var(--constructive-foreground))',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    whiteSpace: 'nowrap',
    minHeight: '32px',
    boxShadow: '0 2px 4px hsl(var(--constructive) / 0.2)'
  },
  spinner: {
    width: '10px',
    height: '10px',
    border: '2px solid hsl(var(--constructive-foreground) / 0.4)',
    borderTop: '2px solid hsl(var(--constructive-foreground))',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
} as const;

const SPIN_KEYFRAMES = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

function CallButtonSection({ currentFields, onCallClick, onCancelClick, onCloseClick, isConnecting: propIsConnecting }) {
  const isEnded = !!currentFields.sessionEndedAt;
  const isInCall = !!currentFields.dailyRoomId && !isEnded;
  const hasJoined = !!currentFields.joined;
  const isConnecting = propIsConnecting || (hasJoined && !isInCall); // Use prop or fallback to calculated value

  if (isEnded || isInCall || isConnecting) {
    // Hide when ended, in call, or connecting (video frame is showing)
    return null;
  }

  return (
    <div style={callStyles.container}>
      <button onClick={onCloseClick} style={callStyles.ghostButton}>
        <LogOut size={13} />
        <span>End chat</span>
      </button>
      <button onClick={onCallClick} style={callStyles.primaryButton}>
        <Video size={13} />
        <span>Start a video call</span>
      </button>
    </div>
  );
}

export function MessageInput({ currentFields, onCallClick, onCancelClick, onCloseClick, isConnecting }: MessageInputProps) {
  const [messageText, setMessageText] = useState('');
  const messages = useMessages();
  const { keystroke, stop } = useTyping();

  const isVisitCompleted = !!currentFields.sessionEndedAt;

  const handleSendMessage = useCallback(async () => {
    if (messageText.trim() && !isVisitCompleted) {
      try {
        const result = await messages.sendMessage({ text: messageText.trim() });
        setMessageText('');
        try {
          await stop();
        } catch (typingError) {
          console.error('Error stopping typing indicator:', typingError);
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }, [messageText, messages, isVisitCompleted, stop]);

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleChange = (event) => {
    setMessageText(event.target.value);
    if (!isVisitCompleted) {
      keystroke().catch((typingError) => {
        console.error('Error sending typing indicator:', typingError);
      });
    }
  };

  const handleBlur = () => {
    if (!isVisitCompleted) {
      stop().catch((typingError) => {
        console.error('Error stopping typing indicator on blur:', typingError);
      });
    }
  };

  useEffect(() => {
    if (isVisitCompleted) {
      stop().catch(() => {});
    }
  }, [isVisitCompleted, stop]);

  useEffect(() => {
    return () => {
      stop().catch(() => {});
    };
  }, [stop]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <CallButtonSection
          currentFields={currentFields}
          onCallClick={onCallClick}
          onCancelClick={onCancelClick}
          onCloseClick={onCloseClick}
          isConnecting={isConnecting}
        />
        <div style={styles.inputRow}>
          <textarea
            value={messageText}
            onChange={handleChange}
            onKeyPress={handleKeyPress}
            onBlur={handleBlur}
            placeholder="Send a message..."
            disabled={isVisitCompleted}
            style={styles.textarea(isVisitCompleted)}
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={isVisitCompleted}
            style={styles.sendButton(isVisitCompleted, !messageText.trim())}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

