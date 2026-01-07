// © 2025 Benjamin Hawk. All rights reserved.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const hotspots = [
  { id: '1', title: '420 Lounge', lat: 37.78825, lon: -122.4324 },
  { id: '2', title: 'Herbal Park', lat: 37.78925, lon: -122.4314 },
  { id: '3', title: 'Cloud Dispensary', lat: 37.79025, lon: -122.4304 },
];

export default function MapWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hotspots</Text>
      <View style={styles.mapWrapper}>
        <MapContainer
          center={[37.78825, -122.4324]}
          zoom={13}
          style={{ height: '100%', width: '100%', borderRadius: 12 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hotspots.map((spot) => (
            <Marker key={spot.id} position={[spot.lat, spot.lon]}>
              <Popup>{spot.title}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingTop: 8,
  },
  header: {
    color: '#00FF7F',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  mapWrapper: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
