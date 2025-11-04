// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { useDaily } from '@daily-co/daily-react';
import { Mic, MicOff, Video, VideoOff, Phone, X } from 'lucide-react';
import { VisitorFields, VisitorData } from '../types';

interface VideoCallProps {
  currentFields: VisitorFields;
  visitorData: VisitorData | null;
  onJoined: () => void;
  onAcceptCall: () => void;
  onInviteInfo?: (info: { showInvite: boolean; onAccept: () => void; onDecline: () => void } | null) => void;
  renderVideoFrame?: (videoFrame: React.ReactNode) => void;
}

export function VideoCall({ currentFields, onJoined, onAcceptCall, onInviteInfo, renderVideoFrame }: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(currentFields.joined || false);
  const [inviteDeclined, setInviteDeclined] = useState<boolean>((window as any).__embedDeclined || false);
  const daily = useDaily();
  
  const isInCall = !!currentFields.dailyRoomId && !currentFields.sessionEndedAt;
  const joined = !!currentFields.joined;

  useEffect(() => {
    if (isInCall && currentFields.dailyRoomId && daily) {
      const roomUrl = `https://n2o.daily.co/${currentFields.dailyRoomId}`;
      console.log('Visitor: Joining room:', roomUrl);
      
      // Set up track event listeners to sync UI state
      const handleTrackStarted = (event: any) => {
        if (event.participant.local) {
          if (event.track.kind === "video") {
            setIsVideoEnabled(true);
          } else if (event.track.kind === "audio") {
            setIsMicEnabled(true);
          }
        }
      };

      const handleTrackStopped = (event: any) => {
        if (event.participant.local) {
          if (event.track.kind === "video") {
            setIsVideoEnabled(false);
          } else if (event.track.kind === "audio") {
            setIsMicEnabled(false);
          }
        }
      };

      const handleParticipantJoined = (event: any) => {
        if (event.participant.local) {
          // Sync state with actual track state when local participant joins
          const localParticipant = event.participant;
          setIsVideoEnabled(!!localParticipant.videoTrack);
          setIsMicEnabled(!!localParticipant.audioTrack);
        }
      };

      daily.on('track-started', handleTrackStarted);
      daily.on('track-stopped', handleTrackStopped);
      daily.on('participant-joined', handleParticipantJoined);

      daily.join({ 
        url: roomUrl,
        startVideoOff: true,
        startAudioOff: true
      }).then(() => {
        // After joining, sync state with actual track state (handles page refresh case)
        try {
          const participants = daily.participants();
          const localParticipant = participants?.local;
          if (localParticipant) {
            setIsVideoEnabled(!!localParticipant.videoTrack);
            setIsMicEnabled(!!localParticipant.audioTrack);
          }
        } catch (e) {
          console.error('Error syncing track state after join:', e);
        }
      }).catch((error) => {
        console.error('Visitor: Failed to join room:', error);
      });

      return () => {
        try {
          daily.off('track-started', handleTrackStarted);
          daily.off('track-stopped', handleTrackStopped);
          daily.off('participant-joined', handleParticipantJoined);
        } catch (_) {}
      };
    } else if (!isInCall && daily) {
      daily.leave();
    }
  }, [isInCall, currentFields.dailyRoomId, daily]);

  // Clean up camera/mic when visit is completed
  useEffect(() => {
    if (currentFields.sessionEndedAt && daily) {
      console.log('Visit completed, cleaning up camera/microphone');
      
      // Get local participant and stop all their tracks explicitly
      try {
        const localParticipant = daily.participants()?.local;
        if (localParticipant) {
          // Stop video track directly
          if (localParticipant.videoTrack && typeof localParticipant.videoTrack.stop === 'function') {
            localParticipant.videoTrack.stop();
          }
          // Stop audio track directly
          if (localParticipant.audioTrack && typeof localParticipant.audioTrack.stop === 'function') {
            localParticipant.audioTrack.stop();
          }
        }
      } catch (e) {
        console.error('Error stopping local tracks:', e);
      }
      
      // Stop all tracks via Daily API
      try {
        daily.setLocalAudio(false);
        daily.setLocalVideo(false);
      } catch (e) {
        console.error('Error stopping tracks via Daily API:', e);
      }
      
      // Leave the room
      try {
        daily.leave();
      } catch (e) {
        console.error('Error leaving room:', e);
      }
      
      // Reset states
      setIsVideoEnabled(false);
      setIsMicEnabled(false);
    }
  }, [currentFields.sessionEndedAt, daily]);

  // Update mic state when joined status changes and enable audio when joined
  useEffect(() => {
    setIsMicEnabled(currentFields.joined || false);
    if (currentFields.joined && daily) {
      // When joined becomes true, enable local audio
      try {
        daily.setLocalAudio(true);
      } catch (error) {
        console.error('Failed to enable local audio:', error);
      }
    }
  }, [currentFields.joined, daily]);

  const toggleMic = async () => {
    if (!daily) return;
    
    try {
      if (!isMicEnabled) {
        // Check microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream
        
        // Enable mic and set joined to true
        daily.setLocalAudio(true);
        setIsMicEnabled(true);
        onJoined(); // This will set joined to true
      } else {
        // Disable mic but don't change joined status
        daily.setLocalAudio(false);
        setIsMicEnabled(false);
      }
    } catch (error) {
      console.error('Microphone permission denied:', error);
    }
  };

  const toggleVideo = async () => {
    if (!daily) return;
    
    try {
      const newVideoState = !isVideoEnabled;
      
      if (newVideoState) {
        // Check camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream
      } else {
        // Clear local video when disabling - this will be handled by track-stopped event
      }
      
      daily.setLocalVideo(newVideoState);
      setIsVideoEnabled(newVideoState);
    } catch (error) {
      console.error('Camera permission denied:', error);
    }
  };

  useEffect(() => {
    if (!isInCall) {
      setInviteDeclined(false);
    }
  }, [isInCall]);

  useEffect(() => {
    if (joined) {
      setInviteDeclined(false);
    }
  }, [joined]);

  const showInvite = isInCall && !joined && !inviteDeclined;

  const handleAccept = () => {
    (window as any).__embedDeclined = false;
    window.dispatchEvent(new CustomEvent('embed-declined', { detail: { declined: false } }));
    setInviteDeclined(false);
    onAcceptCall();
  };

  const handleDecline = () => {
    (window as any).__embedDeclined = true;
    window.dispatchEvent(new CustomEvent('embed-declined', { detail: { declined: true } }));
    setInviteDeclined(true);
  };

  useEffect(() => {
    if (onInviteInfo) {
      if (showInvite) {
        onInviteInfo({
          showInvite: true,
          onAccept: handleAccept,
          onDecline: handleDecline
        });
      } else {
        onInviteInfo(null);
      }
    }
  }, [showInvite, onInviteInfo]);

  const videoContainer = (!isInCall || (inviteDeclined && !joined)) ? null : (
    <VideoContainer 
      isVideoEnabled={isVideoEnabled}
      isMicEnabled={isMicEnabled}
      onToggleMic={toggleMic}
      onToggleVideo={toggleVideo}
      joined={joined}
      showInvite={showInvite}
      onAccept={handleAccept}
      onDecline={handleDecline}
      noBorderRadius={!!renderVideoFrame}
    />
  );

  useEffect(() => {
    if (renderVideoFrame) {
      renderVideoFrame(videoContainer);
    }
  }, [videoContainer, renderVideoFrame]);

  // If renderVideoFrame is provided, don't render here (will be rendered in Chat)
  if (renderVideoFrame) {
    return null;
  }

  return videoContainer;
}

