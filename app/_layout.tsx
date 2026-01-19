// app/_layout.tsx
// © 2025 Benjamin Hawk. All rights reserved.
// app/_layout.tsx (very top, before anything else)
import "react-native-url-polyfill/auto";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFrameworkReady } from "../hooks/useFrameworkReady";
import { Head } from "expo-router/head";

LogBox.ignoreLogs(["Warning: useInsertionEffect must not schedule updates"]);

export default function Layout() {
  const ready = useFrameworkReady();

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {Platform.OS === 'web' && (
        <Head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=AW-452104183"></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'AW-452104183');
              `,
            }}
          />
        </Head>
      )}
      <Stack
        initialRouteName="index"
        screenOptions={{ headerShown: false }} // This hides the top header on all screens
      />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
