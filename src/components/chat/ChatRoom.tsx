// @ts-nocheck
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
  hasInviteHeader?: boolean;
}

const styles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  }
} as const;

export function ChatRoom({
  currentFields,
  onCallClick,
  onCancelClick,
  onCloseClick,
  visitorData,
  hasInviteHeader
}: ChatRoomProps) {
  const visitorClientId = visitorData ? `embed-${visitorData.visitorId}` : undefined;

  return (
    <div style={styles.root}>
      <PresenceStatus />

      <MessagesList
        currentFields={currentFields}
        visitorClientId={visitorClientId}
        hasInviteHeader={hasInviteHeader}
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

