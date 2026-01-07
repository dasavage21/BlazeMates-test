import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MapWebProps {
  latitude?: number;
  longitude?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function MapWeb({ latitude, longitude }: MapWebProps) {
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.text}>Map View</Text>
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
    color: '#888',
    marginBottom: 8,
  },
  coords: {
    fontSize: 14,
    color: '#666',
  },
});
