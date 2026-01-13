// Ac 2025 Benjamin Hawk. All rights reserved.

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../supabaseClient";
import { handleRefreshTokenError } from "../lib/authSession";
import { mergeUserRow } from "../lib/userStore";

const MIN_AGE = 21;

export default function AgeCheck() {
  const router = useRouter();
  const [age, setAge] = useState("");

  const handleContinue = async () => {
    const ageNum = Number.parseInt(age.trim(), 10);
    if (Number.isNaN(ageNum)) {
      Alert.alert("Invalid age", "Please enter a valid number.");
      return;
    }

    if (ageNum < MIN_AGE) {
      await AsyncStorage.removeItem("userAge");
      Alert.alert(
        "21+ Required",
        "Per Google Play's age-restricted content policy, BlazeMates is only available to adults 21 and older.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/underage-blocked"),
          },
        ]
      );
      return;
    }

    try {
      await AsyncStorage.setItem("userAge", ageNum.toString());

      const existingRaw = await AsyncStorage.getItem("userProfile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      await AsyncStorage.setItem(
        "userProfile",
        JSON.stringify({ ...existing, age: ageNum })
      );

      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id ?? null;
      if (userId) {
        await mergeUserRow(supabase, userId, { age: ageNum });
      }

      router.replace(userId ? "/swipe" : "/login");
    } catch (err) {
      const handled = await handleRefreshTokenError(err);
      if (handled) {
        Alert.alert(
          "Session expired",
          "Please sign in again to confirm your age.",
          [{ text: "OK", onPress: () => router.replace("/login") }]
        );
        return;
      }
      Alert.alert("Error", "Unable to save your age. Try again.");
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adult-only experience</Text>
      <Text style={styles.subhead}>
        BlazeMates includes community connection features and complies with Google
        Play&apos;s Age-Restricted Content policy. You must confirm you are 21
        or older to continue.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your age (21+)"
        placeholderTextColor="#777"
        keyboardType="number-pad"
        value={age}
        onChangeText={setAge}
      />
      <Button title="Continue" color="#00FF7F" onPress={handleContinue} />

      <Text style={styles.footer}>
        Need details? Review our{" "}
        <Text
          style={styles.link}
          onPress={() =>
            Linking.openURL(
              "https://dasavage21.github.io/BlazeMates-test/child-safety.html"
            )
          }
        >
          child safety standards
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "#00FF7F",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  subhead: {
    color: "#ddd",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#1f1f1f",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  footer: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  link: {
    color: "#00FF7F",
    textDecorationLine: "underline",
  },
});
