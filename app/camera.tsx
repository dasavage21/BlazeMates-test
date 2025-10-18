// app/camera.tsx
// © 2025 Benjamin Hawk. All rights reserved.

import { Camera, CameraType, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facing, setFacing] = useState<CameraType>("front");
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    async function requestPermission() {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    }

    return (
      <View style={styles.center}>
        <Text style={styles.permText}>
          We need camera access to take your profile photo.
        </Text>
        <Button title="Grant permission" onPress={requestPermission} />
      </View>
    );
  }

  const takePicture = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (!photo?.uri) return;
      // Send the local file URI back to the edit screen
      router.push({
        pathname: "/profile-edit",
        params: { photoUri: photo.uri },
      });
    } catch {
      Alert.alert("Error", "Could not take photo");
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing={facing} />
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() =>
            setFacing((prev) => (prev === "back" ? "front" : "back"))
          }
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
  container: { flex: 1, position: "relative", backgroundColor: "black" },
  camera: { flex: 1 },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  flipButton: {
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 12,
    borderRadius: 10,
  },
  captureButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 50,
  },
  text: { color: "#fff", fontSize: 18 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "black",
  },
  permText: { color: "#fff", textAlign: "center", marginBottom: 12 },
  grantBtn: {
    backgroundColor: "#00FF7F",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  grantText: { color: "#121212", fontWeight: "bold" },
});
