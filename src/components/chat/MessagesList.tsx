// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessages, useTyping } from '@ably/chat/react';
import { Avatar } from './Avatar';

interface MessagesListProps {
  currentFields: any;
  visitorClientId?: string;
  hasInviteHeader?: boolean;
}

const styles = {
  container: (hasInviteHeader: boolean) => ({
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    paddingTop: hasInviteHeader ? '80px' : '12px', // 68px header + 12px padding = 80px
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    maxHeight: '100%',
    background: 'hsl(var(--background))',
    boxSizing: 'border-box'
  }),
  systemMessageWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 0',
    width: '100%',
  },
  systemMessageText: {
    color: 'hsl(var(--muted-foreground))',
    fontSize: '12px',
    fontWeight: 500,
    textAlign: 'center'
  },
  messageWrapper: (isVisitor: boolean) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: isVisitor ? 'flex-end' : 'flex-start',
    width: '100%'
  }),
  messageBubble: (isVisitor: boolean, isPartOfSequence: boolean) => ({
    backgroundColor: isVisitor ? 'hsl(var(--primary) / 0.18)' : 'hsl(var(--muted))',
    color: 'hsl(var(--foreground))',
    padding: '10px 12px',
    borderRadius: isPartOfSequence 
      ? '20px' // Fully rounded for messages in the middle of a sequence
      : (isVisitor ? '20px 20px 4px 20px' : '20px 20px 20px 4px'), // Square corner only for last message
    maxWidth: '80%',
    minWidth: 0,
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    wordBreak: 'normal',
    border: '1px solid hsl(var(--border) / 0.2)',
    fontSize: '13px',
    lineHeight: 1.45,
    flexShrink: 1,
    flex: '0 1 auto'
  }),
  typingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0'
  },
  typingBubble: {
    backgroundColor: 'hsl(var(--muted) / 0.8)',
    color: 'hsl(var(--foreground))',
    padding: '6px 12px',
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

export function MessagesList({ currentFields, visitorClientId, hasInviteHeader }: MessagesListProps) {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const isVisitCompleted = !!currentFields.sessionEndedAt;

  const { currentlyTyping } = useTyping();

  const typingClients = currentlyTyping
    ? Array.from(currentlyTyping).filter((clientId) => {
        if (!clientId) return false;
        if (clientId === visitorClientId) return false;
        if (clientId.startsWith('system-')) return false;
        return true;
      })
    : [];

  // Get user info for typing clients from their most recent messages
  const getTypingUserInfo = (clientId: string) => {
    // Find the most recent message from this clientId
    const userMessages = messages.filter(msg => msg.clientId === clientId);
    if (userMessages.length > 0) {
      const latestMessage = userMessages[userMessages.length - 1];
      return {
        userName: latestMessage.metadata?.userName ?? null,
        userImage: latestMessage.metadata?.userImage ?? null
      };
    }
    return { userName: null, userImage: null };
  };

  const messagesHook = useMessages({
    listener: (messageEvent) => {
      const message = messageEvent.message;
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
            setMessages(orderedMessages);
          }
        })
        .catch((error) => {
          console.error('Error getting message history:', error);
        });
    }
  }, [messagesHook.roomStatus]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingClients.length]);

  return (
    <div style={styles.container(!!hasInviteHeader)}>
      {messages && messages.length > 0 && (
        messages.map((message, index) => {
          const isSystemMessage =
            message.metadata?.type === 'system' || 
            message.metadata?.eventType === 'joined' ||
            message.metadata?.eventType === 'ended';

          if (isSystemMessage) {
            return (
              <div key={message.id} style={styles.systemMessageWrapper}>
                <div style={styles.systemMessageText}>
                  {message.text || 'System message'}
                </div>
              </div>
            );
          }

          const isVisitor = message.clientId?.startsWith('embed-');
          
          // Check if this is the last message from this user before another user speaks
          const nextMessage = messages[index + 1];
          const isLastFromUser = !nextMessage || 
            (nextMessage.clientId?.startsWith('embed-') !== isVisitor) ||
            (nextMessage.metadata?.type === 'system' || nextMessage.metadata?.eventType === 'joined');
          
          // Only show avatar for non-visitor messages (agent messages) when it's the last from that user
          const messageUserName = message.metadata?.userName ?? null;
          const messageUserImage = message.metadata?.userImage ?? null;
          // Show avatar if it's not a visitor message and it's the last from that user
          // Include automated messages (userName: null) so they show default avatar
          const shouldShowAvatar = !isVisitor && isLastFromUser;

          return (
            <div key={message.id} style={styles.messageWrapper(isVisitor)}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                flexDirection: isVisitor ? 'row-reverse' : 'row',
                width: '100%',
                maxWidth: '100%'
              }}>
                {shouldShowAvatar && (
                  <Avatar 
                    userName={messageUserName} 
                    userImage={messageUserImage} 
                  />
                )}
                {!shouldShowAvatar && !isVisitor && (
                  <div style={{ width: '32px', flexShrink: 0 }} />
                )}
                <div style={styles.messageBubble(isVisitor, !isLastFromUser)}>
                  {message.text || message.data}
                </div>
              </div>
            </div>
          );
        })
      )}

      {typingClients.length > 0 && !isVisitCompleted && (() => {
        // Get the first typing client's info (or use null if not found)
        const typingClientId = typingClients[0];
        const { userName, userImage } = getTypingUserInfo(typingClientId);
        return (
          <TypingIndicator
            userName={userName}
            userImage={userImage}
          />
        );
      })()}

      <div ref={messagesEndRef} />
    </div>
  );
}

