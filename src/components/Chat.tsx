// @ts-nocheck
import React, { useEffect, useState } from 'react';
import * as Ably from 'ably';
import { ChatClient, LogLevel } from '@ably/chat';
import { AblyProvider } from 'ably/react';
import { ChatClientProvider, ChatRoomProvider } from '@ably/chat/react';
import { Phone, PhoneOff, X } from 'lucide-react';
import { EMBED_CONFIG } from '../config';
import { ChatRoom } from './chat/ChatRoom';

interface ChatProps {
  chatRoomId: string | null;
  visitorData: {
    visitorId: string;
    sessionId: string;
    companyId: string;
    token: string;
  };
}

// Main chat component with its own Ably providers - following Ably guide exactly
export function Chat({ chatRoomId, visitorData, currentFields, onCallClick, onCancelClick, onCloseClick, inviteInfo, videoFrame }: ChatProps & {
  currentFields: any;
  onCallClick: () => void;
  onCancelClick: () => void;
  onCloseClick: () => void;
  inviteInfo?: { showInvite: boolean; onAccept: () => void; onDecline: () => void } | null;
  videoFrame?: React.ReactNode;
}) {
  const [ablyClients, setAblyClients] = useState(null);
  
  // Don't auto-collapse when call starts - keep chat visible

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
        height: '360px',
        minHeight: '360px',
        maxHeight: '360px',
        flexShrink: 0,
        flexGrow: 0,
        backgroundColor: 'hsl(var(--background))',
        borderRadius: '24px',
        boxShadow: '0 24px 48px hsl(var(--foreground) / 0.12), 0 10px 20px hsl(var(--foreground) / 0.08)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden'
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
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
      minHeight: '360px',
      flexShrink: 0,
      flexGrow: 0,
      backgroundColor: 'hsl(var(--background))',
      borderRadius: '24px',
      boxShadow: '0 24px 48px hsl(var(--foreground) / 0.12), 0 10px 20px hsl(var(--foreground) / 0.08)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Video frame at top when present */}
      {videoFrame && (
        <div style={{
          width: '100%',
          flexShrink: 0,
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          overflow: 'hidden'
        }}>
          {videoFrame}
        </div>
      )}
      
      {/* Accept/Decline buttons overlay - positioned below video, rounded corners extend up into video */}
      {inviteInfo?.showInvite && (
        <div
          style={{
            position: 'absolute',
            top: '170px',
            left: 0,
            right: 0,
            display: 'flex',
            gap: '12px',
            background: 'hsl(var(--background))',
            alignItems: 'flex-start',
            padding: '6px',
            boxSizing: 'border-box',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            zIndex: 1000,
            pointerEvents: 'auto'
          }}
        >
          <button
            onClick={inviteInfo.onAccept}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '14px 18px',
              borderRadius: '18px',
              background: 'linear-gradient(to bottom, hsl(var(--constructive)), hsl(var(--constructive) / 0.85))',
              color: 'hsl(var(--constructive-foreground))',
              border: '1px solid hsl(var(--constructive-foreground) / 0.25)',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              boxShadow: '0 2px 4px hsl(var(--constructive) / 0.2)'
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Phone size={16} />
            <span>Accept call</span>
          </button>
          <button
            onClick={inviteInfo.onDecline}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '14px 18px',
              borderRadius: '18px',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border) / 0.6)',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <PhoneOff size={16} />
            <span>Decline</span>
          </button>
        </div>
      )}
      
      {/* Chat room container - always 360px */}
      <div style={{
        width: '100%',
        height: '360px',
        flexShrink: 0,
        flexGrow: 0
      }}>
        {/* Following Ably guide exactly - providers around the room */}
        <AblyProvider client={ablyClients.realtimeClient}>
          <ChatClientProvider client={ablyClients.chatClient}>
            <ChatRoomProvider name={chatRoomId}>
              <ChatRoom 
                currentFields={currentFields}
                onCallClick={onCallClick}
                onCancelClick={onCancelClick}
                onCloseClick={onCloseClick}
                visitorData={visitorData}
                hasInviteHeader={!!inviteInfo?.showInvite}
              />
            </ChatRoomProvider>
          </ChatClientProvider>
        </AblyProvider>
      </div>
    </div>
  );
}