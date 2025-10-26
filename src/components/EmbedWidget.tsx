import { VideoCall } from './VideoCall';
import { Chat } from './Chat';
import { useVisitorData } from '../hooks/useVisitorData';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { DailyProvider } from '@daily-co/daily-react';

export function EmbedWidget() {
  const { visitorData, currentFields, isInitialized, updateVisitFields } = useVisitorData();

  usePageVisibility({
    visitorData,
    currentFields,
    updateVisitFields,
  });

  const handleCallClick = () => {
    const inCall = !!currentFields.dailyRoomId;
    console.log('Call button clicked - inCall:', inCall, 'joined:', currentFields.joined);
    if (!inCall && !currentFields.joined) {
      console.log('Setting joined to true and active to true');
      updateVisitFields({ joined: true, active: true, dailyRoomId: null });
    }
  };

  const handleCancelClick = () => {
    const inCall = !!currentFields.dailyRoomId;
    if (!inCall && currentFields.joined) {
      updateVisitFields({ joined: false });
    }
  };

  const handleJoined = () => {
    if (currentFields.dailyRoomId && !currentFields.joined) {
      updateVisitFields({ joined: true });
    }
  };

  const handleCloseClick = () => {
    if (!visitorData) return;
    
    // End the visit by setting sessionEndedAt
    updateVisitFields({ 
      endedAt: new Date().toISOString(),
      active: false 
    });
    
    // Immediately hide the embed after completing the visit
    const embedElement = document.querySelector('[id^="embed-widget-"]') as HTMLElement;
    if (embedElement) {
      embedElement.style.display = 'none';
    }
  };

  // Only hide if not initialized or no visitor data
  if (!isInitialized || !visitorData) {
    return null;
  }

  const showCloseButton = !currentFields.sessionEndedAt;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
      position: 'relative'
    }}>
      {/* Close button - positioned at top-right corner of entire embed */}
      {showCloseButton && (
        <button
          onClick={handleCloseClick}
          style={{
            position: 'absolute',
            top: '-12px',
            right: '-12px',
            zIndex: 1000,
            padding: '6px 8px',
            borderRadius: '50%',
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
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
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
      
      <DailyProvider>
        <VideoCall
          currentFields={currentFields}
          visitorData={visitorData}
          onJoined={handleJoined}
        />
        <Chat
          chatRoomId={currentFields.chatRoomId}
          visitorData={visitorData}
          currentFields={currentFields}
          onCallClick={handleCallClick}
          onCancelClick={handleCancelClick}
        />
      </DailyProvider>
    </div>
  );
}