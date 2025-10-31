// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessages, useTyping } from '@ably/chat/react';
import { Avatar } from './Avatar';

interface MessagesListProps {
  currentFields: any;
  headerHeight?: number;
  visitorClientId?: string;
}

const styles = {
  container: (headerHeight: number) => ({
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    paddingTop: headerHeight > 0 ? `${12 + headerHeight}px` : '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0
  }),
  systemMessageWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    width: '100%'
  },
  systemMessageText: {
    backgroundColor: 'transparent',
    color: 'hsl(var(--foreground))',
    padding: '8px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: 500,
    flex: 1
  },
  messageWrapper: (isVisitor: boolean) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: isVisitor ? 'flex-end' : 'flex-start'
  }),
  messageBubble: {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    padding: '6px 12px',
    borderRadius: '16px',
    maxWidth: '80%',
    wordWrap: 'break-word',
    border: '1px solid hsl(var(--border) / 0.3)',
    fontSize: '13px'
  },
  typingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0'
  },
  typingBubble: {
    backgroundColor: 'hsl(var(--muted) / 0.8)',
    color: 'hsl(var(--foreground))',
    padding: '6px 16px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid hsl(var(--border) / 0.2)',
    minHeight: '32px',
    minWidth: '68px'
  },
  typingDot: (delay: number) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'hsl(var(--foreground) / 0.6)',
    opacity: 0.5,
    animation: 'typingDots 1.2s ease-in-out infinite',
    animationDelay: `${delay}s`
  }),
  completionWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '8px'
  },
  completionText: {
    textAlign: 'center',
    color: 'hsl(var(--foreground))',
    fontSize: '13px',
    padding: '8px 0',
    fontWeight: 500
  }
} as const;

const TYPING_KEYFRAMES = `
@keyframes typingDots {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-2px); opacity: 1; }
}
`;

function TypingIndicator({ userName, userImage }) {
  return (
    <div style={styles.typingContainer}>
      <Avatar userName={userName} userImage={userImage} />
      <div style={styles.typingBubble}>
        {[0, 0.15, 0.3].map((delay) => (
          <div key={delay} style={styles.typingDot(delay)} />
        ))}
      </div>
      <style>{TYPING_KEYFRAMES}</style>
    </div>
  );
}

export function MessagesList({ currentFields, headerHeight = 0, visitorClientId }: MessagesListProps) {
  const [messages, setMessages] = useState([]);
  const [agentInfo, setAgentInfo] = useState(null);
  const messagesEndRef = useRef(null);

  const isVisitCompleted = !!currentFields.sessionEndedAt;

  const applyAgentInfo = useCallback((message) => {
    const metadata = message?.metadata;
    if (metadata?.userName) {
      setAgentInfo((prev) => {
        if (!prev) {
          return {
            userName: metadata.userName,
            userImage: metadata.userImage ?? null
          };
        }

        if (
          prev.userName !== metadata.userName ||
          (metadata.userImage ?? null) !== prev.userImage
        ) {
          return {
            userName: metadata.userName,
            userImage: metadata.userImage ?? null
          };
        }

        return prev;
      });
    }
  }, []);

  const { currentlyTyping } = useTyping();

  const typingClients = currentlyTyping
    ? Array.from(currentlyTyping).filter((clientId) => {
        if (!clientId) return false;
        if (clientId === visitorClientId) return false;
        if (clientId.startsWith('system-')) return false;
        return true;
      })
    : [];

  const messagesHook = useMessages({
    listener: (messageEvent) => {
      const message = messageEvent.message;
      applyAgentInfo(message);
      setMessages((prevMessages) => [...prevMessages, message]);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messagesHook.roomStatus === 'attached') {
      messagesHook
        .history({
          direction: 'backwards',
          limit: 50
        })
        .then((history) => {
          if (history && history.items) {
            const orderedMessages = history.items.reverse();
            orderedMessages.forEach(applyAgentInfo);
            setMessages(orderedMessages);
          }
        })
        .catch((error) => {
          console.error('Error getting message history:', error);
        });
    }
  }, [messagesHook.roomStatus, applyAgentInfo]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingClients.length]);

  return (
    <div style={styles.container(headerHeight)}>
      {messages && messages.length > 0 && (
        messages.map((message) => {
          const isSystemMessage =
            message.metadata?.type === 'system' || message.metadata?.eventType === 'user_joined';

          if (isSystemMessage) {
            const userName = message.metadata?.userName || 'Someone';
            const userImage = message.metadata?.userImage;

            return (
              <div key={message.id} style={styles.systemMessageWrapper}>
                <Avatar userName={userName} userImage={userImage} />
                <div style={styles.systemMessageText}>
                  {message.text || `${userName} joined the chat`}
                </div>
              </div>
            );
          }

          const isVisitor = message.clientId?.startsWith('embed-');

          return (
            <div key={message.id} style={styles.messageWrapper(isVisitor)}>
              <div style={styles.messageBubble}>
                {message.text || message.data}
              </div>
            </div>
          );
        })
      )}

      {typingClients.length > 0 && !isVisitCompleted && (
        <TypingIndicator
          userName={agentInfo?.userName || 'Agent'}
          userImage={agentInfo?.userImage || null}
        />
      )}

      {isVisitCompleted && (
        <div style={styles.completionWrapper}>
          <div style={styles.completionText}>Visit ended</div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

