// @ts-nocheck
import React, { useCallback, useEffect, useState, useRef } from 'react';
import * as Ably from 'ably';
import { ChatClient, LogLevel } from '@ably/chat';
import { AblyProvider } from 'ably/react';
import { ChatClientProvider } from '@ably/chat/react';
import { EMBED_CONFIG } from '../config';
import {
  ChatRoomProvider,
  useChatConnection,
  useMessages,
  usePresence,
  usePresenceListener,
  useRoom
} from '@ably/chat/react';

interface ChatProps {
  chatRoomId: string | null;
  visitorData: {
    visitorId: string;
    sessionId: string;
    companyId: string;
    token: string;
  };
}

// Presence component - following Ably guide exactly
function PresenceStatus() {
  const presence = usePresence();
  const presenceListener = usePresenceListener();

  useEffect(() => {
    if (presenceListener && typeof presenceListener.enterPresence === 'function') {
      presenceListener.enterPresence();
      return () => {
        if (presenceListener && typeof presenceListener.leavePresence === 'function') {
          presenceListener.leavePresence();
        }
      };
    }
  }, [presenceListener]);

  return null; // Hidden but still manages presence
}

// Messages component - following Ably guide exactly
function MessagesList({ currentFields }) {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  
  // Check if visit is completed
  const isVisitCompleted = !!currentFields.sessionEndedAt;
  
  // Use useMessages hook with listener for real-time updates
  const messagesHook = useMessages({
    listener: (messageEvent) => {
      console.log('New message received:', messageEvent);
      setMessages(prevMessages => [...prevMessages, messageEvent.message]);
    }
  });

  console.log('MessagesList render - messagesHook object:', messagesHook);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get initial message history when room is attached
  useEffect(() => {
    if (messagesHook.roomStatus === 'attached') {
      console.log('Setting up message listener...');
      
      // Get initial message history
      messagesHook.history({
        direction: 'backwards',
        limit: 50
      }).then((history) => {
        console.log('Initial message history:', history);
        if (history && history.items) {
          // Reverse the order so newest messages appear at bottom
          setMessages(history.items.reverse());
        }
      }).catch((error) => {
        console.error('Error getting message history:', error);
      });
    }
  }, [messagesHook.roomStatus]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minHeight: 0 // Important for flex overflow
    }}>
      {/* Header text */}
      <div style={{
        textAlign: 'center',
        color: 'hsl(var(--foreground))',
        fontSize: '13px',
        padding: '8px 0',
        fontWeight: '500'
      }}>
        <>Talk to a <span style={{ textDecoration: 'underline' }}>real person</span> in seconds</>
      </div>
      
      {/* Show actual messages */}
      {messages && messages.length > 0 && (
        messages.map((message) => (
          <div key={message.id} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: message.clientId?.startsWith('embed-') ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              backgroundColor: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              padding: '6px 12px',
              borderRadius: '16px',
              maxWidth: '80%',
              wordWrap: 'break-word',
              border: '1px solid hsl(var(--border) / 0.3)',
              fontSize: '13px'
            }}>
              {message.text || message.data}
            </div>
          </div>
        ))
      )}
      
      {/* Visit completed message at bottom */}
      {isVisitCompleted && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '8px'
        }}>
          <div style={{
        textAlign: 'center',
        color: 'hsl(var(--foreground))',
        fontSize: '13px',
        padding: '8px 0',
        fontWeight: '500'
      }}>
            Visit completed
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}

// Message input component - following Ably guide exactly
function MessageInput({ currentFields }) {
  const [messageText, setMessageText] = useState('');
  const messages = useMessages();
  
  // Check if visit is completed
  const isVisitCompleted = !!currentFields.sessionEndedAt;

  const handleSendMessage = useCallback(async () => {
    if (messageText.trim() && !isVisitCompleted) {
      try {
        console.log('Sending message:', messageText.trim());
        console.log('Messages object before send:', messages);
        const result = await messages.sendMessage({ text: messageText.trim() });
        console.log('Message send result:', result);
        setMessageText('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }, [messageText, messages, isVisitCompleted]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div style={{
      padding: '12px',
      display: 'flex',
      gap: '8px',
      backgroundColor: 'transparent',
      flexShrink: 0 // Prevent shrinking
    }}>
      <textarea
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Message..."
        disabled={isVisitCompleted}
        style={{
          flex: 1,
          padding: '6px 12px',
          border: '1px solid hsl(var(--border) / 0.3)',
          borderRadius: '16px',
          resize: 'none',
          fontSize: '13px',
          fontFamily: 'inherit',
          outline: 'none',
          backgroundColor: isVisitCompleted ? 'hsl(var(--muted))' : 'hsl(var(--background))',
          color: isVisitCompleted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
          cursor: isVisitCompleted ? 'not-allowed' : 'text'
        }}
        rows={1}
      />
      <button 
        onClick={handleSendMessage}
        disabled={isVisitCompleted}
        style={{
          padding: '6px 12px',
          backgroundColor: isVisitCompleted ? 'hsl(var(--muted))' : 'hsl(var(--background))',
          color: isVisitCompleted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border) / 0.3)',
          borderRadius: '16px',
          cursor: isVisitCompleted ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: '500'
        }}
      >
        →
      </button>
    </div>
  );
}

