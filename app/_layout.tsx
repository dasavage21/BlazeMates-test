// app/_layout.tsx

// © 2025 Benjamin Hawk. All rights reserved.

// eslint-disable-next-line import/no-duplicates
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '../lib/ThemeContext';
// eslint-disable-next-line import/no-duplicates
import { usePathname, useRouter } from 'expo-router';
import 'react-native-url-polyfill/auto';
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
  }, [pathname, router]);

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
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#121212' },
            headerTintColor: '#00FF7F',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="swipe" options={{ headerShown: false }} />
          

        </Stack>
        <StatusBar style="light" />
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
