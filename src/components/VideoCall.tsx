// @ts-nocheck
import { useEffect, useState, useRef } from 'react';
import { useDaily } from '@daily-co/daily-react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { VisitorFields, VisitorData } from '../types';

interface VideoCallProps {
  currentFields: VisitorFields;
  visitorData: VisitorData | null;
  onJoined: () => void;
}

export function VideoCall({ currentFields, onJoined }: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(currentFields.joined || false);
  const daily = useDaily();
  
  const isInCall = !!currentFields.dailyRoomId && !currentFields.sessionEndedAt;

  useEffect(() => {
    if (isInCall && currentFields.dailyRoomId && daily) {
      const roomUrl = `https://n2o.daily.co/${currentFields.dailyRoomId}`;
      console.log('Visitor: Joining room:', roomUrl);
      daily.join({ 
        url: roomUrl,
        startVideoOff: true,
        startAudioOff: true
      });
    } else if (!isInCall && daily) {
      daily.leave();
    }
  }, [isInCall, currentFields.dailyRoomId, daily]);

  // Clean up camera/mic when visit is completed
  useEffect(() => {
    if (currentFields.sessionEndedAt && daily) {
      console.log('Visit completed, cleaning up camera/microphone');
      // Stop all local tracks
      daily.setLocalAudio(false);
      daily.setLocalVideo(false);
      // Leave the room
      daily.leave();
      // Reset states
      setIsVideoEnabled(false);
      setIsMicEnabled(false);
    }
  }, [currentFields.sessionEndedAt, daily]);

  // Update mic state when joined status changes
  useEffect(() => {
    setIsMicEnabled(currentFields.joined || false);
  }, [currentFields.joined]);

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

  if (!isInCall) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <VideoContainer 
        isVideoEnabled={isVideoEnabled}
        isMicEnabled={isMicEnabled}
        onToggleMic={toggleMic}
        onToggleVideo={toggleVideo}
      />
    </div>
  );
}

interface VideoContainerProps {
  isVideoEnabled: boolean;
  isMicEnabled: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
}

function VideoContainer({ isVideoEnabled, isMicEnabled, onToggleMic, onToggleVideo }: VideoContainerProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  
  // Get the daily instance
  const daily = useDaily();

  useEffect(() => {
    if (!daily) return;

    // Set up event listeners for clean video interface
    const handleParticipantJoined = (event: any) => {
      if (!event.participant.local) {
        // Remote participant (agent)
        if (event.participant.videoTrack && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = new MediaStream([event.participant.videoTrack]);
          remoteVideoRef.current.muted = true;
          remoteVideoRef.current.playsInline = true as any;
          remoteVideoRef.current.play().catch(() => {});
        }
        if (event.participant.audioTrack && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = new MediaStream([event.participant.audioTrack]);
          remoteAudioRef.current.play().catch(() => {});
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
        // Remote audio track
        remoteAudioRef.current.srcObject = new MediaStream([event.track]);
        remoteAudioRef.current.play().catch(() => {});
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

    // Cleanup
    return () => {
      daily.off('participant-joined', handleParticipantJoined);
      daily.off('track-started', handleTrackStarted);
      daily.off('track-stopped', handleTrackStopped);
    };
  }, [daily]);

  return (
    <div
      style={{
        width: '300px',
        height: '200px',
        background: 'hsl(var(--background) / 0.7)',
        borderRadius: '8px',
        border: '1px solid hsl(var(--border) / 0.3)',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        position: 'relative',
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
      
      {/* Video and Mic controls */}
      <VideoControls 
        isVideoEnabled={isVideoEnabled}
        isMicEnabled={isMicEnabled}
        onToggleMic={onToggleMic}
        onToggleVideo={onToggleVideo}
      />
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
