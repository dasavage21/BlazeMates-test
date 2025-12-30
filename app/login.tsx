// app/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { handleRefreshTokenError } from '../lib/authSession';
import { mergeUserRow } from '../lib/userStore';

async function syncPendingAvatarIfAuthed() {
  try {
    const pending = await AsyncStorage.getItem('pendingAvatarUri');
    if (!pending) return;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const file = {
      uri: pending,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as any;
    const path = `avatars/${user.id}/avatar.jpg`;
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = pub.publicUrl;
    await mergeUserRow(supabase, user.id, { image_url: publicUrl });
    const existing = JSON.parse(
      (await AsyncStorage.getItem('userProfile')) || '{}'
    );
    existing.profileImage = publicUrl;
    await AsyncStorage.setItem('userProfile', JSON.stringify(existing));
    await AsyncStorage.removeItem('pendingAvatarUri');
  } catch (error) {
    const handled = await handleRefreshTokenError(error);
    if (!handled) {
      console.warn('syncPendingAvatarIfAuthed login failed', error);
    }
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const hydrateProfileCache = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const storedAgeStr = await AsyncStorage.getItem('userAge');
      const localAge =
        storedAgeStr && !Number.isNaN(parseInt(storedAgeStr, 10))
          ? parseInt(storedAgeStr, 10)
          : null;

      const existingRaw = await AsyncStorage.getItem('userProfile');
      const existing = existingRaw ? JSON.parse(existingRaw) : {};

      const { data: profileData, error } = await supabase
        .from('users')
        .select('name,bio,strain,style,looking_for,image_url,age')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !profileData) {
        if (localAge !== null) {
          const existing = JSON.parse((await AsyncStorage.getItem('userProfile')) || '{}');
          await AsyncStorage.setItem(
            'userProfile',
            JSON.stringify({ ...existing, age: localAge })
          );
        }
        return;
      }

      const remoteAge =
        typeof profileData.age === 'number' && profileData.age > 0
          ? profileData.age
          : null;
      let finalAge = remoteAge ?? localAge;

      if (remoteAge === null && localAge !== null) {
        await mergeUserRow(supabase, user.id, { age: localAge });
        finalAge = localAge;
      }

      const resolvedAge = finalAge ?? (existing.age ?? null);

      const mergedProfile = {
        name: profileData.name ?? existing.name ?? '',
        bio: profileData.bio ?? existing.bio ?? '',
        strain: profileData.strain ?? existing.strain ?? '',
        style: profileData.style ?? existing.style ?? '',
        lookingFor: profileData.looking_for ?? existing.lookingFor ?? 'smoke',
        profileImage: profileData.image_url ?? existing.profileImage ?? null,
        age: resolvedAge,
      };

      await AsyncStorage.setItem('userProfile', JSON.stringify(mergedProfile));
      if (resolvedAge !== null) {
        await AsyncStorage.setItem('userAge', resolvedAge.toString());
      }
    } catch (e) {
      const handled = await handleRefreshTokenError(e);
      if (!handled) {
        console.warn('hydrateProfileCache failed', e);
      }
    }
  };

  const signIn = async () => {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Sign in failed', error.message);
        return;
      }
      await syncPendingAvatarIfAuthed();
      await hydrateProfileCache();
      router.replace('/profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={styles.title}>Sign in</Text>
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword}/>
        <TouchableOpacity onPress={() => router.push('/forgot-password')}>
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={signIn} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={() => router.push('/create-account')}>
          <Text style={styles.link}>Create account</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#121212' },
  scrollView: { flex: 1, backgroundColor: '#121212' },
  container:{ flexGrow:1, backgroundColor:'#121212', padding:20, justifyContent:'center' },
  title:{ color:'#00FF7F', fontSize:24, fontWeight:'bold', marginBottom:16, textAlign:'center' },
  input:{ backgroundColor:'#1f1f1f', color:'#fff', borderRadius:10, padding:14, marginBottom:12 },
  btn:{ backgroundColor:'#00FF7F', padding:14, borderRadius:10, alignItems:'center' },
  btnText:{ color:'#121212', fontWeight:'bold' },
  link:{ color:'#00FF7F', marginTop:14, textAlign:'center' },
});
