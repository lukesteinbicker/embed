import { useEffect } from 'react';
import { VisitorData, VisitorFields } from '../types';

interface UsePageVisibilityProps {
  visitorData: VisitorData | null;
  currentFields: VisitorFields;
  updateVisitFields: (fields: any) => Promise<void>;
}

export function usePageVisibility({ visitorData, currentFields, updateVisitFields }: UsePageVisibilityProps) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      const inCall = !!currentFields.dailyRoomId;
      // Never change activity while in a call
      if (inCall) return;
      // Do not mark inactive if user has joined (waiting state)
      const isWaiting = !inCall && currentFields.joined;
      if (document.hidden && currentFields.active && !isWaiting) {
        updateVisitFields({ active: false });
      } else if (!document.hidden && !currentFields.active && !currentFields.joined) {
        updateVisitFields({ active: true });
      }
    };

    const handlePageHide = () => {
      // Always end the session when page is hidden, regardless of call state
      if (visitorData) {
        updateVisitFields({ 
          endedAt: new Date().toISOString(),
          active: false 
        });
      }
    };

    const handleBeforeUnload = () => {
      // Always end the session when page is unloaded, regardless of call state
      if (visitorData) {
        updateVisitFields({ 
          endedAt: new Date().toISOString(),
          active: false 
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [visitorData, currentFields, updateVisitFields]);
}
