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
import { validatePassword, calculatePasswordStrength } from "../lib/passwordSecurity";

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

  const passwordStrength = useMemo(
    () => password.length > 0 ? calculatePasswordStrength(password) : null,
    [password]
  );

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
      router.replace("/login");
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
          style={[styles.input, !tokens && styles.inputDisabled]}
          placeholder="New password (min. 8 chars)"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          editable={!!tokens && !busy}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          selectionColor="#00FF7F"
        />

        {passwordStrength && (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBar}>
              <View
                style={[
                  styles.strengthBarFill,
                  passwordStrength.level === 'weak' && styles.strengthWeak,
                  passwordStrength.level === 'medium' && styles.strengthMedium,
                  passwordStrength.level === 'strong' && styles.strengthStrong,
                  { width: `${(passwordStrength.score / 6) * 100}%` },
                ]}
              />
            </View>
            <Text
              style={[
                styles.strengthLabel,
                passwordStrength.level === 'weak' && styles.strengthWeakText,
                passwordStrength.level === 'medium' && styles.strengthMediumText,
                passwordStrength.level === 'strong' && styles.strengthStrongText,
              ]}
            >
              {passwordStrength.level === 'weak' && 'Weak'}
              {passwordStrength.level === 'medium' && 'Medium'}
              {passwordStrength.level === 'strong' && 'Strong'}
            </Text>
            <View style={styles.checksContainer}>
              <Text style={[styles.checkItem, passwordStrength.checks.minLength && styles.checkValid]}>
                {passwordStrength.checks.minLength ? '✓' : '○'} At least 8 characters
              </Text>
              <Text style={[styles.checkItem, passwordStrength.checks.hasUppercase && styles.checkValid]}>
                {passwordStrength.checks.hasUppercase ? '✓' : '○'} Uppercase letter
              </Text>
              <Text style={[styles.checkItem, passwordStrength.checks.hasLowercase && styles.checkValid]}>
                {passwordStrength.checks.hasLowercase ? '✓' : '○'} Lowercase letter
              </Text>
              <Text style={[styles.checkItem, passwordStrength.checks.hasNumber && styles.checkValid]}>
                {passwordStrength.checks.hasNumber ? '✓' : '○'} Number
              </Text>
              <Text style={[styles.checkItem, passwordStrength.checks.hasSpecialChar && styles.checkValid]}>
                {passwordStrength.checks.hasSpecialChar ? '✓' : '○'} Special character
              </Text>
            </View>
          </View>
        )}

        <TextInput
          style={[styles.input, !tokens && styles.inputDisabled]}
          placeholder="Confirm new password"
          placeholderTextColor="#888"
          secureTextEntry
          value={confirmPassword}
          editable={!!tokens && !busy}
          onChangeText={setConfirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          selectionColor="#00FF7F"
        />

        {confirmPassword.length > 0 && (
          <View style={styles.matchContainer}>
            {password === confirmPassword ? (
              <Text style={styles.matchText}>✓ Passwords match</Text>
            ) : (
              <Text style={styles.noMatchText}>○ Passwords do not match</Text>
            )}
          </View>
        )}

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
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: "#0f0f0f",
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
  strengthContainer: {
    marginBottom: 16,
    marginTop: -8,
  },
  strengthBar: {
    height: 6,
    backgroundColor: "#2a2a2a",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  strengthBarFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.3s ease",
  },
  strengthWeak: {
    backgroundColor: "#ff4444",
  },
  strengthMedium: {
    backgroundColor: "#ffaa00",
  },
  strengthStrong: {
    backgroundColor: "#00FF7F",
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  strengthWeakText: {
    color: "#ff4444",
  },
  strengthMediumText: {
    color: "#ffaa00",
  },
  strengthStrongText: {
    color: "#00FF7F",
  },
  checksContainer: {
    marginTop: 6,
  },
  checkItem: {
    color: "#666",
    fontSize: 12,
    marginBottom: 4,
  },
  checkValid: {
    color: "#00FF7F",
  },
  matchContainer: {
    marginBottom: 16,
    marginTop: -8,
  },
  matchText: {
    color: "#00FF7F",
    fontSize: 13,
    fontWeight: "600",
  },
  noMatchText: {
    color: "#ff4444",
    fontSize: 13,
    fontWeight: "600",
  },
});
