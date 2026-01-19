// app/_layout.tsx
// © 2025 Benjamin Hawk. All rights reserved.
// app/_layout.tsx (very top, before anything else)
import "react-native-url-polyfill/auto";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFrameworkReady } from "../hooks/useFrameworkReady";
import { useEffect } from "react";

LogBox.ignoreLogs(["Warning: useInsertionEffect must not schedule updates"]);

export default function Layout() {
  const ready = useFrameworkReady();

  // Load Google Ads tag on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Load gtag.js script
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = 'https://www.googletagmanager.com/gtag/js?id=AW-452104183';
      document.head.appendChild(script1);

      // Initialize gtag
      const script2 = document.createElement('script');
      script2.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'AW-452104183');
      `;
      document.head.appendChild(script2);
    }
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack
        initialRouteName="index"
        screenOptions={{ headerShown: false }} // This hides the top header on all screens
      />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
