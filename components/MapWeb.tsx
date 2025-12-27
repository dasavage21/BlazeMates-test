// © 2025 Benjamin Hawk. All rights reserved.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const hotspots = [
  { id: '1', title: '420 Lounge',   lat: 37.78825, lon: -122.4324 },
  { id: '2', title: 'Herbal Park',  lat: 37.78925, lon: -122.4314 },
  { id: '3', title: 'Cloud Dispensary', lat: 37.79025, lon: -122.4304 },
];

export default function MapWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hotspots</Text>
      <View style={styles.webContainer}>
        <Text style={styles.webMessage}>Maps are available on iOS and Android</Text>
        <View style={styles.hotspotList}>
          {hotspots.map(h => (
            <View key={h.id} style={styles.hotspotItem}>
              <Text style={styles.hotspotTitle}>{h.title}</Text>
              <Text style={styles.hotspotCoords}>
                {h.lat.toFixed(4)}, {h.lon.toFixed(4)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', paddingTop: 8 },
  header: { color: '#00FF7F', fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 8 },
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webMessage: {
    color: '#888',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  hotspotList: {
    width: '100%',
    maxWidth: 400,
  },
  hotspotItem: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00FF7F',
  },
  hotspotTitle: {
    color: '#00FF7F',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hotspotCoords: {
    color: '#666',
    fontSize: 12,
  },
});
