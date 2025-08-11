// © 2025 Benjamin Hawk. All rights reserved.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Camera } from 'expo-camera';
import 'react-native-get-random-values';


import { supabase } from '../supabaseClient';

type Looking = 'smoke' | 'hookup' | 'both';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri?: string }>();

  // form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [strain, setStrain] = useState('');
  const [style, setStyle] = useState('');
  const [lookingFor, setLookingFor] = useState<Looking>('smoke');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // camera permission state (optional, for the button that opens camera)
  const [hasCamPermission, setHasCamPermission] = useState<boolean | null>(null);
  // Make sure the logged-in user has a row in `users`
const ensureUserRow = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // not logged in -> we’ll just save locally

  await supabase
    .from('users')
    .upsert({ id: user.id, name: (name || user.user_metadata?.name) ?? null }, { onConflict: 'id' });
};

// Save a public photo URL into `users.image_url`
const savePhotoUrlToProfile = async (publicUrl: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // offline/guest

  const { error } = await supabase
    .from('users')
    .update({ image_url: publicUrl })
    .eq('id', user.id);

  if (!error) {
    setProfileImage(publicUrl); // reflect in UI
  }
};

// Upload a local file to Storage bucket `avatars/` and then store its public URL
const uploadAndSavePhoto = async (localUri: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Not logged in: just preview locally
    setProfileImage(localUri);
    return;
  }

  const blob = await fetch(localUri).then(r => r.blob());
  const path = `avatars/${user.id}-${Date.now()}.jpg`;

  const { error: uploadErr } = await supabase
    .storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    console.warn('upload error', uploadErr);
    // still show preview
    setProfileImage(localUri);
    return;
  }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  await savePhotoUrlToProfile(pub.publicUrl);
};
   // 1) Ensure the user row exists when the screen mounts
useEffect(() => {
  ensureUserRow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// 2) If we came back from the camera with a photo,
//    upload to Storage and save its URL.
//    (We still preview immediately.)
useEffect(() => {
  if (photoUri) {
    setProfileImage(photoUri);       // instant preview
    uploadAndSavePhoto(photoUri);    // background upload + DB update
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [photoUri]);

  // if we came back from the camera screen with a photo
  useEffect(() => {
    if (photoUri) setProfileImage(photoUri);
  }, [photoUri]);

  // load profile + ask for camera permission on mount
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem('userProfile');
        if (stored) {
          const data = JSON.parse(stored);
          setName(data.name ?? '');
          setBio(data.bio ?? '');
          setStrain(data.strain ?? '');
          setStyle(data.style ?? '');
          setLookingFor((data.lookingFor as Looking) ?? 'smoke');
          setProfileImage(data.profileImage ?? null);
        }
      } catch (e) {
        console.warn('Failed to load profile', e);
      }

      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasCamPermission(status === 'granted');
      } catch {
        setHasCamPermission(false);
      }
    };
    init();
  }, []);

  const saveProfile = async () => {
  if (!name.trim()) {
    Alert.alert('Name is required!');
    return;
  }

  const newProfile = { name, bio, strain, style, lookingFor, profileImage };

  try {
    // Always cache locally for fast UX/offline
    await AsyncStorage.setItem('userProfile', JSON.stringify(newProfile));

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Upsert to Supabase using auth.uid() — required by your RLS policies
      const { error } = await supabase.from('users').upsert([
        {
          id: user.id,               // ✅ must match auth.uid()
          name,
          bio,
          strain,
          style,
          looking_for: lookingFor,
          image_url: profileImage ?? null,
        },
      ]);

      if (error) {
        console.error(error);
        Alert.alert('Saved locally', 'Online save failed (will retry later).');
      } else {
        Alert.alert('Saved!', 'Your profile has been updated.');
      }
    } else {
      // Not logged in: just local save
      Alert.alert('Saved locally', 'Sign in to sync your profile online.');
    }

    router.replace('/profile');
  } catch (e) {
    console.error('Error saving profile:', e);
    Alert.alert('Error', 'Could not save your profile. Please try again.');
  }
};


  const openCamera = () => {
    if (!hasCamPermission) {
      Alert.alert('Permission required', 'Enable camera access in Settings to take a profile photo.');
      return;
    }
    router.push('/camera'); // navigates to your camera screen
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Your Profile</Text>

      {profileImage && (
        <Image
          source={{ uri: profileImage }}
          style={{ width: 150, height: 150, borderRadius: 75, marginBottom: 20 }}
        />
      )}

      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={openCamera}>
        <Text style={styles.buttonSecondaryText}>📷 Take Profile Photo</Text>
      </TouchableOpacity>

      <TextInput placeholder="Name" placeholderTextColor="#888" value={name} onChangeText={setName} style={styles.input} />
      <TextInput placeholder="Bio" placeholderTextColor="#888" value={bio} onChangeText={setBio} style={[styles.input, { height: 80 }]} multiline />
      <TextInput placeholder="Favorite Strain" placeholderTextColor="#888" value={strain} onChangeText={setStrain} style={styles.input} />
      <TextInput placeholder="Blaze Style" placeholderTextColor="#888" value={style} onChangeText={setStyle} style={styles.input} />

      <Text style={styles.label}>Looking For:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={lookingFor}
          onValueChange={(value: Looking) => setLookingFor(value)}
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

      {hasCamPermission === false && (
        <Text style={{ color: '#ff7777', marginTop: 12 }}>
          Camera permission denied. You can enable it in system settings.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#121212', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#00FF7F', marginBottom: 20 },
  input: { width: '100%', backgroundColor: '#1f1f1f', color: '#fff', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 20 },
  label: { alignSelf: 'flex-start', color: '#ccc', fontSize: 16, marginBottom: 6 },
  pickerContainer: { width: '100%', backgroundColor: '#1f1f1f', borderRadius: 10, marginBottom: 20 },
  picker: { color: '#fff', width: '100%' },
  button: { backgroundColor: '#00FF7F', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30, marginTop: 10, alignItems: 'center', width: '100%' },
  buttonText: { color: '#121212', fontWeight: 'bold', fontSize: 16 },
  secondaryButton: { backgroundColor: '#1f1f1f' },
  buttonSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
