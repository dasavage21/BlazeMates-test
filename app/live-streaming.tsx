import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Video, Users, MessageCircle, ArrowLeft, Plus, X, Mic, MicOff, VideoOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabaseClient';
import { useWebRTC } from '../hooks/useWebRTC';
import { VideoView } from '../components/VideoView';

type LiveStream = {
  id: string;
  title: string;
  description: string | null;
  streamer_id: string;
  is_active: boolean;
  viewer_count: number;
  started_at: string;
  category: string;
  streamer_username?: string;
  streamer_avatar?: string;
};

type ChatMessage = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  username?: string;
};

export default function LiveStreamingScreen() {
  const router = useRouter();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'smoke_session' | 'grow_update' | 'general'>('smoke_session');

  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isStreamer, setIsStreamer] = useState(false);

  const {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    isConnecting,
    startConnection,
    connectToPeer,
    toggleVideo: toggleWebRTCVideo,
    toggleAudio: toggleWebRTCAudio,
    disconnect: disconnectWebRTC,
    error: webrtcError,
  } = useWebRTC(selectedStream?.id || null, currentUserId);

  const loadStreams = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      setCurrentUserId(userId || null);

      const { data: streamsData, error } = await supabase
        .from('live_streams')
        .select(`
          *,
          users!live_streams_streamer_id_fkey (
            username,
            image_url
          )
        `)
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      const formattedStreams = (streamsData || []).map((stream: any) => ({
        id: stream.id,
        title: stream.title,
        description: stream.description,
        streamer_id: stream.streamer_id,
        is_active: stream.is_active,
        viewer_count: stream.viewer_count,
        started_at: stream.started_at,
        category: stream.category,
        streamer_username: stream.users?.username || 'Unknown',
        streamer_avatar: stream.users?.image_url,
      }));

      setStreams(formattedStreams);
    } catch (error) {
      console.error('Error loading streams:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStreams();

    const channel = supabase
      .channel('live_streams_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => {
        loadStreams();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadStreams]);

  const loadChatMessages = useCallback(async (streamId: string) => {
    try {
      const { data, error } = await supabase
        .from('stream_chat_messages')
        .select(`
          *,
          users!stream_chat_messages_user_id_fkey (username)
        `)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const messages = (data || []).map((msg: any) => ({
        id: msg.id,
        user_id: msg.user_id,
        message: msg.message,
        created_at: msg.created_at,
        username: msg.users?.username || 'Anonymous',
      }));

      setChatMessages(messages);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  }, []);

  const handleCreateStream = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const { data: activeStream } = await supabase
        .from('live_streams')
        .select('*')
        .eq('streamer_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (activeStream) {
        Alert.alert('Error', 'You already have an active stream. End it before starting a new one.');
        return;
      }

      const { error } = await supabase.from('live_streams').insert({
        title: title.trim(),
        description: description.trim() || null,
        streamer_id: userId,
        category,
        is_active: true,
      });

      if (error) throw error;

      Alert.alert('Success', 'Stream started! Your stream is now live.');
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      loadStreams();
    } catch (error) {
      console.error('Error creating stream:', error);
      Alert.alert('Error', 'Failed to start stream');
    }
  };

  const handleJoinStream = async (stream: LiveStream) => {
    try {
      if (!currentUserId) return;

      const isStreamOwner = stream.streamer_id === currentUserId;
      setIsStreamer(isStreamOwner);

      await supabase.from('stream_viewers').insert({
        stream_id: stream.id,
        user_id: currentUserId,
      });

      setSelectedStream(stream);
      setShowStreamModal(true);
      loadChatMessages(stream.id);
    } catch (error) {
      console.error('Error joining stream:', error);
    }
  };

  const handleEndStream = async (streamId: string) => {
    try {
      await supabase
        .from('live_streams')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', streamId);

      await disconnectWebRTC();
      Alert.alert('Success', 'Stream ended');
      setShowStreamModal(false);
      setIsStreamer(false);
      loadStreams();
    } catch (error) {
      console.error('Error ending stream:', error);
      Alert.alert('Error', 'Failed to end stream');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedStream || !currentUserId) return;

    try {
      await supabase.from('stream_chat_messages').insert({
        stream_id: selectedStream.id,
        user_id: currentUserId,
        message: newMessage.trim(),
      });

      setNewMessage('');
      loadChatMessages(selectedStream.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const toggleVideo = async () => {
    const newState = !isVideoOn;
    setIsVideoOn(newState);

    if (Platform.OS === 'web') {
      toggleWebRTCVideo();
    }
  };

  const toggleAudio = async () => {
    const newState = !isAudioOn;
    setIsAudioOn(newState);

    if (Platform.OS === 'web') {
      toggleWebRTCAudio();
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web' && showStreamModal && selectedStream && currentUserId && !localStream && isStreamer) {
      console.log('[LiveStreaming] Starting WebRTC connection for streamer...', {
        streamId: selectedStream.id,
        userId: currentUserId,
      });
      setTimeout(() => {
        startConnection();
      }, 300);
    }
  }, [showStreamModal, selectedStream, currentUserId, localStream, isStreamer, startConnection]);

  useEffect(() => {
    if (Platform.OS === 'web' && showStreamModal && selectedStream && currentUserId && !isStreamer) {
      console.log('[LiveStreaming] Viewer connecting to streamer...');
      setTimeout(() => {
        connectToPeer(selectedStream.streamer_id);
      }, 500);
    }
  }, [showStreamModal, selectedStream, currentUserId, isStreamer, connectToPeer]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Streams</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addButton}>
            <Plus size={24} color="#10b981" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {streams.length === 0 ? (
            <View style={styles.emptyState}>
              <Video size={64} color="#555" />
              <Text style={styles.emptyText}>No live streams right now</Text>
              <Text style={styles.emptySubtext}>Be the first to go live!</Text>
            </View>
          ) : (
            streams.map((stream) => (
              <TouchableOpacity
                key={stream.id}
                style={styles.streamCard}
                onPress={() => handleJoinStream(stream)}
              >
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <Text style={styles.streamTitle}>{stream.title}</Text>
                {stream.description && (
                  <Text style={styles.streamDescription}>{stream.description}</Text>
                )}
                <View style={styles.streamInfo}>
                  <Text style={styles.streamerName}>@{stream.streamer_username}</Text>
                  <View style={styles.viewerCount}>
                    <Users size={16} color="#10b981" />
                    <Text style={styles.viewerText}>{stream.viewer_count}</Text>
                  </View>
                </View>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>
                    {stream.category === 'smoke_session' ? '💨 Smoke Session' :
                     stream.category === 'grow_update' ? '🌱 Grow Update' : '🎬 General'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <Modal visible={showCreateModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Start Live Stream</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Stream Title"
                placeholderTextColor="#666"
                value={title}
                onChangeText={setTitle}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor="#666"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Category:</Text>
              <View style={styles.categorySelector}>
                {[
                  { value: 'smoke_session', label: '💨 Smoke Session' },
                  { value: 'grow_update', label: '🌱 Grow Update' },
                  { value: 'general', label: '🎬 General' },
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryOption,
                      category === cat.value && styles.categoryOptionActive,
                    ]}
                    onPress={() => setCategory(cat.value as any)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        category === cat.value && styles.categoryOptionTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.createButton} onPress={handleCreateStream}>
                <Text style={styles.createButtonText}>Go Live</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showStreamModal} transparent animationType="slide">
          <View style={styles.streamViewModal}>
            <View style={styles.streamViewHeader}>
              <View style={styles.liveIndicatorLarge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowStreamModal(false);
                  setSelectedStream(null);
                }}
                style={styles.closeButton}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.webrtcBanner}>
                {webrtcError ? (
                  <>
                    <Video size={20} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.webrtcBannerText, { color: '#ef4444', fontWeight: '600' }]}>
                        {webrtcError}
                      </Text>
                      {(webrtcError.includes('in use') || webrtcError.includes('already')) && (
                        <Text style={[styles.webrtcBannerText, { color: '#ef4444', fontSize: 11, marginTop: 2 }]}>
                          Close other apps/tabs using your camera
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={async () => {
                        console.log('[LiveStreaming] Retry button pressed, cleaning up...');
                        await disconnectWebRTC();
                        setTimeout(() => {
                          console.log('[LiveStreaming] Retrying connection...');
                          startConnection();
                        }, 500);
                      }}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </>
                ) : (localStream || remoteStreams.length > 0) ? (
                  <>
                    <Video size={20} color="#10b981" />
                    <Text style={styles.webrtcBannerText}>
                      {isStreamer ? 'Live streaming enabled' : 'Connected to stream'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Video size={20} color="#f59e0b" />
                    <Text style={[styles.webrtcBannerText, { color: '#f59e0b' }]}>
                      {isConnecting ? 'Requesting camera access...' : 'Connecting...'}
                    </Text>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.webrtcBanner}>
                <Video size={20} color="#ef4444" />
                <Text style={[styles.webrtcBannerText, { color: '#ef4444' }]}>
                  WebRTC only available on web browsers
                </Text>
              </View>
            )}

            {Platform.OS === 'web' && isStreamer && localStream ? (
              <View style={styles.streamVideoContainer}>
                <VideoView stream={localStream} mirror={true} />
                <View style={styles.streamControls}>
                  {!isVideoOn && <VideoOff size={16} color="#ef4444" />}
                  {!isAudioOn && <MicOff size={16} color="#ef4444" />}
                </View>
              </View>
            ) : Platform.OS === 'web' && !isStreamer && remoteStreams.length > 0 ? (
              <View style={styles.streamVideoContainer}>
                <VideoView stream={remoteStreams[0].stream} />
              </View>
            ) : (
              <View style={styles.streamVideoPlaceholder}>
                <Video size={80} color="#333" />
                <Text style={styles.videoPlaceholderText}>
                  {Platform.OS !== 'web' ? 'Web browser required for video' :
                   isConnecting ? 'Connecting...' : 'Video Stream'}
                </Text>
              </View>
            )}

            <View style={styles.chatContainer}>
              <Text style={styles.chatTitle}>Live Chat</Text>
              <ScrollView style={styles.chatMessages}>
                {chatMessages.map((msg) => (
                  <View key={msg.id} style={styles.chatMessage}>
                    <Text style={styles.chatUsername}>{msg.username}:</Text>
                    <Text style={styles.chatText}>{msg.message}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.chatInput}>
                <TextInput
                  style={styles.chatTextInput}
                  placeholder="Send a message..."
                  placeholderTextColor="#666"
                  value={newMessage}
                  onChangeText={setNewMessage}
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                  <MessageCircle size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {isStreamer && Platform.OS === 'web' && (
              <View style={styles.controls}>
                <TouchableOpacity
                  style={[styles.controlButton, !isVideoOn && styles.controlButtonOff]}
                  onPress={toggleVideo}
                >
                  {isVideoOn ? <Video size={24} color="#fff" /> : <VideoOff size={24} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlButton, !isAudioOn && styles.controlButtonOff]}
                  onPress={toggleAudio}
                >
                  {isAudioOn ? <Mic size={24} color="#fff" /> : <MicOff size={24} color="#fff" />}
                </TouchableOpacity>
              </View>
            )}

            {selectedStream && selectedStream.streamer_id === currentUserId && (
              <TouchableOpacity
                style={styles.endStreamButton}
                onPress={() => handleEndStream(selectedStream.id)}
              >
                <Text style={styles.endStreamButtonText}>End Stream</Text>
              </TouchableOpacity>
            )}
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  streamCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  liveIndicatorLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 1,
  },
  streamTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  streamDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
    lineHeight: 20,
  },
  streamInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  streamerName: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewerText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  input: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  categorySelector: {
    gap: 10,
    marginBottom: 20,
  },
  categoryOption: {
    backgroundColor: '#121212',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  categoryOptionTextActive: {
    color: '#10b981',
  },
  createButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  streamViewModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  streamViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  webrtcBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webrtcBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  retryButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  streamVideoContainer: {
    height: 400,
    backgroundColor: '#000',
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  streamControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 6,
    borderRadius: 8,
  },
  streamVideoPlaceholder: {
    height: 300,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 16,
  },
  videoPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginTop: 16,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  chatMessages: {
    flex: 1,
    marginBottom: 12,
  },
  chatMessage: {
    marginBottom: 8,
  },
  chatUsername: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 2,
  },
  chatText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  chatInput: {
    flexDirection: 'row',
    gap: 10,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#10b981',
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonOff: {
    backgroundColor: '#ef4444',
  },
  endStreamButton: {
    backgroundColor: '#ef4444',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  endStreamButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
