// app/_layout.tsx
// © 2025 Benjamin Hawk. All rights reserved.
// app/_layout.tsx (very top, before anything else)
import "react-native-url-polyfill/auto";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFrameworkReady } from "../hooks/useFrameworkReady";

LogBox.ignoreLogs(["Warning: useInsertionEffect must not schedule updates"]);

export default function Layout() {
  useFrameworkReady();

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
