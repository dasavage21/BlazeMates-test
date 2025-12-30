import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UsernameSetupScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSaveUsername = async () => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      Alert.alert('Required', 'Please enter a username to continue.');
      return;
    }

    if (trimmedUsername.length < 3) {
      Alert.alert('Too Short', 'Username must be at least 3 characters.');
      return;
    }

    if (trimmedUsername.length > 20) {
      Alert.alert('Too Long', 'Username must be 20 characters or less.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      Alert.alert('Invalid Format', 'Username can only contain letters, numbers, and underscores.');
      return;
    }

    setBusy(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        Alert.alert('Error', 'You must be logged in to set a username.');
        router.replace('/login');
        return;
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', trimmedUsername)
        .maybeSingle();

      if (existingUser) {
        Alert.alert('Taken', 'This username is already taken. Please choose another.');
        setBusy(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ username: trimmedUsername })
        .eq('id', user.id);

      if (updateError) {
        console.error('Username update error:', updateError);
        Alert.alert('Error', 'Failed to save username. Please try again.');
        setBusy(false);
        return;
      }

      const existingProfile = JSON.parse(
        (await AsyncStorage.getItem('userProfile')) || '{}'
      );
      existingProfile.username = trimmedUsername;
      await AsyncStorage.setItem('userProfile', JSON.stringify(existingProfile));

      router.replace('/profile');
    } catch (error) {
      console.error('Username setup exception:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Choose a Username</Text>
        <Text style={styles.subtitle}>
          You need a username to use BlazeMates. Choose wisely!
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#888"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          maxLength={20}
        />

        <Text style={styles.hint}>
          3-20 characters, letters, numbers, and underscores only
        </Text>

        <TouchableOpacity
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={handleSaveUsername}
          disabled={busy}
        >
          <Text style={styles.btnText}>{busy ? 'Saving...' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#00FF7F',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#1f1f1f',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    fontSize: 16,
  },
  hint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: '#00FF7F',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
