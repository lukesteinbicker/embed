// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { useMessages, useTyping } from '@ably/chat/react';
import { LogOut, Video, Send } from 'lucide-react';

interface MessageInputProps {
  currentFields: any;
  onCallClick: () => void;
  onCancelClick: () => void;
  onCloseClick: () => void;
}

const styles = {
  wrapper: {
    padding: '4px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: 'transparent',
    flexShrink: 0
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  textarea: (isDisabled: boolean) => ({
    flex: 1,
    padding: '6px 12px',
    border: '1px solid hsl(var(--border) / 0.3)',
    borderRadius: '16px',
    resize: 'none',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    backgroundColor: isDisabled ? 'hsl(var(--muted))' : 'hsl(var(--background))',
    color: isDisabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
    cursor: isDisabled ? 'not-allowed' : 'text'
  }),
  sendButton: (isDisabled: boolean) => ({
    padding: '6px 12px',
    backgroundColor: isDisabled ? 'hsl(var(--muted))' : 'hsl(var(--foreground))',
    color: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border) / 0.3)',
    borderRadius: '16px',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  })
} as const;

const callStyles = {
  container: {
    padding: '4px 0px 0',
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
    padding: '6px 10px',
    borderRadius: '16px',
    background: 'transparent',
    color: 'hsl(var(--foreground))',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    whiteSpace: 'nowrap',
    minHeight: '32px'
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '16px',
    background: 'hsl(var(--constructive))',
    color: 'hsl(var(--constructive-foreground))',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    whiteSpace: 'nowrap',
    minHeight: '32px'
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

function CallButtonSection({ currentFields, onCallClick, onCancelClick, onCloseClick }) {
  const isEnded = !!currentFields.sessionEndedAt;
  const isInCall = !!currentFields.dailyRoomId && !isEnded;
  const hasJoined = !!currentFields.joined;

  if (isEnded || isInCall) {
    return null;
  }

  if (hasJoined && !isInCall) {
    return (
      <>
        <div style={callStyles.container}>
          <button onClick={onCloseClick} style={callStyles.ghostButton}>
            <LogOut size={13} />
            <span>End chat</span>
          </button>
          <button onClick={onCancelClick} style={callStyles.primaryButton}>
            <div style={callStyles.spinner} />
            <span>Calling</span>
          </button>
        </div>
        <style>{SPIN_KEYFRAMES}</style>
      </>
    );
  }

  return (
    <div style={callStyles.container}>
      <button onClick={onCloseClick} style={callStyles.ghostButton}>
        <LogOut size={13} />
        <span>End chat</span>
      </button>
      <button onClick={onCallClick} style={callStyles.primaryButton}>
        <Video size={13} />
        <span>Start a call</span>
      </button>
    </div>
  );
}

export function MessageInput({ currentFields, onCallClick, onCancelClick, onCloseClick }: MessageInputProps) {
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
      <CallButtonSection
        currentFields={currentFields}
        onCallClick={onCallClick}
        onCancelClick={onCancelClick}
        onCloseClick={onCloseClick}
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
          style={styles.sendButton(isVisitCompleted)}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

