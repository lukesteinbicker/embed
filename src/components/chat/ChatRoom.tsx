// @ts-nocheck
import { useState } from 'react';
import { PhoneOff, Phone } from 'lucide-react';
import { PresenceStatus } from './PresenceStatus';
import { MessagesList } from './MessagesList';
import { MessageInput } from './MessageInput';

interface ChatRoomProps {
  currentFields: any;
  onCallClick: () => void;
  onCancelClick: () => void;
  onCloseClick: () => void;
  visitorData?: {
    visitorId: string;
  } | null;
}

const styles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '12px 16px',
    background: 'hsl(var(--background))',
    borderBottom: '1px solid hsl(var(--border) / 0.3)',
    zIndex: 20
  },
  overlayButton: (isPrimary: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    borderRadius: '20px',
    background: isPrimary ? 'hsl(var(--constructive))' : 'hsl(var(--background))',
    color: isPrimary ? 'hsl(var(--constructive-foreground))' : 'hsl(var(--foreground))',
    border: isPrimary ? '1px solid hsl(var(--foreground) / 0.06)' : '1px solid hsl(var(--border) / 0.6)',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 700,
    boxShadow: isPrimary ? '0 2px 8px hsl(var(--foreground) / 0.15)' : undefined
  })
} as const;

export function ChatRoom({
  currentFields,
  onCallClick,
  onCancelClick,
  onCloseClick,
  visitorData
}: ChatRoomProps) {
  const isInCall = !!currentFields.dailyRoomId && !currentFields.sessionEndedAt;
  const hasJoined = !!currentFields.joined;
  const [declined, setDeclined] = useState<boolean>((window as any).__embedDeclined || false);
  const visitorClientId = visitorData ? `embed-${visitorData.visitorId}` : undefined;

  return (
    <div style={styles.root}>
      {isInCall && !hasJoined && !declined && (
        <div style={styles.overlay}>
          <button
            onClick={onCallClick}
            style={styles.overlayButton(true)}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Phone className="w-4 h-4" />
              Accept
            </div>
          </button>
          <button
            onClick={() => {
              (window as any).__embedDeclined = true;
              window.dispatchEvent(new CustomEvent('embed-declined'));
              setDeclined(true);
            }}
            style={styles.overlayButton(false)}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PhoneOff className="w-4 h-4" />
              Decline
            </div>
          </button>
        </div>
      )}

      <PresenceStatus />

        <MessagesList
          currentFields={currentFields}
          headerHeight={isInCall && !hasJoined && !declined ? 56 : 0}
          visitorClientId={visitorClientId}
        />
        <MessageInput
          currentFields={currentFields}
          onCallClick={onCallClick}
          onCancelClick={onCancelClick}
          onCloseClick={onCloseClick}
        />
    </div>
  );
}

