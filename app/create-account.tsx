// app/create-account.tsx

import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../supabaseClient";
import { mergeUserRow } from "../lib/userStore";
import { validatePassword } from "../lib/passwordSecurity";

export default function CreateAccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedAge = ageInput.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert("Missing details", "Enter an email and password to continue.");
      return;
    }

    const ageNum = Number.parseInt(trimmedAge, 10);
    if (Number.isNaN(ageNum)) {
      Alert.alert("Enter your age", "We need your age to create an account.");
      return;
    }
    if (ageNum < 21) {
      Alert.alert("Must be 21+", "BlazeMates is only for 21 and older.");
      return;
    }

    setBusy(true);
    try {
      const passwordValidation = await validatePassword(trimmedPassword);
      if (!passwordValidation.isValid) {
        Alert.alert("Weak Password", passwordValidation.errors.join("\n"));
        setBusy(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: { data: { age: ageNum } },
      });
      if (error) {
        Alert.alert("Sign up failed", error.message);
        return;
      }

      const userId = data?.user?.id;
      if (userId) {
        await mergeUserRow(supabase, userId, { age: ageNum });
      }

      await AsyncStorage.setItem("userAge", ageNum.toString());
      const existingRaw = await AsyncStorage.getItem("userProfile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      await AsyncStorage.setItem(
        "userProfile",
        JSON.stringify({ ...existing, age: ageNum })
      );

      router.replace("/profile");
    } catch (error) {
      console.warn("Sign up failed", error);
      Alert.alert(
        "Sign up failed",
        (error as { message?: string })?.message ??
          "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Age (21+)"
        placeholderTextColor="#888"
        keyboardType="number-pad"
        value={ageInput}
        onChangeText={setAgeInput}
      />

      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={handleSignUp}
        disabled={busy}
      >
        <Text style={styles.btnText}>{busy ? "Creating..." : "Sign Up"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        disabled={busy}
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.link}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    color: "#00FF7F",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1f1f1f",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#00FF7F",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#121212",
    fontWeight: "bold",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  link: {
    color: "#00FF7F",
    textAlign: "center",
  },
});