// Call button component with exact styling from old embed
function CallButtonSection({ currentFields, onCallClick, onCancelClick }) {
  const isEnded = !!currentFields.sessionEndedAt;
  const isInCall = !!currentFields.dailyRoomId && !isEnded;
  const hasJoined = !!currentFields.joined;

  if (isEnded || isInCall) {
    return null; // Hide when ended or in call
  }

  return (
    <div style={{
      padding: '2px 8px',
      backgroundColor: 'transparent',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: '8px',
      flexShrink: 0 // Prevent shrinking
    }}>
      {!isInCall && hasJoined && (
        <button
          onClick={onCancelClick}
        style={{
          padding: '6px 8px',
          borderRadius: '16px',
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border) / 0.3)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
          transition: 'all 0.2s ease',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ×
        </button>
      )}
      
      <button
        onClick={onCallClick}
        style={{
          padding: '6px 12px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, hsl(var(--foreground) / 0.9), hsl(var(--foreground) / 0.7))',
          color: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border) / 0.3)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
          transition: 'all 0.2s ease',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
          minWidth: '80px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {hasJoined && !isInCall ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <div 
              style={{
                width: '12px',
                height: '12px',
                border: '2px solid hsl(var(--background) / 0.3)',
                borderTop: '2px solid hsl(var(--background))',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span>Calling</span>
          </div>
        ) : (
          'Call now'
        )}
      </button>
    </div>
  );
}

// Chat room component that uses all the hooks - following Ably guide exactly
function ChatRoom({ chatRoomId, currentFields, onCallClick, onCancelClick, isCollapsed, onToggleCollapse }) {
  const isInCall = !!currentFields.dailyRoomId && !currentFields.sessionEndedAt;
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden', // Ensure proper clipping
      position: 'relative'
    }}>
      
      <PresenceStatus />
      
      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          <MessagesList currentFields={currentFields} />
          <CallButtonSection currentFields={currentFields} onCallClick={onCallClick} onCancelClick={onCancelClick} />
        </>
      )}
      
      {/* Message input - always visible, clickable to expand when collapsed */}
      <div 
        onClick={isCollapsed ? onToggleCollapse : undefined}
        style={{ cursor: isCollapsed ? 'pointer' : 'default' }}
      >
        <MessageInput currentFields={currentFields} />
      </div>
      
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

// Main chat component with its own Ably providers - following Ably guide exactly
export function Chat({ chatRoomId, visitorData, currentFields, onCallClick, onCancelClick }: ChatProps & {
  currentFields: any;
  onCallClick: () => void;
  onCancelClick: () => void;
}) {
  const [ablyClients, setAblyClients] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Auto-collapse when in call
  useEffect(() => {
    const isInCall = !!currentFields.dailyRoomId && !currentFields.sessionEndedAt;
    if (isInCall) {
      setIsCollapsed(true);
    }
  }, [currentFields.dailyRoomId, currentFields.sessionEndedAt]);

  useEffect(() => {
    if (!chatRoomId || !visitorData) return;

    // Create Ably clients with token auth - following Ably guide exactly
    const realtimeClient = new Ably.Realtime({
      authCallback: async (_tokenParams, callback) => {
        try {
          console.log('Requesting Ably token for visitor:', visitorData.visitorId);
          const response = await fetch(`${EMBED_CONFIG.API_BASE}/api/ably/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              visitorId: visitorData.visitorId,
              sessionId: visitorData.sessionId,
              companyId: visitorData.companyId,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to get token');
          }

          const tokenRequest = await response.json();
          console.log('Received Ably token request:', !!tokenRequest);
          callback(null, tokenRequest);
        } catch (error) {
          console.error('Token auth error:', error);
          callback(String(error), null);
        }
      },
      clientId: `embed-${visitorData.visitorId}`,
    });

    const chatClient = new ChatClient(realtimeClient, {
      logLevel: LogLevel.Info,
    });

    setAblyClients({ realtimeClient, chatClient });

    // Cleanup on unmount
    return () => {
      realtimeClient.connection.close();
    };
  }, [chatRoomId, visitorData]);

  if (!chatRoomId || !visitorData || !ablyClients) {
    return (
      <div style={{
        width: '100%',
        height: '250px',
        backgroundColor: 'hsl(var(--background) / 0.7)',
        border: '1px solid hsl(var(--border))',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)'
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          color: 'hsl(var(--muted-foreground))'
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {!chatRoomId || !visitorData ? 'Initializing...' : 'Connecting to chat...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: isCollapsed ? 'auto' : '250px',
      backgroundColor: 'hsl(var(--background) / 0.7)',
      border: '1px solid hsl(var(--border) / 0.3)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)'
    }}>
      
      {/* Following Ably guide exactly - providers around the room */}
      <AblyProvider client={ablyClients.realtimeClient}>
        <ChatClientProvider client={ablyClients.chatClient}>
          <ChatRoomProvider name={chatRoomId}>
            <ChatRoom 
              chatRoomId={chatRoomId} 
              currentFields={currentFields}
              onCallClick={onCallClick}
              onCancelClick={onCancelClick}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />
          </ChatRoomProvider>
        </ChatClientProvider>
      </AblyProvider>
    </div>
  );
}