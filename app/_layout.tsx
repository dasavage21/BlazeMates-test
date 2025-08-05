// © 2025 Benjamin Hawk. All rights reserved.

import { Slot, usePathname, useRouter } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '../lib/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';


import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'Warning: useInsertionEffect must not schedule updates',
]);

export default function Layout() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    const checkAge = async () => {
      const ageStr = await AsyncStorage.getItem('userAge');
      const age = ageStr ? parseInt(ageStr) : null;

      if (!age || isNaN(age) || age < 21) {
        if (pathname !== '/age-check') {
          router.replace('/age-check');
        }
      } else if (pathname === '/' || pathname === '/login' || pathname === '/signup') {
        router.replace('/swipe');
      }

      setLoading(false);
    };

    checkAge();
  }, [pathname]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00FF7F" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <View style={styles.container}>
          <Slot />
          <StatusBar style="light" />
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
});
