import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {
  console.log('SplashScreen.preventAutoHideAsync() not available');
});

export function useFrameworkReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('Framework preparation error:', e);
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {
          console.log('SplashScreen.hideAsync() not available');
        });
      }
    }

    prepare();
  }, []);

  return ready;
}
