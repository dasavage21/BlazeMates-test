// © 2025 Benjamin Hawk. All rights reserved.

import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function MatchScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.matchText}>🎉 It's a Match!</Text>
      <Image
        source={{ uri: 'https://via.placeholder.com/250' }}
        style={styles.avatar}
      />
      <Text style={styles.subText}>You and Jason like each other.</Text>

      <TouchableOpacity style={styles.chatBtn} onPress={() => router.push('/chat')}>
        <Text style={styles.chatText}>💬 Start Chatting</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/swipe')}>
        <Text style={styles.skipText}>⬅️ Keep Swiping</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  matchText: {
    fontSize: 32,
    color: '#00FF7F',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subText: {
    fontSize: 18,
    color: '#ccc',
    textAlign: 'center',
    marginVertical: 10,
  },
  avatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderColor: '#00FF7F',
    borderWidth: 3,
    marginBottom: 20,
  },
  chatBtn: {
    backgroundColor: '#00FF7F',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 20,
  },
  chatText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#121212',
  },
  skipText: {
    color: '#ccc',
    fontSize: 14,
  },
});
