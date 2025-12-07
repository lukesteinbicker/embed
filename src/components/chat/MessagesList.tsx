// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessages, useTyping } from '@ably/chat/react';
import { Avatar } from './Avatar';
import { MessageSquare, Phone } from 'lucide-react';

interface MessagesListProps {
  currentFields: any;
  visitorClientId?: string;
  hasInviteHeader?: boolean;
  onChatOpen?: () => void;
  onCallClick?: () => void;
  hasOverlay?: boolean;
}

const styles = {
  container: (hasInviteHeader: boolean, hasOverlay: boolean) => ({
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    paddingTop: hasInviteHeader ? '48px' : (hasOverlay ? '48px' : '12px'),
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    maxHeight: '100%',
    background: 'transparent',
    boxSizing: 'border-box',
    transition: 'padding-top 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
  }),
  welcomeMessageWrapper: (step: number, index: number) => ({
    animation: step > index ? 'slideUp 0.4s ease-out forwards' : 'none',
    opacity: step > index ? 1 : 0,
    transform: step > index ? 'translateY(0)' : 'translateY(20px)'
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
  joinedMessageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  joinedMessageContainer: {
    borderRadius: '20px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    width: 'calc(80% + 40px)',
    minWidth: 'fit-content'
  },
  joinedMessageText: {
    color: 'hsl(var(--foreground))',
    fontSize: '13px',
    fontWeight: 600,
    textAlign: 'center',
    whiteSpace: 'nowrap'
  },
  messageWrapper: (isVisitor: boolean) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: isVisitor ? 'flex-end' : 'flex-start',
    width: '100%'
  }),
  messageBubble: (isVisitor: boolean, isPartOfSequence: boolean) => ({
    backgroundColor: isVisitor ? 'hsl(var(--muted-special))' : 'hsl(var(--muted))',
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
    fontSize: '13px',
    lineHeight: 1.45,
    flexShrink: 1,
    flex: '0 1 auto',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
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
    gap: '6px',
    minHeight: '28px',
    minWidth: '56px'
  },
  typingBar: (delay: number) => ({
    width: '5px',
    height: '14px',
    borderRadius: '3px',
    backgroundColor: 'hsl(var(--foreground) / 0.8)',
    opacity: 0.9,
    transformOrigin: 'bottom center',
    animation: 'typingBars 1s ease-in-out infinite',
    animationDelay: `${delay}s`
  }),
} as const;

const TYPING_KEYFRAMES = `
@keyframes typingBars {
  0% { transform: scaleY(0.4); opacity: 0.6; }
  25% { transform: scaleY(1); opacity: 1; }
  50% { transform: scaleY(0.6); opacity: 0.8; }
  75% { transform: scaleY(0.9); opacity: 0.9; }
  100% { transform: scaleY(0.4); opacity: 0.6; }
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

function TypingIndicator({ userName, userImage }) {
  return (
    <div style={styles.typingContainer}>
      <Avatar userName={userName} userImage={userImage} />
      <div style={styles.typingBubble}>
        {[0, 0.1, 0.2, 0.3].map((delay) => (
          <div key={delay} style={styles.typingBar(delay)} />
        ))}
      </div>
      <style>{TYPING_KEYFRAMES}</style>
    </div>
  );
}

export function MessagesList({ currentFields, visitorClientId, hasInviteHeader, onChatOpen, onCallClick, hasOverlay = false }: MessagesListProps) {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  // welcomeStep: 0 = none, 1 = message 1, 2 = messages 1+2, 3 = messages 1+2+3, 4 = all 4 messages
  // Always start at 0 - we'll update based on isReused in the effect
  const [welcomeStep, setWelcomeStep] = useState<number>(0);
  // Track if we've initialized welcome step to prevent animation on refresh
  const welcomeStepInitializedRef = useRef(false);
  
  // Initialize selectedButton based on first render state only (not reactive)
  const [selectedButton, setSelectedButton] = useState<'chat' | 'call' | null>(() => {
    // Wait for isReused to be determined before setting selectedButton
    if (currentFields.isReused === true) {
      // For reused visits, determine based on call status
      const isRequestingCall = !!currentFields.dailyRoomId || 
        (currentFields.joined === true && !currentFields.dailyRoomId);
      return isRequestingCall ? 'call' : 'chat';
    }
    // For new visits or undefined isReused, start with null (user will select)
    return null;
  });

  const isVisitCompleted = !!currentFields.sessionEndedAt;

  const { currentlyTyping } = useTyping();

  // Redirect message text swap (no separate stage; just flip content after 1s once selected)
  const [redirectSwapped, setRedirectSwapped] = useState(false);
  useEffect(() => {
    if (selectedButton && currentFields.isReused !== true) {
      setRedirectSwapped(false);
      const t = setTimeout(() => setRedirectSwapped(true), 1000);
      return () => clearTimeout(t);
    } else {
      setRedirectSwapped(false);
    }
  }, [selectedButton, currentFields.isReused]);

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
            console.log('[MessagesList] Loaded message history:', {
              messageCount: orderedMessages.length,
              isReused: currentFields.isReused,
              welcomeStepInitialized: welcomeStepInitializedRef.current
            });
            setMessages(orderedMessages);
          }
        })
        .catch((error) => {
          console.error('Error getting message history:', error);
        });
    }
  }, [messagesHook.roomStatus]);

  // Handle welcome messages - only show for new visits (isReused === false)
  useEffect(() => {
    // Skip if already initialized or if reused visit
    if (welcomeStepInitializedRef.current || currentFields.isReused === true) {
      if (currentFields.isReused === true && welcomeStep !== 0) {
        setWelcomeStep(0);
      }
      return;
    }

    // Wait for isReused to be determined (not undefined)
    if (currentFields.isReused === undefined) {
      return;
    }

    // Mark as initialized
    welcomeStepInitializedRef.current = true;

    // New visit: show welcome messages
    if (messages.length === 0) {
      // Animate messages appearing one by one
      setWelcomeStep(1);
      setTimeout(() => setWelcomeStep(2), 1000);
      setTimeout(() => setWelcomeStep(3), 2000);
      setTimeout(() => setWelcomeStep(4), 3000);
    } else {
      // Has messages: show all immediately
      setWelcomeStep(4);
    }
  }, [currentFields.isReused, messages.length, welcomeStep]);


  // Create fake welcome messages to display at the top
  const welcomeMessages = [
    {
      id: 'welcome-1',
      text: 'Hi there!',
      clientId: 'ai',
      metadata: {
        userName: null,
        userImage: null,
      }
    },
    {
      id: 'welcome-2',
      text: 'We can chat here or start a call',
      clientId: 'ai',
      metadata: {
        userName: null,
        userImage: null,
      }
    },
    {
      id: 'welcome-3',
      text: 'Which would you like to start with?',
      clientId: 'ai',
      metadata: {
        userName: null,
        userImage: null,
      }
    },
    {
      id: 'welcome-4',
      text: '',
      clientId: 'ai',
      metadata: {
        userName: null,
        userImage: null,
        hasButtons: true
      }
    },
    // Fifth welcome message (redirect status) is appended only after selection
    {
      id: 'welcome-5',
      text: '',
      clientId: 'ai',
      metadata: {
        userName: null,
        userImage: null,
        isRedirect: true
      }
    }
  ];

  // Show welcome messages based on step
  const visibleWelcomeMessages = [
    ...(welcomeStep >= 1 ? [welcomeMessages[0]] : []),
    ...(welcomeStep >= 2 ? [welcomeMessages[1]] : []),
    ...(welcomeStep >= 3 ? [welcomeMessages[2]] : []),
    ...(welcomeStep >= 4 ? [welcomeMessages[3]] : []),
    ...(selectedButton ? [welcomeMessages[4]] : [])
  ];

  // Combine welcome messages with actual messages (only for new visits)
  const allMessages = currentFields.isReused === true 
    ? messages 
    : [
        ...visibleWelcomeMessages,
        ...messages
      ];

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingClients.length, welcomeStep, selectedButton, redirectSwapped]);

  return (
    <div style={styles.container(!!hasInviteHeader, hasOverlay)}>
      <style>{TYPING_KEYFRAMES}</style>

      {allMessages && allMessages.length > 0 && (
        allMessages.map((message, index) => {
          // Skip welcome messages if they're fake (check by id prefix)
          const isWelcomeMessage = message.id?.startsWith('welcome-');
          
          // For welcome messages, render them as regular messages (right-aligned, no avatar)
          if (isWelcomeMessage) {
            const isVisitor = true; // Welcome messages are right-aligned like visitor messages
            const nextMessage = allMessages[index + 1];
            const hasButtons = message.metadata?.hasButtons === true;
            const isRedirect = message.metadata?.isRedirect === true;

            // Render message with buttons if it's welcome-4
            if (hasButtons) {
              // Get the index of this welcome message (0-3)
              const welcomeIndex = welcomeMessages.findIndex(m => m.id === message.id);
              const isVisible = welcomeStep > welcomeIndex;
              
              return (
                <div 
                  key={message.id} 
                  style={{
                    ...styles.messageWrapper(isVisitor),
                    ...styles.welcomeMessageWrapper(welcomeStep, welcomeIndex)
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    flexDirection: isVisitor ? 'row-reverse' : 'row',
                    width: '100%',
                    maxWidth: '100%'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      background: 'transparent'
                    }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            if (selectedButton || currentFields.isReused) return;
                            setSelectedButton('chat');
                            onChatOpen?.();
                          }}
                          disabled={selectedButton !== null || currentFields.isReused === true}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: '9999px',
                            border: 'none',
                            background: selectedButton === 'chat' 
                              ? 'hsl(var(--special))' 
                              : selectedButton === 'call'
                              ? 'hsl(var(--special) / 0.5)'
                              : 'hsl(var(--special))',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: (selectedButton || currentFields.isReused) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                            fontFamily: 'inherit',
                            opacity: selectedButton && selectedButton !== 'chat' ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <MessageSquare size={16} />
                          <span>Chat</span>
                        </button>
                        <button
                          onClick={() => {
                            if (selectedButton || currentFields.isReused) return;
                            setSelectedButton('call');
                            onCallClick?.();
                            onChatOpen?.();
                          }}
                          disabled={selectedButton !== null || currentFields.isReused === true}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: '9999px',
                            border: 'none',
                            background: selectedButton === 'call'
                              ? 'hsl(var(--special))'
                              : selectedButton === 'chat'
                              ? 'hsl(var(--special) / 0.5)'
                              : 'hsl(var(--special))',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: (selectedButton || currentFields.isReused) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                            fontFamily: 'inherit',
                            opacity: selectedButton && selectedButton !== 'call' ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Phone size={16} />
                          <span>Call</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // For redirect welcome (welcome-5) and the first three welcome messages, use the same container
            const welcomeIndex = welcomeMessages.findIndex(m => m.id === message.id);
            const isVisible = welcomeStep > welcomeIndex;
            const isLastWelcomeMessage = message.id === 'welcome-4' || 
              (welcomeIndex === welcomeMessages.length - 1 && !nextMessage?.id?.startsWith('welcome-'));
            
            return (
              <div 
                key={message.id} 
                style={{
                  ...styles.messageWrapper(isVisitor),
                  ...(isRedirect ? {} : styles.welcomeMessageWrapper(welcomeStep, welcomeIndex)),
                  marginBottom: isLastWelcomeMessage ? '-8px' : undefined
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px',
                  flexDirection: isVisitor ? 'row-reverse' : 'row',
                  width: '100%',
                  maxWidth: '100%'
                }}>
                  <div style={{ ...styles.messageBubble(isVisitor, false), maxWidth: '100%' }}>
                    {isRedirect ? (
                      redirectSwapped ? (
                        <span>Human agent has been notified and will join shortly</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                          <span>Redirecting to a real person</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {[0, 0.1, 0.2, 0.3].map((delay) => (
                              <div key={delay} style={styles.typingBar(delay)} />
                            ))}
                          </div>
                        </div>
                      )
                    ) : (
                      message.text || message.data
                    )}
                  </div>
                </div>
              </div>
            );
          }
          
          // Continue with existing message rendering logic for real messages
          const isSystemMessage =
            message.metadata?.type === 'system' || 
            message.metadata?.eventType === 'joined' ||
            message.metadata?.eventType === 'ended';

          if (message.metadata?.eventType === 'joined') {
            return (
              <div key={message.id} style={styles.joinedMessageWrapper}>
                <div style={styles.joinedMessageContainer}>
                  <Avatar userName={message.metadata?.userName} userImage={message.metadata?.userImage} />
                  <div style={styles.joinedMessageText}>
                    {message.text}
                  </div>
                </div>
              </div>
            );
          }


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
          const nextMessage = allMessages[index + 1];
          const isLastFromUser = !nextMessage || 
            (nextMessage.clientId?.startsWith('embed-') !== isVisitor) ||
            (nextMessage.metadata?.type === 'system' || nextMessage.metadata?.eventType === 'joined') ||
            nextMessage.id?.startsWith('welcome-');
          
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

