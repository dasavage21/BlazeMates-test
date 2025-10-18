// © 2025 Benjamin Hawk. All rights reserved.

import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

type UserProfile = {
  id: string;
  name: string | null;
  image_url: string | null;
};

export default function MatchScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams(); // from /match?matchId=abc
  const [matchUser, setMatchUser] = useState<UserProfile | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatchUser = async () => {
      if (!matchId || typeof matchId !== 'string') return;

      const { data, error } = await supabase
        .from('users')
        .select('id, name, image_url')
        .eq('id', matchId)
        .single();

      if (!error) setMatchUser(data);
    };

    fetchMatchUser();
  }, [matchId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMyUserId(data?.user?.id ?? null);
    })();
  }, []);

  const handleStartChat = useCallback(async () => {
    if (!matchId || typeof matchId !== 'string' || !myUserId) {
      router.push('/chat');
      return;
    }
    const [a, b] = [matchId, myUserId].sort();
    const threadId = `thread-${a}-${b}`;
    try {
      await supabase.from('threads').upsert({ id: threadId }, { onConflict: 'id' });
    } catch (e: any) {
      console.warn('Failed to create chat thread', e);
      Alert.alert('Chat unavailable', 'Could not start a chat for this match.');
      return;
    }
    router.push({ pathname: '/chat', params: { threadId } });
  }, [matchId, myUserId, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.matchText}>🔥 It&apos;s a match!</Text>

      <Image
        source={{
          uri:
            matchUser?.image_url && matchUser.image_url.trim().length > 0
              ? matchUser.image_url
              : 'https://via.placeholder.com/250',
        }}
        style={styles.avatar}
      />

      <Text style={styles.subText}>
        You and {matchUser?.name || 'someone'} like each other.
      </Text>

      <TouchableOpacity style={styles.chatBtn} onPress={handleStartChat}>
        <Text style={styles.chatText}>💬 Start Chatting</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/swipe')}>
        <Text style={styles.skipText}>⬅️ Keep Swiping</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  matchText: {
    fontSize: 32,
    color: '#00FF7F',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subText: {
    fontSize: 18,
    color: '#ccc',
    textAlign: 'center',
    marginVertical: 10,
  },
  avatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderColor: '#00FF7F',
    borderWidth: 3,
    marginBottom: 20,
  },
  chatBtn: {
    backgroundColor: '#00FF7F',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 20,
  },
  chatText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#121212',
  },
  skipText: {
    color: '#ccc',
    fontSize: 14,
  },
});
