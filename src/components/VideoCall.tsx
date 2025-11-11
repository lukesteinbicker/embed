// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { useDaily } from '@daily-co/daily-react';
import { Mic, MicOff, Video, VideoOff, Phone, X, UserRound } from 'lucide-react';
import { VisitorFields, VisitorData } from '../types';

interface VideoCallProps {
  currentFields: VisitorFields;
  visitorData: VisitorData | null;
  onJoined: () => void;
  onAcceptCall: () => void;
  onInviteInfo?: (info: { showInvite: boolean; onAccept: () => void; onDecline: () => void } | null) => void;
  renderVideoFrame?: (videoFrame: React.ReactNode) => void;
  isConnecting?: boolean;
  onVideoControls?: (controls: { isVideoEnabled: boolean; isMicEnabled: boolean; onToggleMic: () => void; onToggleVideo: () => void } | null) => void;
  claimedUserName?: string | null;
  claimedUserImage?: string | null;
}

export function VideoCall({ currentFields, onJoined, onAcceptCall, onInviteInfo, renderVideoFrame, isConnecting, onVideoControls, claimedUserName, claimedUserImage }: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(currentFields.joined || false);
  const [inviteDeclined, setInviteDeclined] = useState<boolean>((window as any).__embedDeclined || false);
  const daily = useDaily();
  
  const isInCall = !!currentFields.dailyRoomId && !currentFields.sessionEndedAt;
  const joined = !!currentFields.joined;
  const showConnecting = isConnecting && !isInCall;

  useEffect(() => {
    if (isInCall && currentFields.dailyRoomId && daily) {
      const roomUrl = `https://n2o.daily.co/${currentFields.dailyRoomId}`;
      
      // Set up track event listeners BEFORE joining to catch all events
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

      // Register listeners before joining
      daily.on('track-started', handleTrackStarted);
      daily.on('track-stopped', handleTrackStopped);
      daily.on('participant-joined', handleParticipantJoined);

      // Sync state immediately if already in call (page refresh)
      const syncCurrentState = () => {
        try {
          const participants = daily.participants();
          const localParticipant = participants?.local;
          if (localParticipant) {
            setIsVideoEnabled(!!localParticipant.videoTrack);
            setIsMicEnabled(!!localParticipant.audioTrack);
          } else {
            // Reset to defaults when joining fresh
            setIsVideoEnabled(false);
            setIsMicEnabled(false);
          }
        } catch (e) {
          setIsVideoEnabled(false);
          setIsMicEnabled(false);
        }
      };

      // Join room
      daily.join({ 
        url: roomUrl,
        startVideoOff: true,
        startAudioOff: true
      }).then(() => {
        // Sync state after join completes
        syncCurrentState();
      }).catch((error) => {
        console.error('Visitor: Failed to join room:', error);
        setIsVideoEnabled(false);
        setIsMicEnabled(false);
      });

      return () => {
        try {
          daily.off('track-started', handleTrackStarted);
          daily.off('track-stopped', handleTrackStopped);
          daily.off('participant-joined', handleParticipantJoined);
        } catch (_) {}
      };
    } else if (!isInCall && daily) {
      // Reset state when leaving call
      setIsVideoEnabled(false);
      setIsMicEnabled(false);
      try {
        daily.leave();
      } catch (_) {}
    } else if (!isInCall) {
      // Reset state when not in call (even without daily instance)
      setIsVideoEnabled(false);
      setIsMicEnabled(false);
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

  // Enable audio when joined status changes - but don't override track state
  // The track events will update isMicEnabled, so we just enable the track
  useEffect(() => {
    if (currentFields.joined && daily && isInCall) {
      // When joined becomes true, enable local audio
      // Track events will update isMicEnabled state automatically
      try {
        daily.setLocalAudio(true);
      } catch (error) {
        console.error('Failed to enable local audio:', error);
      }
    }
  }, [currentFields.joined, daily, isInCall]);

  const toggleMic = async () => {
    if (!daily || !isInCall) return;
    
    try {
      const newMicState = !isMicEnabled;
      
      if (newMicState) {
        // Check microphone permission before enabling
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream
        
        // Enable mic - track-started event will update isMicEnabled
        daily.setLocalAudio(true);
        
        // If not yet joined, mark as joined
        if (!currentFields.joined) {
          onJoined();
        }
      } else {
        // Disable mic - track-stopped event will update isMicEnabled
        daily.setLocalAudio(false);
      }
      // Don't set state here - let track events handle it for accuracy
    } catch (error) {
      console.error('Microphone permission denied:', error);
      // Don't update state on permission error
    }
  };

  const toggleVideo = async () => {
    if (!daily || !isInCall) return;
    
    try {
      const newVideoState = !isVideoEnabled;
      
      if (newVideoState) {
        // Check camera permission before enabling
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream
      }
      
      // Enable/disable video - track events will update isVideoEnabled state
      daily.setLocalVideo(newVideoState);
      // Don't set state here - let track events handle it for accuracy
    } catch (error) {
      console.error('Camera permission denied:', error);
      // Don't update state on permission error
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

  // Expose video controls only when in a call AND joined AND daily is available
  useEffect(() => {
    if (!onVideoControls) return;
    const shouldShowControls = isInCall && joined && !!daily;
    if (shouldShowControls) {
      onVideoControls({
        isVideoEnabled,
        isMicEnabled,
        onToggleMic: toggleMic,
        onToggleVideo: toggleVideo
      });
    } else {
      onVideoControls(null);
    }
  }, [isInCall, joined, isVideoEnabled, isMicEnabled, daily, toggleMic, toggleVideo, onVideoControls]);

  // Show the video container when:
  // - There is an active call (isInCall)
  // - The user is connecting (showConnecting)
  // - The invite banner is visible (showInvite)
  const shouldShowVideoContainer = isInCall || showConnecting || showInvite;

  // Use claimedUserName from prop first, then fallback to currentFields
  // This ensures we always have the latest claimed user info
  const displayClaimedUserName = claimedUserName || currentFields.claimedUserName || null;
  const displayClaimedUserImage = claimedUserImage || currentFields.claimedUserImage || null;
  
  const videoContainer = shouldShowVideoContainer ? (
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
      // Never show connecting message while in a call
      isConnecting={showConnecting}
      claimedUserName={displayClaimedUserName}
      claimedUserImage={displayClaimedUserImage}
    />
  ) : null;

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
  isConnecting?: boolean;
  claimedUserName?: string | null;
  claimedUserImage?: string | null;
}

function VideoContainer({ isVideoEnabled, isMicEnabled, onToggleMic, onToggleVideo, joined, showInvite, onAccept, onDecline, noBorderRadius, isConnecting, claimedUserName, claimedUserImage }: VideoContainerProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [remoteCallerName, setRemoteCallerName] = useState<string | null>(null);
  const [declined, setDeclined] = useState<boolean>((window as any).__embedDeclined || false);
  const [isAvatarImageReady, setIsAvatarImageReady] = useState(false);
  
  // Get the daily instance
  const daily = useDaily();

  // Preload claimed user image before displaying to avoid broken avatar
  useEffect(() => {
    if (!claimedUserImage) {
      setIsAvatarImageReady(false);
      return;
    }

    let cancelled = false;
    setIsAvatarImageReady(false);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setIsAvatarImageReady(true);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setIsAvatarImageReady(false);
      }
    };
    img.src = claimedUserImage;

    return () => {
      cancelled = true;
    };
  }, [claimedUserImage]);

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

  // Ensure local corner video attaches when video is enabled (covers race with track-started before element mounts)
  useEffect(() => {
    if (!daily || !isVideoEnabled || !localVideoRef.current) return;
    try {
      const localParticipant = daily.participants()?.local;
      const track = localParticipant?.videoTrack as MediaStreamTrack | undefined;
      if (track) {
        localVideoRef.current.srcObject = new MediaStream([track]);
        localVideoRef.current.muted = true;
        (localVideoRef.current as any).playsInline = true;
        localVideoRef.current.play().catch(() => {});
      }
    } catch (_) {}
  }, [daily, isVideoEnabled]);
 
  return declined ? null : (
    <div
      style={{
        width: '100%',
        height: '192px',
        minHeight: '192px',
        maxHeight: '192px',
        background: 'linear-gradient(to bottom, hsl(var(--special)), hsl(var(--special) / 0.7))',
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
        {/* Remote video - only show when not connecting */}
        {!isConnecting && (
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
        )}

        {/* Connecting state - show text with avatar */}
        {isConnecting && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--foreground))'
            }}
          >
                <div className="pulse-wrapper">
                  {/* Outward pulsing rings (do not scale the avatar) */}
                  <div className="ring ring1" />
                  <div className="ring ring2" />
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px hsl(var(--foreground) / 0.15)',
                    backgroundColor: 'hsl(var(--muted))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {claimedUserImage && isAvatarImageReady ? (
                      <img
                        src={claimedUserImage}
                        alt={claimedUserName || 'Avatar'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 600,
                        color: 'hsl(var(--muted-foreground))',
                        backgroundColor: 'hsl(var(--muted))'
                      }}>
                        {claimedUserName ? claimedUserName.charAt(0).toUpperCase() : <UserRound size={32} />}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 500
                }}>
                  Connecting to {claimedUserName || 'an agent'}
                </div>
                <style>{`
                  .pulse-wrapper {
                    position: relative;
                    width: 96px;
                    height: 96px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  }
                  .pulse-wrapper .ring {
                    position: absolute;
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    border: 2px solid hsl(var(--foreground) / 0.25);
                    animation: ringPulse 1.8s ease-out infinite;
                  }
                  .pulse-wrapper .ring2 { animation-delay: 0.9s; }
                  @keyframes ringPulse {
                    0% { transform: scale(1); opacity: 0.6; }
                    70% { transform: scale(1.8); opacity: 0; }
                    100% { opacity: 0; }
                  }
                `}</style>
              </div>
            )}


        {/* Caller name banner when not yet joined - bottom overlay bar */}
        {!joined && !declined && !isConnecting && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px 36px 16px',
              background: 'linear-gradient(to bottom, hsl(var(--background) / 0.5), hsl(var(--background)))',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              color: 'hsl(var(--foreground))',
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
        
    </div>
  );
}
