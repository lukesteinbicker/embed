import { useState, useEffect, useCallback } from 'react';
import { VisitorData, VisitorFields, VisitStatus, EventSourceMessage } from '../types';
import { nanoid } from 'nanoid';
import { EMBED_CONFIG } from '../config';

export function useVisitorData() {
  const [visitorData, setVisitorData] = useState<VisitorData | null>(null);
  const [currentFields, setCurrentFields] = useState<VisitorFields>({
    active: false,
    joined: false,
    dailyRoomId: null,
    chatRoomId: null,
    sessionEndedAt: null
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Extract token from script tags
  const extractToken = useCallback(() => {
    const scripts = document.getElementsByTagName('script');
    
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.src && script.src.includes('embed.js')) {
        const url = new URL(script.src);
        const token = url.searchParams.get('token');
        if (token) return token;
      }
      if (script.dataset.token) {
        return script.dataset.token;
      }
    }
    return null;
  }, []);

  // Initialize visitor with token (token lookup happens server-side)
  const initializeVisitorWithToken = useCallback(async (token: string) => {
    let serviceVisitorId = localStorage.getItem('service_visitor_id');
    if (!serviceVisitorId) {
      serviceVisitorId = nanoid();
      localStorage.setItem('service_visitor_id', serviceVisitorId);
    }
    
    let sessionId = localStorage.getItem('current_session_id');
    if (!sessionId) {
      sessionId = nanoid();
      localStorage.setItem('current_session_id', sessionId);
    }
    
    const chatRoomId = `chat-${serviceVisitorId}-${sessionId}`;
    
    
    try {
      const response = await fetch(`${EMBED_CONFIG.API_BASE}/api/visitors/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitorId: serviceVisitorId,
          sessionId: sessionId,
          token: token, // Pass token instead of companyId
          chatRoomId: chatRoomId
        })
      });
      
      // If CORS blocks the request, response.json() will fail
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setVisitorData({
          visitorId: serviceVisitorId,
          sessionId,
          companyId: data.companyId, // Get companyId from response
          token
        });
        setIsInitialized(true);
        
        return {
          visitorId: serviceVisitorId,
          sessionId,
          companyId: data.companyId,
          token,
          visitData: data
        };
      }
      return null;
    } catch (error) {
      console.error('Error initializing visitor with token:', error);
      return null;
    }
  }, []);



  // Update visit fields
  const updateVisitFields = useCallback(async (fields: VisitStatus) => {
    if (!visitorData) return;
    
    const requestBody = JSON.stringify({ 
      visitorId: visitorData.visitorId, 
      sessionId: visitorData.sessionId, 
      companyId: visitorData.companyId, 
      ...fields 
    });
    
    try {
      const response = await fetch(`${EMBED_CONFIG.API_BASE}/api/visitors/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await response.json();
    } catch (error) {
      console.error('Error updating visit status:', error);
    }
  }, [visitorData]);

  // Subscribe to events
  const subscribeToEvents = useCallback((data?: VisitorData) => {
    const currentVisitorData = data || visitorData;
    if (!currentVisitorData || eventSource) {
      return;
    }
    
    const eventSourceUrl = `${EMBED_CONFIG.API_BASE}/api/visitors/events?visitorId=${encodeURIComponent(currentVisitorData.visitorId)}`;
    const es = new EventSource(eventSourceUrl);
    
    es.onmessage = function(event) {
      try {
        const data: EventSourceMessage = JSON.parse(event.data);
        
        if (data.type === 'visit_update') {
          setCurrentFields(prevFields => {
            const next = {
              active: 'active' in data ? !!data.active : prevFields.active,
              joined: 'joined' in data ? !!data.joined : prevFields.joined,
              dailyRoomId: 'dailyRoomId' in data ? (data.dailyRoomId || null) : prevFields.dailyRoomId,
              chatRoomId: 'chatRoomId' in data ? (data.chatRoomId || null) : prevFields.chatRoomId,
              sessionEndedAt: 'sessionEndedAt' in data ? (data.sessionEndedAt || null) : prevFields.sessionEndedAt,
            };
            
            // If the session has ended, immediately tear down UI and reset state
            if (next.sessionEndedAt) {
              return next;
            }
            
            return next;
          });
        }
      } catch (error) {
        console.error('EventSource message error:', error);
      }
    };
    
    es.onerror = function() {
      setTimeout(() => {
        if (es.readyState === EventSource.CLOSED) {
          setEventSource(null);
          subscribeToEvents();
        }
      }, 3000);
    };
    
    setEventSource(es);
  }, [visitorData, eventSource]);

  // Initialize the widget
  useEffect(() => {
    const token = extractToken();
    if (!token || isInitialized) return;

    const init = async () => {
      try {
        const visitorDataResult = await initializeVisitorWithToken(token);
        if (visitorDataResult) {
          // Use the visit data returned from initialization
          const visitData = visitorDataResult.visitData;
          if (visitData) {
            // Generate chat room ID if not provided by server
            const chatRoomId = visitData.chatRoomId || `chat-${visitorDataResult.visitorId}-${visitorDataResult.sessionId}`;
            setCurrentFields({
              active: !!visitData.active,
              joined: !!visitData.joined,
              dailyRoomId: visitData.dailyRoomId || null,
              chatRoomId: chatRoomId,
              sessionEndedAt: visitData.sessionEndedAt || null,
            });
          } else {
            // If no visit data, set default fields with generated chat room ID
            const chatRoomId = `chat-${visitorDataResult.visitorId}-${visitorDataResult.sessionId}`;
            setCurrentFields({
              active: true,
              joined: false,
              dailyRoomId: null,
              chatRoomId: chatRoomId,
              sessionEndedAt: null,
            });
          }
          // Now call subscribeToEvents directly since we have the visitorData
          subscribeToEvents(visitorDataResult);
        }
      } catch (error) {
        // Fail silently - if CORS blocks the request, just don't show the embed
      }
    };

    init();
  }, [extractToken, initializeVisitorWithToken, subscribeToEvents, isInitialized]);


  // Cleanup event source
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  return {
    visitorData,
    currentFields,
    isInitialized,
    updateVisitFields
  };
}
