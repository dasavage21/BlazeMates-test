// © 2025 Benjamin Hawk. All rights reserved.

import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';

export default function ProfileEditScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [strain, setStrain] = useState('');
  const [style, setStyle] = useState('');
  const [lookingFor, setLookingFor] = useState<'smoke' | 'hookup' | 'both'>('smoke');

  useEffect(() => {
    const loadProfile = async () => {
      const stored = await AsyncStorage.getItem('userProfile');
      if (stored) {
        const data = JSON.parse(stored);
        setName(data.name || '');
        setBio(data.bio || '');
        setStrain(data.strain || '');
        setStyle(data.style || '');
        setLookingFor(data.lookingFor || 'smoke');
      }
    };
    loadProfile();
  }, []);

  const saveProfile = async () => {
    if (!name.trim()) return Alert.alert('Name is required!');
    const newProfile = { name, bio, strain, style, lookingFor };
    await AsyncStorage.setItem('userProfile', JSON.stringify(newProfile));
    Alert.alert('Saved!', 'Your profile has been updated.');
    router.replace('/profile');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Your Profile</Text>

      <TextInput placeholder="Name" placeholderTextColor="#888" value={name} onChangeText={setName} style={styles.input} />
      <TextInput placeholder="Bio" placeholderTextColor="#888" value={bio} onChangeText={setBio} style={[styles.input, { height: 80 }]} multiline />
      <TextInput placeholder="Favorite Strain" placeholderTextColor="#888" value={strain} onChangeText={setStrain} style={styles.input} />
      <TextInput placeholder="Blaze Style" placeholderTextColor="#888" value={style} onChangeText={setStyle} style={styles.input} />

      <Text style={styles.label}>Looking For:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={lookingFor}
          onValueChange={(value: 'smoke' | 'hookup' | 'both') => setLookingFor(value)}
          style={styles.picker}
          dropdownIconColor="#00FF7F"
        >
          <Picker.Item label="🌿 Just Wanna Smoke" value="smoke" />
          <Picker.Item label="🍑 Just Looking to Hook Up" value="hookup" />
          <Picker.Item label="🌿+🍑 Both" value="both" />
        </Picker>
      </View>

      <TouchableOpacity style={styles.button} onPress={saveProfile}>
        <Text style={styles.buttonText}>💾 Save Changes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#121212',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#00FF7F',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    backgroundColor: '#1f1f1f',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  label: {
    alignSelf: 'flex-start',
    color: '#ccc',
    fontSize: 16,
    marginBottom: 6,
  },
  pickerContainer: {
    width: '100%',
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    marginBottom: 20,
  },
  picker: {
    color: '#fff',
    width: '100%',
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
    fontWeight: 'bold',
    fontSize: 16,
  },
});
