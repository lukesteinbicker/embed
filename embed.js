(function() {
  'use strict';
  
  const EMBED_CONFIG = {
    API_BASE: window.location.origin
  };
  
  function nanoid(size = 21) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let id = '';
    for (let i = 0; i < size; i++) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return id;
  }
  
  const scripts = document.getElementsByTagName('script');
  let token = null;
  const apiBase = EMBED_CONFIG.API_BASE;
  
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.src && script.src.includes('embed.js')) {
      const url = new URL(script.src);
      token = url.searchParams.get('token');
      break;
    }
    if (script.dataset.token) {
      token = script.dataset.token;
      break;
    }
  }
  
  if (!token) {
    return;
  }
  
  const domain = window.location.hostname;
  let companyId = null;
  let visitorId = null;
  let sessionId = null;
  let currentStatus = 'idle';
  let eventSource = null;
  let callFrame = null;
  let roomUrl = null;
  let ably = null;
  let ablyChannel = null;
  let lastStatusUpdate = 0;
  
  fetch(`${apiBase}/api/visitor/validate?token=${encodeURIComponent(token)}&domain=${encodeURIComponent(domain)}`)
    .then(response => response.json())
    .then(data => {
      if (data.valid) {
        companyId = data.companyId;
        initializeVisitor();
      }
    })
    .catch(error => {});
  
  function initializeVisitor() {
    let serviceVisitorId = localStorage.getItem('service_visitor_id');
    if (!serviceVisitorId) {
      serviceVisitorId = nanoid();
      localStorage.setItem('service_visitor_id', serviceVisitorId);
    }
    
    sessionId = localStorage.getItem('current_session_id');
    if (!sessionId) {
      sessionId = nanoid();
      localStorage.setItem('current_session_id', sessionId);
    }
    
    fetch(`${apiBase}/api/visitor/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitorId: serviceVisitorId,
        companyId: companyId,
        sessionId: sessionId
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        visitorId = serviceVisitorId;
        
        getCurrentStatus().then(statusData => {
          if (statusData && statusData.status) {
            currentStatus = statusData.status;
            subscribeToEvents();
            createEmbedButton();
            updateButtonStatus();
            initializeAblyPresence();
          } else {
            subscribeToEvents();
            createEmbedButton();
            initializeAblyPresence();
          }
        });
      }
    })
    .catch(error => {});
  }
  
  function getCurrentStatus() {
    return fetch(`${apiBase}/api/visitor/current-status?visitorId=${encodeURIComponent(visitorId)}&sessionId=${encodeURIComponent(sessionId)}`)
      .then(response => response.json())
      .then(data => data)
      .catch(error => null);
  }
  
  function subscribeToEvents() {
    if (!visitorId) return;
    
    const eventSourceUrl = `${apiBase}/api/visitor/events?visitorId=${encodeURIComponent(visitorId)}`;
    eventSource = new EventSource(eventSourceUrl);
    
    eventSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'visit_update' && data.status && data.status !== currentStatus) {
          currentStatus = data.status;
          updateButtonStatus();
        }
      } catch (error) {}
    };
    
    eventSource.onerror = function(event) {
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          subscribeToEvents();
        }
      }, 3000);
    };
    
    eventSource.onopen = function(event) {};
  }
  
  function createEmbedButton() {
    const container = document.createElement('div');
    container.id = 'embed-button-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
      z-index: 9999;
    `;
    
    const button = document.createElement('button');
    button.id = 'embed-chat-button';
    button.innerHTML = 'Chat';
    button.style.cssText = `
      padding: 12px 24px;
      border-radius: 12px;
      background: #374151;
      color: white;
      border: 1px solid #6b7280;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 120px;
      text-align: center;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.id = 'embed-cancel-button';
    cancelButton.innerHTML = 'Cancel';
    cancelButton.style.cssText = `
      padding: 12px 24px;
      border-radius: 12px;
      background: #1f2937;
      color: white;
      border: 1px solid #4b5563;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 80px;
      text-align: center;
      display: none;
    `;
    
    button.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.05)';
      this.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });
    
    cancelButton.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.05)';
      this.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
    });
    
    cancelButton.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });
    
    button.addEventListener('click', function() {
      handleButtonClick();
    });
    
    cancelButton.addEventListener('click', function() {
      handleCancelClick();
    });
    
    container.appendChild(button);
    container.appendChild(cancelButton);
    
    document.body.appendChild(container);
  }
  
  function handleButtonClick() {
    const statusString = typeof currentStatus === 'object' ? currentStatus?.status : currentStatus;
    
    if (statusString === 'idle' || statusString === 'attentive') {
      // Update status immediately for better UX
      currentStatus = 'engaged';
      updateButtonStatus();
      updateVisitStatusImmediate('engaged');
    }
  }
  
  function handleCancelClick() {
    const statusString = typeof currentStatus === 'object' ? currentStatus?.status : currentStatus;
    if (statusString === 'engaged') {
      // Update status immediately for better UX
      currentStatus = 'attentive';
      updateButtonStatus();
      updateVisitStatusImmediate('attentive');
    }
  }
  
  function updateVisitStatusImmediate(newStatus) {
    // Update presence status immediately
    updatePresenceStatus(newStatus);
    
    // Also update the server
    const requestBody = JSON.stringify({
      visitorId: visitorId,
      sessionId: sessionId,
      status: newStatus,
      companyId: companyId
    });
    
    fetch(`${apiBase}/api/visitor/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Status updated successfully:', data);
    })
    .catch(error => {
      console.error('Error updating visit status:', error);
    });
  }

  function updateVisitStatus(newStatus) {
    const now = Date.now();
    // Throttle status updates to prevent rapid calls
    if (now - lastStatusUpdate < 500) { // 500ms throttle
      return;
    }
    lastStatusUpdate = now;
    
    // Use immediate update for throttled calls
    updateVisitStatusImmediate(newStatus);
  }
  
  function updateButtonStatus() {
    const button = document.getElementById('embed-chat-button');
    const cancelButton = document.getElementById('embed-cancel-button');
    
    if (button) {
      const statusString = typeof currentStatus === 'object' ? currentStatus?.status : currentStatus;
      
      const buttonConfig = {
        idle: {
          background: '#374151',
          text: 'Call now',
          cursor: 'pointer'
        },
        attentive: {
          background: '#374151',
          text: 'Call now',
          cursor: 'pointer'
        },
        engaged: {
          background: '#374151',
          text: 'Waiting for response',
          cursor: 'default'
        },
        bothered: {
          background: '#374151',
          text: 'Join call',
          cursor: 'pointer'
        },
        intercepted: {
          background: '#374151',
          text: 'Join call',
          cursor: 'pointer'
        }
      };
      
      const config = buttonConfig[statusString] || buttonConfig.idle;
      button.style.background = config.background;
      button.style.cursor = config.cursor;
      button.innerHTML = config.text;
      
      if (cancelButton) {
        cancelButton.style.display = statusString === 'engaged' ? 'block' : 'none';
      }
      
      if (statusString === 'bothered' || statusString === 'intercepted') {
        showVideoCallContainer();
      } else {
        hideVideoCallContainer();
      }
      
      if (statusString === 'engaged') {
        button.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Waiting for response</span>
          </div>
        `;
        
        if (!document.getElementById('embed-spinner-style')) {
          const style = document.createElement('style');
          style.id = 'embed-spinner-style';
          style.textContent = `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `;
          document.head.appendChild(style);
        }
      }
    }
  }
  
  async function showVideoCallContainer() {
    if (document.getElementById('video-call-container')) {
      return;
    }
    
    const currentStatusData = await getCurrentStatus();
    if (!currentStatusData || !currentStatusData.dailyRoomId) {
      return;
    }
    
    if (!window.DailyIframe) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@daily-co/daily-js';
      script.onload = () => initializeVideoCall(currentStatusData.dailyRoomId);
      document.head.appendChild(script);
    } else {
      initializeVideoCall(currentStatusData.dailyRoomId);
    }
  }
  
  function hideVideoCallContainer() {
    endVideoCall();
  }
  
  function initializeVideoCall(dailyRoomId) {
    const videoContainer = document.createElement('div');
    videoContainer.id = 'video-call-container';
    videoContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      height: 200px;
      background: #000;
      border-radius: 12px;
      border: 1px solid #6b7280;
      z-index: 10000;
      overflow: hidden;
    `;
    
    const remoteVideo = document.createElement('video');
    remoteVideo.id = 'remote-video';
    remoteVideo.autoplay = true;
    remoteVideo.muted = true;
    remoteVideo.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;
    
    const localVideo = document.createElement('video');
    localVideo.id = 'local-video';
    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      width: 120px;
      height: 90px;
      object-fit: cover;
      border-radius: 6px;
      border: 2px solid #4ade80;
      z-index: 10000;
      display: none;
    `;
    
    const joinButton = document.createElement('button');
    joinButton.innerHTML = 'Join call';
    joinButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 8px 16px;
      background: #4ade80;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      z-index: 10001;
    `;
    
    joinButton.addEventListener('click', () => {
      joinVideoCall();
    });
    
    videoContainer.appendChild(remoteVideo);
    videoContainer.appendChild(localVideo);
    videoContainer.appendChild(joinButton);
    document.body.appendChild(videoContainer);
    
    callFrame = window.DailyIframe.createCallObject({
      audioSource: true,
      videoSource: true,
      publishDefaults: {
        audio: false,
        video: false
      }
    });
    
    callFrame.on('participant-joined', (event) => {
      if (event.participant.videoTrack) {
        remoteVideo.srcObject = new MediaStream([event.participant.videoTrack]);
      }
    });
    
    callFrame.on('participant-left', (event) => {});
    
    callFrame.on('track-started', (event) => {
      if (event.participant.videoTrack) {
        remoteVideo.srcObject = new MediaStream([event.participant.videoTrack]);
      }
    });
    
    callFrame.on('local-screen-share-started', () => {});
    
    callFrame.on('local-screen-share-stopped', () => {});
    
    callFrame.on('joined-meeting', () => {
      callFrame.getLocalVideoTrack().then(track => {
        if (track) {
          const localVideo = document.getElementById('local-video');
          if (localVideo) {
            localVideo.srcObject = new MediaStream([track]);
          }
        }
      });
    });
    
    const roomUrl = `https://n2o.daily.co/${dailyRoomId}`;
    callFrame.join({ url: roomUrl });
  }
  
  function joinVideoCall() {
    if (callFrame) {
      // Use the correct Daily.js API methods for enabling video/audio after joining
      callFrame.setLocalVideo(true);
      callFrame.setLocalAudio(true);
      
      const localVideo = document.getElementById('local-video');
      if (localVideo) {
        localVideo.style.display = 'block';
      }
      
      const joinButton = document.querySelector('#video-call-container button');
      if (joinButton) {
        joinButton.style.display = 'none';
      }
      
      // Update status from 'bothered' to 'intercepted' when visitor joins
      const statusString = typeof currentStatus === 'object' ? currentStatus?.status : currentStatus;
      if (statusString === 'bothered') {
        currentStatus = 'intercepted';
        updatePresenceStatus('intercepted');
        
        // Update server status
        const requestBody = JSON.stringify({
          visitorId: visitorId,
          sessionId: sessionId,
          status: 'intercepted',
          companyId: companyId
        });
        
        fetch(`${apiBase}/api/visitor/update-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('Status updated to intercepted:', data);
        })
        .catch(error => {
          console.error('Error updating status to intercepted:', error);
        });
      }
    }
  }
  
  function endVideoCall() {
    if (callFrame) {
      callFrame.destroy();
      callFrame = null;
    }
    
    const videoContainer = document.getElementById('video-call-container');
    if (videoContainer) {
      videoContainer.remove();
    }
    
    roomUrl = null;
  }
  
  
  function initializeAblyPresence() {
    // Load Ably SDK if not already loaded
    if (typeof Ably === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.ably.com/lib/ably.min-1.js';
      script.onload = () => {
        setupAblyPresence();
      };
      document.head.appendChild(script);
    } else {
      setupAblyPresence();
    }
  }

  function setupAblyPresence() {
    if (!visitorId || !companyId) return;

    // Get Ably token with authUrl for automatic renewal
    fetch(`${apiBase}/api/ably/auth?visitorId=${encodeURIComponent(visitorId)}&companyId=${encodeURIComponent(companyId)}`)
      .then(response => response.json())
      .then(tokenDetails => {
        if (tokenDetails.token) {
          // Initialize Ably client with authUrl for token renewal
          ably = new Ably.Realtime({
            token: tokenDetails.token,
            authUrl: `${apiBase}/api/ably/auth?visitorId=${encodeURIComponent(visitorId)}&companyId=${encodeURIComponent(companyId)}`,
            authMethod: 'GET'
          });
          
          // Get visitor channel
          ablyChannel = ably.channels.get(`visits:visitor:${visitorId}`);
          
          // Handle connection state changes
          ably.connection.on('statechange', (stateChange) => {
            console.log('Ably connection state:', stateChange.current);
            
            // Enter presence when connected
            if (stateChange.current === 'connected') {
              console.log('Ably connected, entering presence...');
              enterPresence();
            }
            
            // If connection fails, try to reconnect
            if (stateChange.current === 'failed' || stateChange.current === 'disconnected') {
              console.log('Ably connection lost, attempting to reconnect...');
            }
          });
          
          // If already connected, enter presence immediately
          if (ably.connection.state === 'connected') {
            console.log('Ably already connected, entering presence...');
            enterPresence();
          }
        }
      })
      .catch(error => {
        console.error('Error getting Ably token:', error);
      });
  }

  function enterPresence() {
    if (!ablyChannel || !ablyChannel.presence) {
      console.error('Ably channel or presence not available');
      return;
    }
    
    try {
      // Enter presence set with visitor data
      // Note: Ably presence.enter() may not always return a Promise
      const result = ablyChannel.presence.enter({
        visitorId: visitorId,
        sessionId: sessionId,
        status: currentStatus,
        timestamp: Date.now()
      });
      
      // Handle both Promise and non-Promise returns
      if (result && typeof result.then === 'function') {
        result.then(() => {
          console.log('Entered Ably presence set for visitor:', visitorId);
        }).catch(error => {
          console.error('Error entering presence set:', error);
        });
      } else {
        // Assume it succeeded if no Promise returned
        console.log('Entered Ably presence set for visitor:', visitorId);
      }
    } catch (error) {
      console.error('Error calling presence enter:', error);
    }
  }

  function updatePresenceStatus(newStatus) {
    if (!ablyChannel || !ablyChannel.presence) {
      console.error('Ably channel or presence not available for status update');
      return;
    }
    
    currentStatus = newStatus;
    
    try {
      // Update presence data with new status
      // Note: Ably presence.update() may not always return a Promise
      ablyChannel.presence.update({
        visitorId: visitorId,
        sessionId: sessionId,
        status: newStatus,
        timestamp: Date.now()
      });
      
      console.log('Updated presence status to:', newStatus);
    } catch (error) {
      console.error('Error updating presence status:', error);
    }
  }

  // Handle page visibility changes
  document.addEventListener('visibilitychange', function() {
    const statusString = typeof currentStatus === 'object' ? currentStatus?.status : currentStatus;
    
    if (document.hidden && statusString === 'attentive') {
      // Page is hidden and user was attentive - mark as idle
      updateVisitStatus('idle');
    } else if (!document.hidden && statusString === 'idle') {
      // Page is visible and user was idle - mark as attentive
      updateVisitStatus('attentive');
    }
  });

  window.addEventListener('beforeunload', function() {
    console.log('Page unloading, cleaning up...');
    
    updateVisitStatus('idle');
    if (eventSource) {
      eventSource.close();
    }
    if (callFrame) {
      endVideoCall();
    }
  });
})();
