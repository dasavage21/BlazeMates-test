// app/index.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';

const AUTH_CACHE_KEYS = ['userProfile', 'userAge', 'pendingAvatarUri', 'avatarVersion', 'userId', 'theme'];

async function clearCachedSessionData() {
  try {
    await AsyncStorage.multiRemove(AUTH_CACHE_KEYS);
  } catch (err) {
    console.warn('Failed clearing cached auth data', err);
  }
}

export default function IndexGate() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (data.session?.user) {
          await AsyncStorage.setItem('userId', data.session.user.id);
          router.replace('/swipe');
          return;
        }

        await clearCachedSessionData();
        router.replace('/login');
      } catch (err) {
        console.warn('Initial session check failed', err);
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (signOutErr) {
          console.warn('Local sign out failed', signOutErr);
        }
        await clearCachedSessionData();
        router.replace('/login');
      } finally {
        setChecking(false);
      }
    };

    // react to future auth changes as well
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      const eventType = event as string;
      if (session?.user) {
        await AsyncStorage.setItem('userId', session.user.id);
        router.replace('/swipe');
        return;
      }

      if (eventType === 'TOKEN_REFRESH_FAILED') {
        // local session is invalidated (another device signed in or timed out)
        await supabase.auth.signOut({ scope: 'local' });
      }

      if (
        eventType === 'SIGNED_OUT' ||
        eventType === 'TOKEN_REFRESH_FAILED' ||
        eventType === 'USER_DELETED'
      ) {
        await clearCachedSessionData();
      }

      router.replace('/login');
    });

    run();
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#00FF7F" />
      </View>
    );
  }
  return null;
}
