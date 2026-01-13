// © 2025 Benjamin Hawk. All rights reserved.

import { View, Text, Image, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { SubscriptionBadge } from '../components/SubscriptionBadge';

type UserProfile = {
  id: string;
  name: string | null;
  image_url: string | null;
  age: number | null;
  bio: string | null;
  strain: string | null;
  experience_level: string | null;
  preferred_strains: string[] | null;
  consumption_methods: string[] | null;
  cultivation_interest: boolean | null;
  subscription_tier: string | null;
  subscription_status: string | null;
};

export default function MatchScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams(); // from /match?matchId=abc
  const [matchUser, setMatchUser] = useState<UserProfile | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatchUser = async () => {
      if (!matchId || typeof matchId !== 'string') {
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name, image_url, age, bio, strain, experience_level, preferred_strains, consumption_methods, cultivation_interest, subscription_tier, subscription_status')
        .eq('id', matchId)
        .maybeSingle();

      if (!error && data) {
        setMatchUser(data);
      }
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
      router.back();
      return;
    }
    const [a, b] = [matchId, myUserId].sort();
    const threadId = `dm_${a}_${b}`;
    try {
      await supabase.from('threads').upsert({ id: threadId }, { onConflict: 'id' });
    } catch (e: any) {
      console.warn('Failed to create chat thread', e);
      Alert.alert('Chat unavailable', 'Could not start a chat for this match.');
      return;
    }
    router.push({ pathname: '/chat', params: { threadId } });
  }, [matchId, myUserId, router]);

  if (!matchUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri:
                matchUser.image_url && matchUser.image_url.trim().length > 0
                  ? matchUser.image_url
                  : 'https://via.placeholder.com/250',
            }}
            style={styles.avatar}
          />
          {matchUser.age !== null && matchUser.age >= 21 && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </View>
          )}
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.name}>{matchUser.name || 'Unknown'}</Text>
          {matchUser.age !== null && matchUser.age >= 21 && (
            <Text style={styles.verifiedLabel}>Verified</Text>
          )}
          <SubscriptionBadge
            tier={matchUser.subscription_tier}
            status={matchUser.subscription_status}
            size="medium"
          />
        </View>

        <Text style={styles.ageText}>
          {matchUser.age !== null ? `${matchUser.age} years old` : 'Age not set'}
        </Text>
      </View>

      <View style={styles.contentSection}>
        {matchUser.bio && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.bioText}>{matchUser.bio}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Cannabis Profile</Text>

          {matchUser.strain && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Favorite Strain</Text>
              <Text style={styles.infoValue}>{matchUser.strain}</Text>
            </View>
          )}

          {matchUser.experience_level && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Experience Level</Text>
              <Text style={styles.infoValue}>{matchUser.experience_level}</Text>
            </View>
          )}

          {matchUser.preferred_strains && matchUser.preferred_strains.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Preferred Types</Text>
              <Text style={styles.infoValue}>{matchUser.preferred_strains.join(', ')}</Text>
            </View>
          )}

          {matchUser.consumption_methods && matchUser.consumption_methods.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Consumption Methods</Text>
              <Text style={styles.infoValue}>{matchUser.consumption_methods.join(', ')}</Text>
            </View>
          )}

          {matchUser.cultivation_interest && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grower</Text>
              <Text style={styles.infoValue}>🌱 Interested in Cultivation</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.chatButton} onPress={handleStartChat}>
          <Text style={styles.chatButtonText}>Start Chatting</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#00FF7F',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#0f0f0f',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: '#00FF7F',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: '#00FF7F',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00FF7F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#121212',
  },
  verifiedText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#121212',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  verifiedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00FF7F',
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 255, 127, 0.1)',
    borderRadius: 6,
  },
  ageText: {
    fontSize: 18,
    color: '#888',
    letterSpacing: 0.3,
  },
  contentSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  infoCard: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  bioText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  infoLabel: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
    flex: 1,
    letterSpacing: 0.2,
  },
  infoValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  chatButton: {
    backgroundColor: '#00FF7F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    boxShadow: "0 4px 12px rgba(0, 255, 127, 0.3)",
    elevation: 8,
  },
  chatButtonText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
