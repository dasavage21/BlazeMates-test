// app/forgot-password.tsx
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { supabase } from "../supabaseClient";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const sendReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Enter your email", "We need your email address to send a reset link.");
      return;
    }

    try {
      setBusy(true);
      const redirectTo = Linking.createURL("/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) {
        Alert.alert("Reset failed", error.message);
        return;
      }
      Alert.alert(
        "Check your inbox",
        "We sent a password reset link to your email address."
      );
      router.replace("/login");
    } catch (err: any) {
      Alert.alert("Reset failed", err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot password</Text>
      <Text style={styles.subtitle}>
        Enter the email address tied to your account. We'll send you a reset link.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TouchableOpacity style={styles.btn} onPress={sendReset} disabled={busy}>
        <Text style={styles.btnText}>{busy ? "Sending…" : "Send reset link"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={styles.link}>Back to sign in</Text>
      </TouchableOpacity>
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
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1f1f1f",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: "#00FF7F",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: {
    color: "#121212",
    fontWeight: "bold",
  },
  link: {
    color: "#00FF7F",
    marginTop: 18,
    textAlign: "center",
  },
});
