// © 2025 Benjamin Hawk. All rights reserved.

import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image source={require('./assets/icon.png')} style={styles.logo} />
      <Text style={styles.title}>BlazeMates</Text>
      <Text style={styles.subtitle}>Find your 420 soulmate 🌿</Text>

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/swipe')}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/profile')}>
        <Text style={styles.link}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0f0f0f', padding: 20,
  },
  logo: { width: 120, height: 120, marginBottom: 30 },
  title: {
    fontSize: 40, fontWeight: 'bold',
    color: '#00FF7F', marginBottom: 10,
    textShadowColor: '#0f0', textShadowRadius: 10,
  },
  subtitle: { fontSize: 18, color: '#ccc', marginBottom: 40 },
  button: {
    backgroundColor: '#00FF7F', padding: 15,
    borderRadius: 10, width: '100%', alignItems: 'center',
  },
  buttonText: { color: '#000', fontSize: 18, fontWeight: '600' },
  link: { color: '#00FF7F', marginTop: 20, fontSize: 16 },
});

