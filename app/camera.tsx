// app/camera.tsx
// © 2025 Benjamin Hawk. All rights reserved.

import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType } from 'expo-camera';
import { useRouter } from 'expo-router';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front'); // 'front' | 'back'
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>We need camera access to take your profile photo.</Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (!photo?.uri) return;
      router.push({ pathname: '/profile-edit', params: { photoUri: photo.uri } });
    } catch {
      Alert.alert('Error', 'Could not take photo');
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera fills the parent */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />

      {/* Overlay controls (no children inside CameraView) */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
        >
          <Text style={styles.text}>Flip</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <Text style={styles.text}>📸</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', backgroundColor: 'black' },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  flipButton: { backgroundColor: 'rgba(0,0,0,0.35)', padding: 12, borderRadius: 10 },
  captureButton: { backgroundColor: '#00FF7F', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 50 },
  text: { color: '#fff', fontSize: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'black' },
  permText: { color: '#fff', textAlign: 'center', marginBottom: 12 },
  grantBtn: { backgroundColor: '#00FF7F', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  grantText: { color: '#121212', fontWeight: 'bold' },
});
