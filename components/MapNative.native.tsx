// © 2025 Benjamin Hawk. All rights reserved.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';

const hotspots = [
  { id: '1', title: '420 Lounge', lat: 37.78825, lon: -122.4324 },
  { id: '2', title: 'Herbal Park', lat: 37.78925, lon: -122.4314 },
  { id: '3', title: 'Cloud Dispensary', lat: 37.79025, lon: -122.4304 },
];

export default function MapNative() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setUserId(data?.user?.id ?? null);
        }
      } catch (error) {
        console.warn("Failed to load auth user", error);
        if (!cancelled) setUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleShareToChat = async (spot: typeof hotspots[0]) => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to share locations.");
      return;
    }

    const threadId = "global-chat";
    const locationMessage = `📍 ${spot.title}\nLocation: ${spot.lat.toFixed(4)}, ${spot.lon.toFixed(4)}`;

    try {
      await supabase
        .from("threads")
        .upsert({ id: threadId }, { onConflict: "id" });

      const { error } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          sender_id: userId,
          content: locationMessage,
        });

      if (error) {
        console.error("Failed to send location:", error);
        Alert.alert("Error", "Failed to share location. Please try again.");
        return;
      }

      Alert.alert("Location Shared", `${spot.title} has been shared to the global chat!`);
      router.push('/chat?threadId=global-chat');
    } catch (error) {
      console.error("Error sharing location:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hotspots</Text>
      <MapView
        style={styles.map}
        showsUserLocation
        showsMyLocationButton
        initialCamera={{
          center: { latitude: 37.78825, longitude: -122.4324 },
          zoom: 13,
          pitch: 0,
          heading: 0,
          altitude: 0,
        }}
      >
        {hotspots.map(h => (
          <Marker
            key={h.id}
            coordinate={{ latitude: h.lat, longitude: h.lon }}
            title={h.title}
          />
        ))}
      </MapView>
      <View style={styles.bottomSheet}>
        <Text style={styles.bottomSheetTitle}>Share Location to Chat</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spotsList}>
          {hotspots.map((spot) => (
            <TouchableOpacity
              key={spot.id}
              style={styles.spotCard}
              onPress={() => handleShareToChat(spot)}
            >
              <Text style={styles.spotEmoji}>📍</Text>
              <Text style={styles.spotTitle}>{spot.title}</Text>
              <Text style={styles.spotCoords}>
                {spot.lat.toFixed(4)}, {spot.lon.toFixed(4)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', paddingTop: 8 },
  header: { color: '#00FF7F', fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 8 },
  map: { flex: 1, borderRadius: 12, overflow: 'hidden', margin: 12 },
  bottomSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  bottomSheetTitle: {
    color: '#00FF7F',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  spotsList: {
    flexDirection: 'row',
  },
  spotCard: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  spotEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  spotTitle: {
    color: '#00FF7F',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  spotCoords: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
  },
});
