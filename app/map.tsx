// © 2025 Benjamin Hawk. All rights reserved.

import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const hotspots = [
  { id: '1', title: '420 Lounge', lat: 37.78825, lon: -122.4324 },
  { id: '2', title: 'Herbal Park', lat: 37.78925, lon: -122.4314 },
  { id: '3', title: 'Cloud Dispensary', lat: 37.79025, lon: -122.4304 },
];

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hotspots</Text>
      <MapView
      style={styles.map}
      showsUserLocation={true}
      showsMyLocationButton={true}
      initialRegion={{
       latitude: 37.78825,
       longitude: -122.4324,
       latitudeDelta: 0.01,
       longitudeDelta: 0.01,
      }}
       >
        {hotspots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lon }}
            title={spot.title}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { fontSize: 26, color: '#00FF7F', padding: 20 },
  map: { flex: 1 },
});
