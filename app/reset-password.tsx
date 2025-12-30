// app/reset-password.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { supabase } from "../supabaseClient";
import { validatePassword } from "../lib/passwordSecurity";

type RecoveryTokens = {
  access_token: string;
  refresh_token: string;
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState<RecoveryTokens | null>(null);

  const parsedUrl = Linking.useURL();

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;

      const hash = url.split("#")[1] ?? "";
      if (!hash) return;

      const params = new URLSearchParams(hash);
      const type = params.get("type");
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (
        type === "recovery" &&
        access_token &&
        refresh_token &&
        access_token.length > 0 &&
        refresh_token.length > 0
      ) {
        setTokens({ access_token, refresh_token });
      }
    };

    handleUrl(parsedUrl);
  }, [parsedUrl]);

  useEffect(() => {
    if (!tokens) return;
    const applySession = async () => {
      try {
        const { access_token, refresh_token } = tokens;
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          Alert.alert("Link invalid", error.message);
          setTokens(null);
        }
      } catch (err: any) {
        Alert.alert(
          "Link invalid",
          err?.message ?? "We could not validate this reset link."
        );
        setTokens(null);
      }
    };
    applySession();
  }, [tokens]);

  const disabled = useMemo(
    () =>
      busy ||
      !tokens ||
      password.trim().length < 8 ||
      password.trim() !== confirmPassword.trim(),
    [busy, tokens, password, confirmPassword]
  );

  const submit = async () => {
    if (!tokens) {
      Alert.alert(
        "Missing reset token",
        "Please open the password reset email again."
      );
      return;
    }
    if (password.trim().length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      Alert.alert("Passwords do not match", "Make sure both fields match.");
      return;
    }

    try {
      setBusy(true);
      const passwordValidation = await validatePassword(password.trim());
      if (!passwordValidation.isValid) {
        Alert.alert("Weak Password", passwordValidation.errors.join("\n"));
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });
      if (error) {
        Alert.alert("Could not update password", error.message);
        return;
      }
      Alert.alert("Password updated", "You can sign in with the new password.", [
        {
          text: "OK",
          onPress: () => router.replace("/login"),
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Could not update password",
        err?.message ?? "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.caption}>
          {tokens
            ? "Enter a new password for your BlazeMates account."
            : "Open the password reset email from your device to continue."}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="New password (min. 8 chars)"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          editable={!!tokens && !busy}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#888"
          secureTextEntry
          value={confirmPassword}
          editable={!!tokens && !busy}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity
          style={[styles.btn, disabled ? styles.btnDisabled : null]}
          onPress={submit}
          disabled={disabled}
        >
          <Text style={styles.btnText}>
            {busy ? "Updating…" : "Update password"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/login")}>
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    flexGrow: 1,
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
  caption: {
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
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
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
