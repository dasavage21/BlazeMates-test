import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { WebRTCManager } from '../lib/webrtc';

type RemoteStream = {
  peerId: string;
  stream: MediaStream;
  username?: string;
};

export function useWebRTC(circleId: string | null, userId: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<WebRTCManager | null>(null);

  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => {
      const existing = prev.find((s) => s.peerId === peerId);
      if (existing) {
        return prev.map((s) => s.peerId === peerId ? { ...s, stream } : s);
      }
      return [...prev, { peerId, stream }];
    });
  }, []);

  const handlePeerDisconnected = useCallback((peerId: string) => {
    setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId));
  }, []);

  const startConnection = useCallback(async (viewOnly: boolean = false) => {
    console.log('[WebRTC] startConnection called', { circleId, userId, platform: Platform.OS, viewOnly });

    if (!circleId || !userId || Platform.OS !== 'web') {
      if (Platform.OS !== 'web') {
        setError('WebRTC is only supported on web browsers');
      }
      return;
    }

    if (managerRef.current) {
      console.log('[WebRTC] Already connected or connecting');
      return;
    }

    try {
      console.log('[WebRTC] Starting connection...');
      setIsConnecting(true);
      setError(null);

      const manager = new WebRTCManager(circleId, userId);
      managerRef.current = manager;

      if (!viewOnly) {
        console.log('[WebRTC] Requesting media access...');
        const stream = await manager.initLocalStream(true, true);

        if (stream) {
          console.log('[WebRTC] Got media stream:', stream.id);
          setLocalStream(stream);
          setIsVideoEnabled(true);
          setIsAudioEnabled(true);
        } else {
          throw new Error('Failed to get media stream');
        }
      } else {
        console.log('[WebRTC] View-only mode - no media access needed');
      }

      console.log('[WebRTC] Setting up signaling...');
      await manager.setupSignaling(handleRemoteStream, handlePeerDisconnected);
      console.log('[WebRTC] Connection complete!');
    } catch (err) {
      console.error('[WebRTC] Error starting connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      managerRef.current = null;
    } finally {
      setIsConnecting(false);
    }
  }, [circleId, userId, handleRemoteStream, handlePeerDisconnected]);

  const connectToPeer = useCallback(async (peerId: string) => {
    if (managerRef.current) {
      await managerRef.current.connectToPeer(peerId, handleRemoteStream);
    }
  }, [handleRemoteStream]);

  const toggleVideo = useCallback(() => {
    if (managerRef.current) {
      const newState = !isVideoEnabled;
      managerRef.current.toggleVideo(newState);
      setIsVideoEnabled(newState);
    }
  }, [isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (managerRef.current) {
      const newState = !isAudioEnabled;
      managerRef.current.toggleAudio(newState);
      setIsAudioEnabled(newState);
    }
  }, [isAudioEnabled]);

  const disconnect = useCallback(async () => {
    console.log('[WebRTC] Disconnecting and cleaning up...');

    if (localStream) {
      console.log('[WebRTC] Stopping local stream tracks...');
      localStream.getTracks().forEach((track) => {
        console.log('[WebRTC] Stopping track:', track.kind, track.label);
        track.stop();
      });
    }

    if (managerRef.current) {
      await managerRef.current.disconnect();
      managerRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams([]);
    setError(null);
    setIsConnecting(false);

    console.log('[WebRTC] Cleanup complete');
  }, [localStream]);

  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
      }
    };
  }, []);

  return {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    isConnecting,
    error,
    startConnection,
    connectToPeer,
    toggleVideo,
    toggleAudio,
    disconnect,
  };
}
