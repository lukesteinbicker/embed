// @ts-nocheck
import { useEffect } from 'react';
import { usePresence, usePresenceListener } from '@ably/chat/react';

export function PresenceStatus() {
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

  return null;
}

