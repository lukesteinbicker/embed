// @ts-nocheck
import React, { useEffect, useState } from 'react';
import * as Ably from 'ably';
import { ChatClient, LogLevel } from '@ably/chat';
import { AblyProvider } from 'ably/react';
import { ChatClientProvider, ChatRoomProvider } from '@ably/chat/react';
import { Phone, PhoneOff, X, Mic, MicOff, Video, VideoOff, MessageSquare } from 'lucide-react';
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
export function Chat({ chatRoomId, visitorData, currentFields, onCallClick, onCancelClick, onCloseClick, inviteInfo, videoFrame, isConnecting, videoControls, onEndCall }: ChatProps & {
  currentFields: any;
  onCallClick: () => void;
  onCancelClick: () => void;
  onCloseClick: () => void;
  inviteInfo?: { showInvite: boolean; onAccept: () => void; onDecline: () => void } | null;
  videoFrame?: React.ReactNode;
  isConnecting?: boolean;
  videoControls?: { isVideoEnabled: boolean; isMicEnabled: boolean; onToggleMic: () => void; onToggleVideo: () => void } | null;
  onEndCall?: () => void;
}) {
  const [ablyClients, setAblyClients] = useState(null);
  const [showChatInput, setShowChatInput] = useState(currentFields.isReused === true);
  const [isVideoFrameExiting, setIsVideoFrameExiting] = useState(false);
  const [isVideoFrameEntering, setIsVideoFrameEntering] = useState(false);
  const [exitingVideoFrame, setExitingVideoFrame] = useState<React.ReactNode>(null);
  const hasAnimatedRef = React.useRef(false);
  
  useEffect(() => {
    if (currentFields.isReused === true) {
      setShowChatInput(true);
    }
  }, [currentFields.isReused]);
  
  // Video frame animations - only animate once when first appearing
  useEffect(() => {
    if (!videoFrame) {
      // Reset animation flag when video frame disappears
      hasAnimatedRef.current = false;
      return;
    }
    
    // Only animate if we haven't animated yet and it's not a reused visit
    if (!hasAnimatedRef.current && !isVideoFrameEntering && !isVideoFrameExiting && currentFields.isReused !== true) {
      hasAnimatedRef.current = true;
      setIsVideoFrameEntering(true);
      setTimeout(() => setIsVideoFrameEntering(false), 500);
    }
  }, [!!videoFrame, currentFields.isReused, isVideoFrameEntering, isVideoFrameExiting]);
  
  const handleCancelWithAnimation = () => {
    if (videoFrame) {
      setExitingVideoFrame(videoFrame);
      setIsVideoFrameExiting(true);
      setIsVideoFrameEntering(false);
      setTimeout(() => {
        setIsVideoFrameExiting(false);
        setExitingVideoFrame(null);
        onCancelClick();
      }, 500);
    } else {
      onCancelClick();
    }
  };
  
  const hasOverlay = !!(inviteInfo?.showInvite || (isConnecting && videoFrame) || videoControls);

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
        height: '320px',
        minHeight: '320px',
        maxHeight: '320px',
        flexShrink: 0,
        flexGrow: 0,
        backgroundColor: 'hsl(var(--background))',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden'
      }} />
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '320px',
      flexShrink: 0,
      flexGrow: 0,
      backgroundColor: 'transparent',
      borderRadius: '24px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Video frame at top when present */}
      {videoFrame && !isVideoFrameExiting && (
        <div 
          className={`video-frame-container ${isVideoFrameEntering && currentFields.isReused !== true ? 'entering' : ''}`}
          style={{
            width: '100%',
            flexShrink: 0,
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            overflow: 'hidden'
          }}
        >
          {videoFrame}
        </div>
      )}
      
      {/* Video frame exit animation placeholder */}
      {isVideoFrameExiting && exitingVideoFrame && (
        <div 
          className="video-frame-container exiting"
          style={{
            width: '100%',
            flexShrink: 0,
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            overflow: 'hidden'
          }}
        >
          {exitingVideoFrame}
        </div>
      )}
      
      <style>{`
        .video-frame-container {
          max-height: 192px;
          opacity: 1;
          transform: translateY(0);
        }
        
        .video-frame-container.entering {
          max-height: 0;
          opacity: 0;
          transform: translateY(100%);
          animation: slideUpFromBottom 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .video-frame-container.exiting {
          animation: slideDownToBottom 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        @keyframes slideUpFromBottom {
          from {
            max-height: 0;
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            max-height: 192px;
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideDownToBottom {
          from {
            max-height: 192px;
            opacity: 1;
            transform: translateY(0);
          }
          to {
            max-height: 0;
            opacity: 0;
            transform: translateY(100%);
          }
        }
      `}</style>
      
       {/* Chat room container - fixed height */}
       <div style={{
         width: '100%',
         height: '320px', // Fixed height - same at all times
         flexShrink: 0,
         flexGrow: 0,
         background: 'hsl(var(--background) / 0.7)',
         backdropFilter: 'blur(20px) saturate(180%)',
         WebkitBackdropFilter: 'blur(20px) saturate(180%)',
         borderRadius: videoFrame ? '0 0 24px 24px' : '24px', // Rounded bottom if video frame present, all around if not
         overflow: 'visible',
         position: 'relative',
       }}>
        {/* Overlay - shows invite buttons, cancel button, or video controls */}
        {hasOverlay && (
          <div
            style={{
              position: 'absolute',
              top: '-24px',
              left: 0,
              right: 0,
              display: 'flex',
              gap: '12px',
              background: 'hsl(var(--background))',
              alignItems: inviteInfo?.showInvite || (isConnecting && videoFrame) ? 'flex-start' : 'center',
              justifyContent: videoControls ? 'center' : 'flex-start',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '24px 24px 0 0',
              zIndex: 1000,
              pointerEvents: 'none',
              height: 'fit-content',
              borderBottom: '1px solid hsl(var(--border) / 0.3)'
            }}
          >
            {/* Accept/Decline buttons */}
            {inviteInfo?.showInvite && (
              <>
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
                    pointerEvents: 'auto'
                  }}
                >
                  <Phone size={16} />
                  <span>Accept</span>
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
                    pointerEvents: 'auto'
                  }}
                >
                  <PhoneOff size={16} />
                  <span>Decline</span>
                </button>
              </>
            )}
            
            {/* Cancel button */}
            {isConnecting && videoFrame && !inviteInfo?.showInvite && (
              <button
                onClick={handleCancelWithAnimation}
                style={{
                  width: '100%',
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
                  pointerEvents: 'auto'
                }}
              >
                <span>Cancel</span>
              </button>
            )}
            
            {/* Video controls */}
            {videoControls && !inviteInfo?.showInvite && !(isConnecting && videoFrame) && (
              <>
              <button
                  style={{
                    flex: 1,
                    height: '48px',
                    borderRadius: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'hsl(var(--muted))',
                    color: 'hsl(var(--foreground))',
                    cursor: 'pointer',
                    pointerEvents: 'auto'
                  }}
                >
                  <MessageSquare size={20} />
                </button>
                <button
                  onClick={videoControls.onToggleMic}
                  style={{
                    flex: 1,
                    height: '48px',
                    borderRadius: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'hsl(var(--background))',
                    color: videoControls.isMicEnabled ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    opacity: videoControls.isMicEnabled ? 1 : 0.6,
                    pointerEvents: 'auto'
                  }}
                >
                  {videoControls.isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  onClick={videoControls.onToggleVideo}
                  style={{
                    flex: 1,
                    height: '48px',
                    borderRadius: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'hsl(var(--background))',
                    color: videoControls.isVideoEnabled ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    opacity: videoControls.isVideoEnabled ? 1 : 0.6,
                    pointerEvents: 'auto'
                  }}
                >
                  {videoControls.isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                {onEndCall && (
                  <button
                    onClick={onEndCall}
                    style={{
                      flex: 1,
                      height: '48px',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'hsl(var(--destructive))',
                      color: 'hsl(var(--destructive-foreground))',
                      border: 'none',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
                    }}
                  >
                    <PhoneOff size={20} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
        
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
                showChatInput={showChatInput}
                onChatOpen={() => setShowChatInput(true)}
                isConnecting={isConnecting}
                hasOverlay={hasOverlay}
              />
            </ChatRoomProvider>
          </ChatClientProvider>
        </AblyProvider>
      </div>
    </div>
  );
}