// © 2025 Benjamin Hawk. All rights reserved.

import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert, Linking, } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { supabase } from '../supabaseClient';
// in settings.tsx






export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const router = useRouter();

  const toggleDarkMode = async () => {
    setDarkMode(prev => !prev);
    await AsyncStorage.setItem('theme', darkMode ? 'light' : 'dark');
    Updates.reloadAsync();
  };

  const toggleNotifications = () => {
    setNotifications(prev => !prev);
    // Hook in with notification system here if using one
  };

  const handleSignOut = async () => {
    await AsyncStorage.clear();
    router.replace('/login');
  };

  const handleDeleteAccount = () => {
  Alert.alert(
    "Delete Account",
    "Are you sure you want to delete your BlazeMates account? This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const {
              data: { user },
              error: userError
            } = await supabase.auth.getUser();

            if (userError || !user) {
              console.error(userError);
              Alert.alert("Error", "Failed to find user.");
              return;
            }

            const userId = user.id;

            // 🗑 Step 1: Delete profile data from 'profiles' table
            const { error: profileError } = await supabase
              .from('profiles')
              .delete()
              .eq('id', userId);

            if (profileError) {
              console.error(profileError);
              Alert.alert("Error", "Failed to delete profile data.");
              return;
            }

            // ⚠️ Step 2: Call Edge Function to delete user from Auth
            const session = await supabase.auth.getSession();
            const accessToken = session.data?.session?.access_token;

            const response = await fetch('https://zedfmjwqbikwynwqtylu.supabase.functions.supabase.co/delete-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ userId }),
            });

            if (!response.ok) {
              const result = await response.json();
              console.error(result);
              Alert.alert("Error", "Failed to delete user account.");
              return;
            }

            // ✅ Clear local data and redirect
            await AsyncStorage.clear();
            router.replace('/login');
            Alert.alert("Account Deleted", "Your account was successfully removed.");
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Something went wrong.");
          }
        }
      }
    ]
  );
};


  return (
    <View style={styles.container}>
      <Text style={styles.header}>⚙️ Settings</Text>

      <View style={styles.row}>
        <Text style={styles.label}>🌙 Dark Mode</Text>
        <Switch value={darkMode} onValueChange={toggleDarkMode} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>🔔 Push Notifications</Text>
        <Switch value={notifications} onValueChange={toggleNotifications} />
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/edit-profile')}>
        <Text style={styles.buttonText}>✏️ Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>🚪 Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonDanger} onPress={handleDeleteAccount}>
        <Text style={styles.buttonText}>🗑️ Delete Account</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('https://your-privacy-url')}>
        <Text style={styles.buttonText}>🔒 Privacy Policy</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>BlazeMates v1.0.0 — © 2025 Benjamin Hawk</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  header: { fontSize: 26, color: '#00FF7F', fontWeight: 'bold', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    alignItems: 'center',
  },
  label: { color: '#fff', fontSize: 16 },
  button: {
    backgroundColor: '#1f1f1f',
    padding: 14,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: 'center',
  },
  buttonDanger: {
    backgroundColor: '#ff5555',
    padding: 14,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    color: '#777',
    marginTop: 30,
    fontSize: 12,
    textAlign: 'center',
  },
});
