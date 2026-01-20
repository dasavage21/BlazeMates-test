import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoIcon, Users, MessageCircle, ArrowLeft, Plus, X, Video, Mic, MicOff, VideoOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabaseClient';

type VirtualCircle = {
  id: string;
  name: string;
  description: string | null;
  host_id: string;
  is_public: boolean;
  is_active: boolean;
  max_participants: number;
  room_code: string;
  participant_count: number;
  host_username?: string;
};

type Participant = {
  id: string;
  user_id: string;
  is_video_on: boolean;
  is_audio_on: boolean;
  username?: string;
};

type ChatMessage = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  username?: string;
};

export default function VirtualCirclesScreen() {
  const router = useRouter();
  const [circles, setCircles] = useState<VirtualCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCircleModal, setShowCircleModal] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<VirtualCircle | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(8);

  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);

  const loadCircles = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      setCurrentUserId(userId || null);

      const { data: circlesData, error } = await supabase
        .from('virtual_circles')
        .select(`
          *,
          users!virtual_circles_host_id_fkey (username)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const circlesWithCounts = await Promise.all(
        (circlesData || []).map(async (circle: any) => {
          const { count } = await supabase
            .from('circle_participants')
            .select('*', { count: 'exact', head: true })
            .eq('circle_id', circle.id)
            .is('left_at', null);

          return {
            id: circle.id,
            name: circle.name,
            description: circle.description,
            host_id: circle.host_id,
            is_public: circle.is_public,
            is_active: circle.is_active,
            max_participants: circle.max_participants,
            room_code: circle.room_code,
            participant_count: count || 0,
            host_username: circle.users?.username || 'Unknown',
          };
        })
      );

      setCircles(circlesWithCounts);
    } catch (error) {
      console.error('Error loading circles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadParticipants = useCallback(async (circleId: string) => {
    try {
      const { data, error } = await supabase
        .from('circle_participants')
        .select(`
          *,
          users!circle_participants_user_id_fkey (username)
        `)
        .eq('circle_id', circleId)
        .is('left_at', null);

      if (error) throw error;

      const participantsList = (data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        is_video_on: p.is_video_on,
        is_audio_on: p.is_audio_on,
        username: p.users?.username || 'Anonymous',
      }));

      setParticipants(participantsList);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  }, []);

  const loadChatMessages = useCallback(async (circleId: string) => {
    try {
      const { data, error } = await supabase
        .from('circle_chat_messages')
        .select(`
          *,
          users!circle_chat_messages_user_id_fkey (username)
        `)
        .eq('circle_id', circleId)
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

  useEffect(() => {
    loadCircles();

    const circlesChannel = supabase
      .channel('virtual_circles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'virtual_circles' }, () => {
        loadCircles();
      })
      .subscribe();

    const participantsGlobalChannel = supabase
      .channel('circle_participants_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_participants' }, () => {
        loadCircles();
      })
      .subscribe();

    return () => {
      circlesChannel.unsubscribe();
      participantsGlobalChannel.unsubscribe();
    };
  }, [loadCircles]);

  useEffect(() => {
    if (!selectedCircle) return;

    loadParticipants(selectedCircle.id);
    loadChatMessages(selectedCircle.id);

    const participantsChannel = supabase
      .channel(`circle_participants_${selectedCircle.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'circle_participants',
        filter: `circle_id=eq.${selectedCircle.id}`
      }, () => {
        loadParticipants(selectedCircle.id);
      })
      .subscribe();

    const chatChannel = supabase
      .channel(`circle_chat_${selectedCircle.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'circle_chat_messages',
        filter: `circle_id=eq.${selectedCircle.id}`
      }, () => {
        loadChatMessages(selectedCircle.id);
      })
      .subscribe();

    return () => {
      participantsChannel.unsubscribe();
      chatChannel.unsubscribe();
    };
  }, [selectedCircle, loadParticipants, loadChatMessages]);

  const handleCreateCircle = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a circle name');
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const { data: newCircle, error } = await supabase
        .from('virtual_circles')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          host_id: userId,
          is_public: isPublic,
          max_participants: maxParticipants,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: participantError } = await supabase.from('circle_participants').insert({
        circle_id: newCircle.id,
        user_id: userId,
        is_video_on: true,
        is_audio_on: true,
      });

      if (participantError && !participantError.message?.includes('duplicate') && !participantError.message?.includes('unique')) {
        throw participantError;
      }

      Alert.alert('Success', 'Circle created successfully!');
      setShowCreateModal(false);
      setName('');
      setDescription('');
      loadCircles();
    } catch (error) {
      console.error('Error creating circle:', error);
      Alert.alert('Error', 'Failed to create circle');
    }
  };

  const handleJoinCircle = async (circle: VirtualCircle) => {
    try {
      if (!currentUserId) return;

      if (circle.participant_count >= circle.max_participants) {
        Alert.alert('Circle Full', 'This circle has reached its maximum capacity');
        return;
      }

      // Check if already a participant
      const { data: existingParticipant } = await supabase
        .from('circle_participants')
        .select('id, is_video_on, is_audio_on')
        .eq('circle_id', circle.id)
        .eq('user_id', currentUserId)
        .is('left_at', null)
        .maybeSingle();

      // If already a participant, sync their state and open the circle view
      if (existingParticipant) {
        setIsVideoOn(existingParticipant.is_video_on);
        setIsAudioOn(existingParticipant.is_audio_on);
        setSelectedCircle(circle);
        setShowCircleModal(true);
        loadParticipants(circle.id);
        loadChatMessages(circle.id);
        return;
      }

      // If not a participant, add them
      const { data, error } = await supabase.from('circle_participants').insert({
        circle_id: circle.id,
        user_id: currentUserId,
        is_video_on: true,
        is_audio_on: true,
      }).select('is_video_on, is_audio_on').single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          setSelectedCircle(circle);
          setShowCircleModal(true);
          loadParticipants(circle.id);
          loadChatMessages(circle.id);
          return;
        }
        console.error('Join circle error:', error);
        throw error;
      }

      // Sync state with newly created participant
      if (data) {
        setIsVideoOn(data.is_video_on);
        setIsAudioOn(data.is_audio_on);
      }

      setSelectedCircle(circle);
      setShowCircleModal(true);
      loadParticipants(circle.id);
      loadChatMessages(circle.id);
    } catch (error) {
      console.error('Error joining circle:', error);
      Alert.alert('Error', 'Failed to join circle');
    }
  };

  const handleLeaveCircle = async (circleId: string) => {
    try {
      if (!currentUserId) return;

      await supabase
        .from('circle_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('circle_id', circleId)
        .eq('user_id', currentUserId);

      setShowCircleModal(false);
      setSelectedCircle(null);
      setIsVideoOn(true);
      setIsAudioOn(true);
      setParticipants([]);
      setChatMessages([]);
      loadCircles();
    } catch (error) {
      console.error('Error leaving circle:', error);
      Alert.alert('Error', 'Failed to leave circle');
    }
  };

  const handleEndCircle = async (circleId: string) => {
    try {
      await supabase
        .from('virtual_circles')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', circleId);

      Alert.alert('Success', 'Circle ended');
      setShowCircleModal(false);
      setSelectedCircle(null);
      setIsVideoOn(true);
      setIsAudioOn(true);
      setParticipants([]);
      setChatMessages([]);
      loadCircles();
    } catch (error) {
      console.error('Error ending circle:', error);
      Alert.alert('Error', 'Failed to end circle');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedCircle || !currentUserId) return;

    try {
      await supabase.from('circle_chat_messages').insert({
        circle_id: selectedCircle.id,
        user_id: currentUserId,
        message: newMessage.trim(),
      });

      setNewMessage('');
      loadChatMessages(selectedCircle.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const toggleVideo = async () => {
    if (!selectedCircle || !currentUserId) return;

    const newState = !isVideoOn;
    setIsVideoOn(newState);

    await supabase
      .from('circle_participants')
      .update({ is_video_on: newState })
      .eq('circle_id', selectedCircle.id)
      .eq('user_id', currentUserId);
  };

  const toggleAudio = async () => {
    if (!selectedCircle || !currentUserId) return;

    const newState = !isAudioOn;
    setIsAudioOn(newState);

    await supabase
      .from('circle_participants')
      .update({ is_audio_on: newState })
      .eq('circle_id', selectedCircle.id)
      .eq('user_id', currentUserId);
  };

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
          <Text style={styles.headerTitle}>Virtual Circles</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addButton}>
            <Plus size={24} color="#10b981" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {circles.length === 0 ? (
            <View style={styles.emptyState}>
              <VideoIcon size={64} color="#555" />
              <Text style={styles.emptyText}>No active circles</Text>
              <Text style={styles.emptySubtext}>Create one to start vibing!</Text>
            </View>
          ) : (
            circles.map((circle) => (
              <TouchableOpacity
                key={circle.id}
                style={styles.circleCard}
                onPress={() => handleJoinCircle(circle)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.circleName}>{circle.name}</Text>
                  {circle.is_public && (
                    <View style={styles.publicBadge}>
                      <Text style={styles.publicText}>PUBLIC</Text>
                    </View>
                  )}
                </View>
                {circle.description && (
                  <Text style={styles.circleDescription}>{circle.description}</Text>
                )}
                <View style={styles.circleInfo}>
                  <Text style={styles.hostName}>Host: @{circle.host_username}</Text>
                  <View style={styles.participantCount}>
                    <Users size={16} color="#10b981" />
                    <Text style={styles.countText}>
                      {circle.participant_count}/{circle.max_participants}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <Modal visible={showCreateModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Circle</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Circle Name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
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

              <View style={styles.switchRow}>
                <Text style={styles.label}>Public Circle:</Text>
                <TouchableOpacity
                  style={[styles.switch, isPublic && styles.switchActive]}
                  onPress={() => setIsPublic(!isPublic)}
                >
                  <View style={[styles.switchThumb, isPublic && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Max Participants: {maxParticipants}</Text>
              <View style={styles.participantSelector}>
                {[4, 6, 8].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.participantOption,
                      maxParticipants === num && styles.participantOptionActive,
                    ]}
                    onPress={() => setMaxParticipants(num)}
                  >
                    <Text
                      style={[
                        styles.participantOptionText,
                        maxParticipants === num && styles.participantOptionTextActive,
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.createButton} onPress={handleCreateCircle}>
                <Text style={styles.createButtonText}>Create Circle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showCircleModal} transparent animationType="slide">
          <View style={styles.circleViewModal}>
            <View style={styles.circleViewHeader}>
              <Text style={styles.circleViewTitle}>{selectedCircle?.name}</Text>
              <TouchableOpacity
                onPress={() => handleLeaveCircle(selectedCircle?.id || '')}
                style={styles.closeButton}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.webrtcBanner}>
              <VideoIcon size={20} color="#10b981" />
              <Text style={styles.webrtcBannerText}>WebRTC integration coming soon</Text>
            </View>

            <View style={styles.videoGrid}>
              {participants.slice(0, 4).map((participant) => (
                <View key={participant.id} style={styles.videoTile}>
                  <View style={styles.videoPlaceholder}>
                    <VideoIcon size={40} color="#444" />
                    <Text style={styles.participantName}>{participant.username}</Text>
                  </View>
                  <View style={styles.participantControls}>
                    {!participant.is_video_on && <VideoOff size={16} color="#ef4444" />}
                    {!participant.is_audio_on && <MicOff size={16} color="#ef4444" />}
                  </View>
                </View>
              ))}
            </View>

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

            <View style={styles.chatContainer}>
              <Text style={styles.chatTitle}>Chat</Text>
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

            {selectedCircle && selectedCircle.host_id === currentUserId && (
              <TouchableOpacity
                style={styles.endCircleButton}
                onPress={() => handleEndCircle(selectedCircle.id)}
              >
                <Text style={styles.endCircleButtonText}>End Circle</Text>
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
  circleCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  circleName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  publicBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  publicText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  circleDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
    lineHeight: 20,
  },
  circleInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostName: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  participantCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontSize: 14,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#10b981',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  participantSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  participantOption: {
    flex: 1,
    backgroundColor: '#121212',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  participantOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  participantOptionText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '700',
  },
  participantOptionTextActive: {
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
  circleViewModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  circleViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  circleViewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
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
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  videoTile: {
    width: '48%',
    aspectRatio: 1,
    position: 'relative',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginTop: 8,
  },
  participantControls: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
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
  chatContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
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
  endCircleButton: {
    backgroundColor: '#ef4444',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  endCircleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
