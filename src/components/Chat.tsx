// @ts-nocheck
import React, { useEffect, useState } from 'react';
import * as Ably from 'ably';
import { ChatClient, LogLevel } from '@ably/chat';
import { AblyProvider } from 'ably/react';
import { ChatClientProvider, ChatRoomProvider } from '@ably/chat/react';
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
export function Chat({ chatRoomId, visitorData, currentFields, onCallClick, onCancelClick, onCloseClick }: ChatProps & {
  currentFields: any;
  onCallClick: () => void;
  onCancelClick: () => void;
  onCloseClick: () => void;
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
      height: '250px',
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
              currentFields={currentFields}
              onCallClick={onCallClick}
              onCancelClick={onCancelClick}
              onCloseClick={onCloseClick}
              visitorData={visitorData}
            />
          </ChatRoomProvider>
        </ChatClientProvider>
      </AblyProvider>
    </div>
  );
}