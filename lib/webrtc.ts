import { Platform } from 'react-native';
import { supabase } from '../supabaseClient';

export type PeerConnection = {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
};

export type WebRTCConfig = {
  iceServers: RTCIceServer[];
};

const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, PeerConnection> = new Map();
  private config: WebRTCConfig;
  private circleId: string;
  private userId: string;
  private signalChannel: any = null;

  constructor(circleId: string, userId: string, config: WebRTCConfig = DEFAULT_CONFIG) {
    this.circleId = circleId;
    this.userId = userId;
    this.config = config;
  }

  async initLocalStream(videoEnabled: boolean = true, audioEnabled: boolean = true): Promise<MediaStream | null> {
    if (Platform.OS !== 'web') {
      console.log('[WebRTCManager] WebRTC is only supported on web platform');
      return null;
    }

    try {
      console.log('[WebRTCManager] Requesting media devices...', { video: videoEnabled, audio: audioEnabled });

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera/microphone access');
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: audioEnabled,
      });

      console.log('[WebRTCManager] Media stream obtained:', {
        id: this.localStream.id,
        videoTracks: this.localStream.getVideoTracks().length,
        audioTracks: this.localStream.getAudioTracks().length,
      });

      return this.localStream;
    } catch (error: any) {
      console.error('[WebRTCManager] Error accessing media devices:', error);

      // Try audio-only if camera fails due to being in use
      if ((error.name === 'NotReadableError' || error.name === 'TrackStartError') && videoEnabled) {
        console.log('[WebRTCManager] Camera unavailable, trying audio-only mode...');
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioEnabled,
          });
          console.log('[WebRTCManager] Audio-only mode enabled (camera in use elsewhere)');
          return this.localStream;
        } catch (audioError: any) {
          console.error('[WebRTCManager] Audio access also failed:', audioError);
          // Fall through to normal error handling
        }
      }

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera/microphone permission denied. Please allow access and try again.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera or microphone found on your device.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('Camera is in use by another app. Close other apps/tabs and retry.');
      } else if (error.name === 'OverconstrainedError') {
        throw new Error('Camera does not support the required settings.');
      } else if (error.name === 'SecurityError') {
        throw new Error('Camera access blocked by browser security settings.');
      } else {
        throw new Error(error.message || 'Failed to access camera/microphone. Please check your browser settings.');
      }
    }
  }

  async setupSignaling(
    onRemoteStream: (peerId: string, stream: MediaStream) => void,
    onPeerDisconnected: (peerId: string) => void
  ) {
    console.log('[WebRTCManager] Setting up signaling channel for stream:', this.circleId, 'user:', this.userId);

    const channel = supabase
      .channel(`stream:${this.circleId}:webrtc`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        console.log('[WebRTCManager] Received offer from:', payload.from, 'to:', payload.to, 'my ID:', this.userId);
        if (payload.to === this.userId) {
          console.log('[WebRTCManager] Processing offer...');
          await this.handleOffer(payload.from, payload.offer, onRemoteStream);
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        console.log('[WebRTCManager] Received answer from:', payload.from, 'to:', payload.to, 'my ID:', this.userId);
        if (payload.to === this.userId) {
          console.log('[WebRTCManager] Processing answer...');
          await this.handleAnswer(payload.from, payload.answer);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        console.log('[WebRTCManager] Received ICE candidate from:', payload.from, 'to:', payload.to);
        if (payload.to === this.userId) {
          await this.handleIceCandidate(payload.from, payload.candidate);
        }
      })
      .on('broadcast', { event: 'peer-disconnected' }, ({ payload }) => {
        console.log('[WebRTCManager] Peer disconnected:', payload.peerId);
        if (payload.peerId !== this.userId) {
          this.removePeer(payload.peerId);
          onPeerDisconnected(payload.peerId);
        }
      })
      .subscribe((status, err) => {
        console.log('[WebRTCManager] Channel subscription status:', status, err);
        if (status === 'SUBSCRIBED') {
          console.log('[WebRTCManager] Successfully subscribed to signaling channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[WebRTCManager] Channel error:', err);
        }
      });

    this.signalChannel = channel;
  }

  async connectToPeer(
    peerId: string,
    onRemoteStream: (peerId: string, stream: MediaStream) => void
  ) {
    if (Platform.OS !== 'web') {
      return;
    }

    console.log('[WebRTCManager] Connecting to peer:', peerId, 'from:', this.userId);
    const peerConnection = new RTCPeerConnection(this.config);

    if (this.localStream) {
      console.log('[WebRTCManager] Adding local stream tracks to peer connection');
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    } else {
      console.log('[WebRTCManager] No local stream (viewer mode)');
    }

    peerConnection.ontrack = (event) => {
      console.log('[WebRTCManager] Received remote track from:', peerId);
      if (event.streams && event.streams[0]) {
        onRemoteStream(peerId, event.streams[0]);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTCManager] Sending ICE candidate to:', peerId);
        this.sendIceCandidate(peerId, event.candidate);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTCManager] Connection state with', peerId, ':', peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTCManager] ICE connection state with', peerId, ':', peerConnection.iceConnectionState);
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTCManager] ICE gathering state with', peerId, ':', peerConnection.iceGatheringState);
    };

    this.peerConnections.set(peerId, { peerId, connection: peerConnection });

    console.log('[WebRTCManager] Creating offer for:', peerId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('[WebRTCManager] Sending offer to:', peerId);
    await this.sendOffer(peerId, offer);
  }

  private async handleOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit,
    onRemoteStream: (peerId: string, stream: MediaStream) => void
  ) {
    if (Platform.OS !== 'web') {
      return;
    }

    console.log('[WebRTCManager] Handling offer from:', peerId);
    const peerConnection = new RTCPeerConnection(this.config);

    if (this.localStream) {
      console.log('[WebRTCManager] Adding local stream to answer');
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    } else {
      console.log('[WebRTCManager] No local stream when handling offer (this is the streamer)');
    }

    peerConnection.ontrack = (event) => {
      console.log('[WebRTCManager] Received remote track in handleOffer from:', peerId);
      if (event.streams && event.streams[0]) {
        onRemoteStream(peerId, event.streams[0]);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTCManager] Sending ICE candidate (from handleOffer) to:', peerId);
        this.sendIceCandidate(peerId, event.candidate);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTCManager] Connection state (from handleOffer) with', peerId, ':', peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTCManager] ICE connection state (from handleOffer) with', peerId, ':', peerConnection.iceConnectionState);
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTCManager] ICE gathering state (from handleOffer) with', peerId, ':', peerConnection.iceGatheringState);
    };

    this.peerConnections.set(peerId, { peerId, connection: peerConnection });

    console.log('[WebRTCManager] Setting remote description and creating answer for:', peerId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log('[WebRTCManager] Sending answer to:', peerId);
    await this.sendAnswer(peerId, answer);
  }

  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    console.log('[WebRTCManager] Handling answer from:', peerId);
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      console.log('[WebRTCManager] Setting remote description for answer');
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTCManager] Remote description set, connection state:', peer.connection.connectionState);
    } else {
      console.error('[WebRTCManager] No peer connection found for:', peerId);
    }
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    console.log('[WebRTCManager] Handling ICE candidate from:', peerId);
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTCManager] ICE candidate added');
    } else {
      console.error('[WebRTCManager] No peer connection found for ICE candidate from:', peerId);
    }
  }

  private async sendOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    console.log('[WebRTCManager] Broadcasting offer from', this.userId, 'to', peerId);
    await this.signalChannel?.send({
      type: 'broadcast',
      event: 'offer',
      payload: { from: this.userId, to: peerId, offer },
    });
    console.log('[WebRTCManager] Offer broadcast complete');
  }

  private async sendAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    console.log('[WebRTCManager] Broadcasting answer from', this.userId, 'to', peerId);
    await this.signalChannel?.send({
      type: 'broadcast',
      event: 'answer',
      payload: { from: this.userId, to: peerId, answer },
    });
    console.log('[WebRTCManager] Answer broadcast complete');
  }

  private async sendIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    await this.signalChannel?.send({
      type: 'broadcast',
      event: 'ice-candidate',
      payload: { from: this.userId, to: peerId, candidate },
    });
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  removePeer(peerId: string) {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peerConnections.delete(peerId);
    }
  }

  async disconnect() {
    if (this.signalChannel) {
      await this.signalChannel.send({
        type: 'broadcast',
        event: 'peer-disconnected',
        payload: { peerId: this.userId },
      });
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }

    this.peerConnections.forEach((peer) => {
      peer.connection.close();
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getPeerConnections(): PeerConnection[] {
    return Array.from(this.peerConnections.values());
  }
}
