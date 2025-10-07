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
  let currentFields = { active: false, joined: false, dailyRoomId: null, sessionEndedAt: null };
  let eventSource = null;
  let callFrame = null;
  let roomUrl = null;
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
    
    console.log('🔄 Initializing visitor with:', { serviceVisitorId, sessionId, companyId });
    
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
        
        // Always get current fields after initialization to ensure we have the correct state
        getCurrentStatus().then(statusData => {
          console.log('Current fields after initialize:', statusData);
          if (statusData) {
            currentFields = {
              active: !!statusData.active,
              joined: !!statusData.joined,
              dailyRoomId: statusData.dailyRoomId || null,
              sessionEndedAt: statusData.sessionEndedAt || null,
            };
          }
          subscribeToEvents();
          createEmbedButton();
          updateControlsFromFields();
        }).catch(() => {
          subscribeToEvents();
          createEmbedButton();
          updateControlsFromFields();
        });
      }
    })
    .catch(error => {
      console.error('Error initializing visitor:', error);
    });
  }
  
  function getCurrentStatus() {
    console.log('Getting current status for visitorId:', visitorId, 'sessionId:', sessionId);
    return fetch(`${apiBase}/api/visitor/current-status?visitorId=${encodeURIComponent(visitorId)}&sessionId=${encodeURIComponent(sessionId)}`)
      .then(response => {
        console.log('Current fields response:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('Current status data:', data);
        return data;
      })
      .catch(error => {
        console.error('Error getting current status:', error);
        return null;
      });
  }
  
  function subscribeToEvents() {
    if (!visitorId) return;
    
    const eventSourceUrl = `${apiBase}/api/visitor/events?visitorId=${encodeURIComponent(visitorId)}`;
    eventSource = new EventSource(eventSourceUrl);
    
    eventSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        console.log('EventSource message received:', data);
        if (data.type === 'visit_update') {
          const next = {
            active: 'active' in data ? !!data.active : currentFields.active,
            joined: 'joined' in data ? !!data.joined : currentFields.joined,
            dailyRoomId: 'dailyRoomId' in data ? (data.dailyRoomId || null) : currentFields.dailyRoomId,
            sessionEndedAt: 'sessionEndedAt' in data ? (data.sessionEndedAt || null) : currentFields.sessionEndedAt,
          };
          console.log('Current fields before update:', currentFields);
          console.log('New fields:', next);
          // If the session has ended, immediately tear down UI and reset state
          if (next.sessionEndedAt) {
            currentFields = next;
            try { endVideoCall(); } catch (e) {}
            try {
              const btnContainer = document.getElementById('embed-button-container');
              if (btnContainer) btnContainer.style.display = 'none';
            } catch (e) {}
            updateControlsFromFields();
            return;
          }
          const changed = JSON.stringify(next) !== JSON.stringify(currentFields);
          console.log('Fields changed:', changed);
          currentFields = next;
          if (changed) {
            console.log('Calling updateControlsFromFields due to change');
            updateControlsFromFields();
          }
        }
      } catch (error) {
        console.error('EventSource message error:', error);
      }
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
    button.innerHTML = 'Call now';
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
    const inCall = !!currentFields.dailyRoomId;
    if (!inCall && !currentFields.joined) {
      currentFields.joined = true;
      updateControlsFromFields();
      updateVisitFields({ joined: true, dailyRoomId: null });
    }
  }
  
  function handleCancelClick() {
    const inCall = !!currentFields.dailyRoomId;
    if (!inCall && currentFields.joined) {
      currentFields.joined = false;
      updateControlsFromFields();
      updateVisitFields({ joined: false });
    }
  }
  
  function updateVisitFields(fields) {
    const requestBody = JSON.stringify({ visitorId, sessionId, companyId, ...fields });
    
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

  // Throttled wrapper to update fields directly (no status labels)
  function updateVisitStatus(fields) {
    const now = Date.now();
    // Throttle status updates to prevent rapid calls
    if (now - lastStatusUpdate < 500) { // 500ms throttle
      return;
    }
    lastStatusUpdate = now;
    updateVisitFields(fields || {});
    // Optimistically update local fields if keys provided
    if (fields) {
      if (typeof fields.active === 'boolean') currentFields.active = fields.active;
      if (typeof fields.joined === 'boolean') currentFields.joined = fields.joined;
      if (fields.dailyRoomId !== undefined) currentFields.dailyRoomId = fields.dailyRoomId;
      if (fields.endedAt) currentFields.sessionEndedAt = fields.endedAt;
      updateControlsFromFields();
    }
  }
  
  function updateControlsFromFields() {
    const button = document.getElementById('embed-chat-button');
    const cancelButton = document.getElementById('embed-cancel-button');
    
    console.log('updateControlsFromFields called with:', currentFields);
    
    if (button) {
      const isEnded = !!currentFields.sessionEndedAt;
      const isInCall = !!currentFields.dailyRoomId && !isEnded;
      const hasJoined = !!currentFields.joined;
      const isActive = !!currentFields.active;
      
      console.log('Control state:', { isInCall, hasJoined, isActive });

      // Button appearance
      button.style.background = '#374151';
      button.style.cursor = 'pointer';
      button.innerHTML = hasJoined && !isInCall
        ? `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;"><div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div><span>Waiting for response</span></div>`
        : 'Call now';

      if (cancelButton) {
        cancelButton.style.display = (!isInCall && hasJoined) ? 'block' : 'none';
      }

      if (isEnded) {
        // Ended sessions should hide everything
        hideVideoCallContainer();
        button.style.display = 'none';
        if (cancelButton) cancelButton.style.display = 'none';
      } else if (isInCall) {
        console.log('isInCall is true, showing video container');
        showVideoCallContainer();
        // Hide the original embed button when in a call
        if (button) {
          button.style.display = 'none';
        }
        if (cancelButton) {
          cancelButton.style.display = 'none';
        }
      } else {
        console.log('isInCall is false, hiding video container');
        hideVideoCallContainer();
        // Show the original embed button when not in a call
        if (button) {
          button.style.display = 'block';
        }
        if (cancelButton) {
          cancelButton.style.display = hasJoined ? 'block' : 'none';
        }
      }
      // Ensure spinner keyframes exists if needed
      if (hasJoined && !isInCall && !document.getElementById('embed-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'embed-spinner-style';
        style.textContent = `@keyframes spin {0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}`;
        document.head.appendChild(style);
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
    // Main container for everything
    const mainContainer = document.createElement('div');
    mainContainer.id = 'video-call-main-container';
    mainContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    
    // Video container
    const videoContainer = document.createElement('div');
    videoContainer.id = 'video-call-container';
    videoContainer.style.cssText = `
      width: 300px;
      height: 200px;
      background: #000;
      border-radius: 12px;
      border: 1px solid #6b7280;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    const remoteVideo = document.createElement('video');
    remoteVideo.id = 'remote-video';
    remoteVideo.autoplay = true;
    remoteVideo.muted = true; // keep video element muted; we'll play remote audio via a hidden <audio>
    remoteVideo.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;
    // Hidden audio element for remote participant audio
    const remoteAudio = document.createElement('audio');
    remoteAudio.id = 'remote-audio';
    remoteAudio.autoplay = true;
    remoteAudio.controls = false;
    remoteAudio.style.cssText = `display: none;`;
    
    const localVideo = document.createElement('video');
    localVideo.id = 'local-video';
    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 80px;
      height: 60px;
      object-fit: cover;
      border-radius: 8px;
      border: 2px solid #10b981;
      z-index: 10001;
      display: none;
    `;
    
    // Control area below video
    const controlArea = document.createElement('div');
    controlArea.id = 'video-call-controls';
    controlArea.style.cssText = `
      width: 300px;
      display: flex;
      flex-direction: row;
      gap: 8px;
      align-items: stretch;
    `;
    
    // Message box
    const messageBox = document.createElement('div');
    messageBox.id = 'video-call-message';
    messageBox.style.cssText = `
      flex: 1;
      padding: 12px 16px;
      background: #374151;
      color: white;
      border: 1px solid #6b7280;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-align: center;
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    messageBox.innerHTML = 'Loading...';
    
    // Join button
    const joinButton = document.createElement('button');
    joinButton.id = 'video-call-join-button';
    joinButton.innerHTML = 'Join Call';
    joinButton.style.cssText = `
      padding: 12px 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      transition: all 0.3s ease;
      min-height: 48px;
      white-space: nowrap;
    `;
    
    joinButton.addEventListener('click', () => {
      joinVideoCall();
    });
    
    // Add hover effects
    joinButton.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
      this.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    });
    
    joinButton.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
      this.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    });
    
    // Assemble everything
    videoContainer.appendChild(remoteVideo);
    videoContainer.appendChild(remoteAudio);
    videoContainer.appendChild(localVideo);
    controlArea.appendChild(messageBox);
    controlArea.appendChild(joinButton);
    mainContainer.appendChild(videoContainer);
    mainContainer.appendChild(controlArea);
    document.body.appendChild(mainContainer);
    
    // Fetch user and company info to personalize the message
    messageBox.innerHTML = "Talk to our team about how we can fit your needs &rarr;";
    
    // Check if there's already a Daily instance
    if (window.__dailyInstance) {
      console.log('Embed: Daily instance already exists, using existing one');
      callFrame = window.__dailyInstance;
    } else {
      callFrame = window.DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
        publishDefaults: {
          audio: true,
          video: true
        }
      });
      // Store globally
      window.__dailyInstance = callFrame;
      window.__dailyInstanceType = 'embed';
    }
    
    callFrame.on('participant-joined', (event) => {
      console.log('Participant joined:', event.participant);
      // Only attach remote (non-local) participants
      if (!event.participant.local) {
        console.log('Remote participant joined, binding tracks');
        // Attach remote video if available
        if (event.participant.videoTrack) {
          console.log('Binding remote video track');
          remoteVideo.srcObject = new MediaStream([event.participant.videoTrack]);
          remoteVideo.muted = true;
          remoteVideo.playsInline = true;
          remoteVideo.play().catch(() => {});
        }
        // Attach remote audio if available
        if (event.participant.audioTrack) {
          console.log('Binding remote audio track');
          const audioEl = document.getElementById('remote-audio');
          if (audioEl) {
            audioEl.srcObject = new MediaStream([event.participant.audioTrack]);
            audioEl.play().catch(() => {});
          }
        }
      }
    });
    
    callFrame.on('participant-left', (event) => {});
    
    callFrame.on('track-started', (event) => {
      console.log('Track started:', event.track.kind, 'participant:', event.participant.local ? 'local' : 'remote');
      // Only handle remote (non-local) tracks
      if (!event.participant.local) {
        console.log('Remote track started:', event.track.kind);
        if (event.track.kind === 'video' && event.participant.videoTrack) {
          console.log('Binding remote video track from track-started');
          remoteVideo.srcObject = new MediaStream([event.participant.videoTrack]);
          remoteVideo.muted = true;
          remoteVideo.playsInline = true;
          remoteVideo.play().catch(() => {});
        }
        if (event.track.kind === 'audio' && event.participant.audioTrack) {
          console.log('Binding remote audio track from track-started');
          const audioEl = document.getElementById('remote-audio');
          if (audioEl) {
            audioEl.srcObject = new MediaStream([event.participant.audioTrack]);
            audioEl.play().catch(() => {});
          }
        }
      }
    });
    
    callFrame.on('local-screen-share-started', () => {});
    
    callFrame.on('local-screen-share-stopped', () => {});
    
    callFrame.on('joined-meeting', () => {
      console.log('Visitor: Joined meeting, checking for existing participants');
      // Check for existing participants
      const participants = callFrame.participants();
      console.log('Visitor: All participants:', participants);
      Object.values(participants).forEach(participant => {
        console.log('Visitor: Processing participant:', participant.local ? 'local' : 'remote', participant);
        if (!participant.local) {
          console.log('Visitor: Found existing remote participant:', participant);
          if (participant.videoTrack) {
            console.log('Visitor: Binding existing remote video track');
            remoteVideo.srcObject = new MediaStream([participant.videoTrack]);
            remoteVideo.muted = true;
            remoteVideo.playsInline = true;
            remoteVideo.play().catch(() => {});
          } else {
            console.log('Visitor: Remote participant has no video track');
          }
          if (participant.audioTrack) {
            console.log('Visitor: Binding existing remote audio track');
            const audioEl = document.getElementById('remote-audio');
            if (audioEl) {
              audioEl.srcObject = new MediaStream([participant.audioTrack]);
              audioEl.play().catch(() => {});
            }
          } else {
            console.log('Visitor: Remote participant has no audio track');
          }
        }
      });
      
      // Get local video track from participants
      const localParticipant = participants.local;
      if (localParticipant && localParticipant.videoTrack) {
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
          localVideo.srcObject = new MediaStream([localParticipant.videoTrack]);
        }
      }
      
      // Check for remote participants periodically in case they join later
      let checkCount = 0;
      const checkForRemoteParticipants = () => {
        checkCount++;
        console.log(`Visitor: Checking for remote participants (attempt ${checkCount})`);
        const currentParticipants = callFrame.participants();
        const remoteParticipants = Object.values(currentParticipants).filter(p => !p.local);
        console.log('Visitor: Current remote participants:', remoteParticipants.length);
        
        if (remoteParticipants.length > 0) {
          console.log('Visitor: Found remote participants after delay');
          remoteParticipants.forEach(participant => {
            console.log('Visitor: Processing delayed remote participant:', participant);
            if (participant.videoTrack) {
              console.log('Visitor: Binding delayed remote video track');
              remoteVideo.srcObject = new MediaStream([participant.videoTrack]);
              remoteVideo.muted = true;
              remoteVideo.playsInline = true;
              remoteVideo.play().catch(() => {});
            }
            if (participant.audioTrack) {
              console.log('Visitor: Binding delayed remote audio track');
              const audioEl = document.getElementById('remote-audio');
              if (audioEl) {
                audioEl.srcObject = new MediaStream([participant.audioTrack]);
                audioEl.play().catch(() => {});
              }
            }
          });
        } else if (checkCount < 10) {
          // Check again in 1 second
          setTimeout(checkForRemoteParticipants, 1000);
        }
      };
      
      // Start checking after a short delay
      setTimeout(checkForRemoteParticipants, 2000);
    });
    
    const roomUrl = `https://n2o.daily.co/${dailyRoomId}`;
    console.log('Visitor: Joining room:', roomUrl);
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
      
      // Hide the controls after joining
      const controlArea = document.getElementById('video-call-controls');
      if (controlArea) {
        controlArea.style.display = 'none';
      }
      
      // Mark joined when visitor joins
      if (currentFields.dailyRoomId && !currentFields.joined) {
        const requestBody = JSON.stringify({ visitorId, sessionId, joined: true, companyId });
        fetch(`${apiBase}/api/visitor/update-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          currentFields.joined = true;
          updateControlsFromFields();
        })
        .catch(error => {
          console.error('Error marking joined:', error);
        });
      }
    }
  }
  
  function endVideoCall() {
    if (callFrame) {
      callFrame.destroy();
      callFrame = null;
    }
    
    const mainContainer = document.getElementById('video-call-main-container');
    if (mainContainer) {
      mainContainer.remove();
    }
    
    roomUrl = null;
  }
  
  
  // presence removed

  // Handle page visibility changes
  document.addEventListener('visibilitychange', function() {
    const inCall = !!currentFields.dailyRoomId;
    // Never change activity while in a call
    if (inCall) return;
    // Do not mark inactive if user has joined (waiting state)
    const isWaiting = !inCall && currentFields.joined;
    if (document.hidden && currentFields.active && !isWaiting) {
      updateVisitFields({ active: false });
      currentFields.active = false; updateControlsFromFields();
    } else if (!document.hidden && !currentFields.active && !currentFields.joined) {
      updateVisitFields({ active: true });
      currentFields.active = true; updateControlsFromFields();
    }
  });

  // Additional event for more reliable cleanup
  window.addEventListener('pagehide', function() {
    // This fires more reliably than beforeunload in some cases
    if (!currentFields.dailyRoomId && !currentFields.joined) {
      const payload = JSON.stringify({
        visitorId: visitorId,
        sessionId: sessionId,
        active: false,
        endedAt: new Date().toISOString()
      });
      
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`${apiBase}/api/visitor/update-status`, blob);
      }
    }
  });

  window.addEventListener('beforeunload', function() {
    console.log('Page unloading, cleaning up...');
    
    // Only mark inactive when not in a call and not joined (idle/attentive cases)
    if (!currentFields.dailyRoomId && !currentFields.joined) {
      const payload = JSON.stringify({
        visitorId: visitorId,
        sessionId: sessionId,
        active: false,
        endedAt: new Date().toISOString()
      });
      
      // Use sendBeacon for reliable delivery during page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`${apiBase}/api/visitor/update-status`, blob);
      } else {
        // Fallback to synchronous XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiBase}/api/visitor/update-status`, false); // synchronous
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
      }
    }
    
    if (eventSource) {
      eventSource.close();
    }
    if (callFrame) {
      endVideoCall();
    }
  });
})();
