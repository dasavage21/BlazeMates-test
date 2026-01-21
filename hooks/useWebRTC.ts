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

  const startConnection = useCallback(async () => {
    if (!circleId || !userId || Platform.OS !== 'web') {
      if (Platform.OS !== 'web') {
        setError('WebRTC is only supported on web browsers');
      }
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const manager = new WebRTCManager(circleId, userId);
      managerRef.current = manager;

      const stream = await manager.initLocalStream(isVideoEnabled, isAudioEnabled);
      if (stream) {
        setLocalStream(stream);
        await manager.setupSignaling(handleRemoteStream, handlePeerDisconnected);
      }
    } catch (err) {
      console.error('Error starting WebRTC connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
    } finally {
      setIsConnecting(false);
    }
  }, [circleId, userId, isVideoEnabled, isAudioEnabled, handleRemoteStream, handlePeerDisconnected]);

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
    if (managerRef.current) {
      await managerRef.current.disconnect();
      managerRef.current = null;
    }
    setLocalStream(null);
    setRemoteStreams([]);
  }, []);

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
