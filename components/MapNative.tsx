import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface MapNativeProps {
  latitude?: number;
  longitude?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function MapNative({ latitude, longitude }: MapNativeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.text}>Map View</Text>
        <Text style={styles.subtext}>Coming Soon</Text>
        {latitude && longitude && (
          <Text style={styles.coords}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 60,
    marginBottom: 16,
  },
  text: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: '#00FF7F',
    marginBottom: 16,
  },
  coords: {
    fontSize: 14,
    color: '#666',
  },
});
