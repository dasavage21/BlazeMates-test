// © 2025 Benjamin Hawk. All rights reserved.

import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const router = useRouter();
  const [age, setAge] = useState<number | null>(null);
  const [profile, setProfile] = useState({ name: '', bio: '', strain: '', style: '', lookingFor: '' });

  
  useEffect(() => {
  const load = async () => {
    const stored = await AsyncStorage.getItem('userProfile');
    if (stored) setProfile(JSON.parse(stored));
  };
  load();

}, []);

  useEffect(() => {
    const loadAge = async () => {
      const storedAge = await AsyncStorage.getItem('userAge');
      if (storedAge) setAge(parseInt(storedAge));
    };
    loadAge();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={{ uri: 'https://via.placeholder.com/250' }}
        style={styles.avatar}
      />

      <Text style={styles.name}>
        BlazeMate
        {age !== null && age >= 21 && <Text style={styles.verified}> ✅ Verified</Text>}
      </Text>

      <Text style={styles.ageText}>
        Age: {age !== null ? age : 'Loading...'}
      </Text>

      <View style={styles.card}>
  <Text style={styles.label}>Name: {profile.name || 'Not set'}</Text>
  <Text style={styles.label}>Bio: {profile.bio || 'Not set'}</Text>
  <Text style={styles.label}>Strain: {profile.strain || 'Not set'}</Text>
  <Text style={styles.label}>Style: {profile.style || 'Not set'}</Text>
  <Text style={styles.label}>
  Looking For:{' '}
  {profile.lookingFor === 'smoke'
    ? '🌿 Just Wanna Smoke'
    : profile.lookingFor === 'hookup'
    ? '🍑 Just Looking to Hook Up'
    : profile.lookingFor === 'both'
    ? '🌿+🍑 Both'
    : 'Not set'}
</Text>
  <TouchableOpacity style={styles.editButton} onPress={() => router.push('/profile-edit')}>
    <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
    </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/swipe')}>
        <Text style={styles.buttonText}>🔥 Back to Swiping</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 20,
    borderColor: '#00FF7F',
    borderWidth: 2,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  verified: {
    fontSize: 18,
    color: '#00FF7F',
    marginLeft: 6,
  },
  ageText: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 10,
  },
  bio: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    marginHorizontal: 30,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#00FF7F',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 10,
  },
  buttonText: {
    color: '#121212',
    fontWeight: '600',
    fontSize: 16,
  },
  card: {
  backgroundColor: '#1f1f1f',
  borderRadius: 16,
  padding: 20,
  width: '100%',
  marginBottom: 30,
  shadowColor: '#00FF7F',
  shadowOpacity: 0.2,
  shadowRadius: 10,
},
label: {
  color: '#eee',
  fontSize: 16,
  marginBottom: 6,
},
editButton: {
  backgroundColor: '#00FF7F',
  borderRadius: 25,
  paddingVertical: 10,
  paddingHorizontal: 25,
  marginTop: 15,
  alignSelf: 'center',
},
editButtonText: {
  color: '#121212',
  fontWeight: 'bold',
  fontSize: 15,
},
});