interface VideoContainerProps {
  isVideoEnabled: boolean;
  isMicEnabled: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  joined: boolean;
  showInvite?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  noBorderRadius?: boolean;
}

function VideoContainer({ isVideoEnabled, isMicEnabled, onToggleMic, onToggleVideo, joined, showInvite, onAccept, onDecline, noBorderRadius }: VideoContainerProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [remoteCallerName, setRemoteCallerName] = useState<string | null>(null);
  const [declined, setDeclined] = useState<boolean>((window as any).__embedDeclined || false);
  
  // Get the daily instance
  const daily = useDaily();

  useEffect(() => {
    if (!daily) return;

    // Set up event listeners for clean video interface
    const handleParticipantJoined = (event: any) => {
      if (!event.participant.local) {
        // Remote participant (agent)
        // Capture a human-friendly display name if provided
        const name = event.participant.user_name || event.participant.userName || event.participant.name || null;
        if (name) setRemoteCallerName(name);
        if (event.participant.videoTrack && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = new MediaStream([event.participant.videoTrack]);
          remoteVideoRef.current.muted = true;
          remoteVideoRef.current.playsInline = true as any;
          remoteVideoRef.current.play().catch(() => {});
        }
        if (event.participant.audioTrack && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = new MediaStream([event.participant.audioTrack]);
          remoteAudioRef.current.muted = !joined;
          if (joined) {
            remoteAudioRef.current.play().catch(() => {});
          }
        }
      } else {
        // Local participant (visitor)
        if (event.participant.videoTrack && localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([event.participant.videoTrack]);
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true as any;
          localVideoRef.current.play().catch(() => {});
        }
      }
    };

    const handleParticipantUpdated = (event: any) => {
      if (!event.participant.local) {
        const name = event.participant.user_name || event.participant.userName || event.participant.name || null;
        if (name) setRemoteCallerName(name);
      }
    };

    const handleTrackStarted = (event: any) => {
      if (event.participant.local && event.track.kind === "video" && localVideoRef.current) {
        // Local video track
        localVideoRef.current.srcObject = new MediaStream([event.track]);
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true as any;
        localVideoRef.current.play().catch(() => {});
      }
      if (!event.participant.local && event.track.kind === "video" && remoteVideoRef.current) {
        // Remote video track
        remoteVideoRef.current.srcObject = new MediaStream([event.track]);
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current.playsInline = true as any;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (!event.participant.local && event.track.kind === "audio" && remoteAudioRef.current) {
        // Remote audio track - attach but keep muted until joined
        remoteAudioRef.current.srcObject = new MediaStream([event.track]);
        remoteAudioRef.current.muted = !joined;
        if (joined) {
          remoteAudioRef.current.play().catch(() => {});
        }
      }
    };

    const handleTrackStopped = (event: any) => {
      if (event.participant.local && event.track.kind === "video" && localVideoRef.current) {
        // Clear local video when track stops
        localVideoRef.current.srcObject = null;
      }
      if (!event.participant.local && event.track.kind === "video" && remoteVideoRef.current) {
        // Clear remote video when track stops
        remoteVideoRef.current.srcObject = null;
      }
      if (!event.participant.local && event.track.kind === "audio" && remoteAudioRef.current) {
        // Clear remote audio when track stops
        remoteAudioRef.current.srcObject = null;
      }
    };

    // Add event listeners
    daily.on('participant-joined', handleParticipantJoined);
    daily.on('track-started', handleTrackStarted);
    daily.on('track-stopped', handleTrackStopped);
    daily.on('participant-updated', handleParticipantUpdated);

    // Cleanup
    return () => {
      daily.off('participant-joined', handleParticipantJoined);
      daily.off('track-started', handleTrackStarted);
      daily.off('track-stopped', handleTrackStopped);
      daily.off('participant-updated', handleParticipantUpdated);
    };
  }, [daily, joined]);

  // Listen for global decline/accept events to update the frame visibility
  useEffect(() => {
    const handler = (event: CustomEvent<{ declined?: boolean }>) => {
      if (event?.detail && typeof event.detail.declined === 'boolean') {
        setDeclined(event.detail.declined);
      } else {
        setDeclined(true);
      }
    };

    window.addEventListener('embed-declined', handler as any);
    return () => window.removeEventListener('embed-declined', handler as any);
  }, []);

  // When joined status changes, (un)mute remote audio accordingly
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !joined;
      if (joined) {
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [joined]);

  return declined ? null : (
    <div
      style={{
        width: '100%',
        height: '192px',
        minHeight: '192px',
        maxHeight: '192px',
        background: 'hsl(var(--muted))',
        borderRadius: noBorderRadius ? 0 : '24px',
        border: noBorderRadius ? 'none' : '1px solid hsl(var(--border) / 0.4)',
        overflow: 'hidden',
        boxShadow: noBorderRadius ? 'none' : '0 18px 36px hsl(var(--foreground) / 0.12), 0 6px 16px hsl(var(--foreground) / 0.08)',
        position: 'relative',
        flexShrink: 0,
        flexGrow: 0,
        zIndex: 1
      }}
    >
        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Caller name banner when not yet joined - bottom overlay bar */}
        {!joined && !declined && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px 32px',
              background: "rgba(0, 0, 0, 0.7)",
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              color: 'hsl(var(--background))',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              zIndex: 10002,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <span style={{ fontWeight: 700 }}>{remoteCallerName || 'Someone'} is calling you...</span>
          </div>
        )}
        
        {/* Remote audio */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          controls={false}
          style={{ display: 'none' }}
        />
        
        {/* Local video (picture-in-picture) */}
        {isVideoEnabled && (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '80px',
              height: '60px',
              objectFit: 'cover',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border) / 0.3)',
              zIndex: 10001,
            }}
          />
        )}
        
        {/* Video and Mic controls (only after join) */}
        {joined && (
          <VideoControls 
            isVideoEnabled={isVideoEnabled}
            isMicEnabled={isMicEnabled}
            onToggleMic={onToggleMic}
            onToggleVideo={onToggleVideo}
          />
        )}
    </div>
  );
}

interface VideoControlsProps {
  isVideoEnabled: boolean;
  isMicEnabled: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
}

function VideoControls({ isVideoEnabled, isMicEnabled, onToggleMic, onToggleVideo }: VideoControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        zIndex: 10
      }}
    >
      {/* Mic button */}
      <button
        onClick={onToggleMic}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '1px solid hsl(var(--border) / 0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          backgroundColor: 'hsl(var(--background))',
          color: isMicEnabled ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          opacity: isMicEnabled ? 1 : 0.6,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
      </button>

      {/* Video button */}
      <button
        onClick={onToggleVideo}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '1px solid hsl(var(--border) / 0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          backgroundColor: 'hsl(var(--background))',
          color: isVideoEnabled ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          opacity: isVideoEnabled ? 1 : 0.6,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
      </button>
    </div>
  );
}
