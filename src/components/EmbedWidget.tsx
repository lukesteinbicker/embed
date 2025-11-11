import React, { useState, useEffect } from 'react';
import { VideoCall } from './VideoCall';
import { Chat } from './Chat';
import { useVisitorData } from '../hooks/useVisitorData';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { DailyProvider, useDaily } from '@daily-co/daily-react';
import { X } from 'lucide-react';

// Component to access Daily instance and cleanup when visit ends
function DailyCleanup({ sessionEndedAt }: { sessionEndedAt: string | null | undefined }) {
  const daily = useDaily();
  
  useEffect(() => {
    if (sessionEndedAt && daily) {
      console.log('Visit ended, stopping camera/mic and leaving room');
      daily.setLocalAudio(false);
      daily.setLocalVideo(false);
      daily.leave();
    }
  }, [sessionEndedAt, daily]);
  
  return null;
}

export function EmbedWidget() {
  const { visitorData, currentFields, isInitialized, updateVisitFields } = useVisitorData();
  const [inviteInfo, setInviteInfo] = useState<{ showInvite: boolean; onAccept: () => void; onDecline: () => void } | null>(null);
  const [videoFrame, setVideoFrame] = useState<React.ReactNode>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [videoControls, setVideoControls] = useState<{ isVideoEnabled: boolean; isMicEnabled: boolean; onToggleMic: () => void; onToggleVideo: () => void } | null>(null);

  usePageVisibility({
    visitorData,
    currentFields,
    updateVisitFields,
  });

  const handleCallClick = () => {
    const inCall = !!currentFields.dailyRoomId;
    console.log('Call button clicked - inCall:', inCall, 'joined:', currentFields.joined);
    if (!currentFields.joined) {
      console.log('Setting joined to true');
      setIsConnecting(true);
      updateVisitFields({ joined: true });
    }
  };

  const handleCancelClick = () => {
    const inCall = !!currentFields.dailyRoomId;
    if (isConnecting) {
      setIsConnecting(false);
      if (currentFields.joined) {
        updateVisitFields({ joined: false });
      }
    } else if (!inCall && currentFields.joined) {
      updateVisitFields({ joined: false });
    }
  };

  const handleJoined = () => {
    if (currentFields.dailyRoomId && !currentFields.joined) {
      updateVisitFields({ joined: true });
    }
  };

  // Reset connecting state when call actually starts (dailyRoomId is set)
  useEffect(() => {
    if (currentFields.dailyRoomId && isConnecting) {
      setIsConnecting(false);
    }
  }, [currentFields.dailyRoomId, isConnecting]);

  const handleEndCall = () => {
    if (currentFields.dailyRoomId || currentFields.joined) {
      updateVisitFields({ 
        dailyRoomId: null,
        joined: false 
      });
    }
  };

  const handleCloseClick = () => {
    if (!visitorData) return;
    
    // Immediately hide the embed
    const embedElement = document.querySelector('[id^="embed-widget-"]') as HTMLElement;
    if (embedElement) {
      embedElement.style.display = 'none';
    }
    
    // End the visit (cleanup will happen automatically via VideoCall useEffect)
    if (!currentFields.sessionEndedAt) {
      updateVisitFields({ 
        endedAt: new Date().toISOString(),
        active: false 
      });
    }
  };

  // Only hide if not initialized, no visitor data, or visit has ended
  if (!isInitialized || !visitorData || currentFields.sessionEndedAt) {
    // Keep DailyProvider mounted briefly when visit ends to allow cleanup
    if (currentFields.sessionEndedAt) {
      return (
        <DailyProvider>
          <DailyCleanup sessionEndedAt={currentFields.sessionEndedAt} />
        </DailyProvider>
      );
    }
    return null;
  }

  const showCloseButton = !currentFields.sessionEndedAt;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
      position: 'relative',
      alignItems: 'stretch'
    }}>
      {/* Close button - positioned at top-right corner of entire embed */}
      {showCloseButton && (
        <button
          onClick={handleCloseClick}
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            zIndex: 100000,
            padding: '6px 8px',
            borderRadius: '50%',
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: 'none',
            cursor: 'pointer',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <X size={20} />
        </button>
      )}
      
      <DailyProvider>
        <DailyCleanup sessionEndedAt={currentFields.sessionEndedAt} />
        <VideoCall
          currentFields={currentFields}
          visitorData={visitorData}
          onJoined={handleJoined}
          onAcceptCall={handleCallClick}
          onInviteInfo={setInviteInfo}
          renderVideoFrame={setVideoFrame}
          isConnecting={isConnecting}
          onVideoControls={setVideoControls}
          claimedUserName={currentFields.claimedUserName}
          claimedUserImage={currentFields.claimedUserImage}
        />
        <Chat
          chatRoomId={currentFields.chatRoomId}
          visitorData={visitorData}
          currentFields={currentFields}
          onCallClick={handleCallClick}
          onCancelClick={handleCancelClick}
          onCloseClick={handleCloseClick}
          inviteInfo={inviteInfo}
          videoFrame={videoFrame}
          isConnecting={isConnecting}
          videoControls={videoControls}
          onEndCall={handleEndCall}
        />
      </DailyProvider>
    </div>
  );
}