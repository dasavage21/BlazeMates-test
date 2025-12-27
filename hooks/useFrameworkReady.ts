import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export function useFrameworkReady() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
}
