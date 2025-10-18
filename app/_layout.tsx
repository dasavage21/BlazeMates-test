// app/_layout.tsx
// © 2025 Benjamin Hawk. All rights reserved.
// app/_layout.tsx (very top, before anything else)
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, LogBox, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../lib/ThemeContext";

LogBox.ignoreLogs(["Warning: useInsertionEffect must not schedule updates"]);

export default function Layout() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // after reading age
      const ageStr = await AsyncStorage.getItem("userAge");
      const age = ageStr ? parseInt(ageStr) : null;
      void age; // satisfy eslint without altering logic

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#00FF7F" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Stack
          initialRouteName="swipe"
          screenOptions={{ headerShown: false }} // This hides the top header on all screens
        />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
});
