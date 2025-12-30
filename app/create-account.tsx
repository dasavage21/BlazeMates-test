// app/create-account.tsx

import React, { useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../supabaseClient";
import { mergeUserRow } from "../lib/userStore";
import { validatePassword, calculatePasswordStrength } from "../lib/passwordSecurity";
import { clearLocalAuthSession } from "../lib/authSession";

export default function CreateAccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    level: 'weak' | 'medium' | 'strong';
    checks: {
      minLength: boolean;
      hasUppercase: boolean;
      hasLowercase: boolean;
      hasNumber: boolean;
      hasSpecialChar: boolean;
      isLongEnough: boolean;
    };
  } | null>(null);

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (text.length > 0) {
      const strength = calculatePasswordStrength(text);
      setPasswordStrength({ level: strength.level, checks: strength.checks });
    } else {
      setPasswordStrength(null);
    }
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedUsername = username.trim();
    const trimmedAge = ageInput.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert("Missing details", "Enter an email and password to continue.");
      return;
    }

    if (!trimmedUsername) {
      Alert.alert("Username Required", "Please enter a username.");
      return;
    }

    if (trimmedUsername.length < 3) {
      Alert.alert("Username Too Short", "Username must be at least 3 characters.");
      return;
    }

    if (trimmedUsername.length > 20) {
      Alert.alert("Username Too Long", "Username must be 20 characters or less.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      Alert.alert("Invalid Username", "Username can only contain letters, numbers, and underscores.");
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
      await clearLocalAuthSession();

      const passwordValidation = await validatePassword(trimmedPassword);
      if (!passwordValidation.isValid) {
        Alert.alert("Weak Password", passwordValidation.errors.join("\n"));
        setBusy(false);
        return;
      }

      console.log("Starting signup for:", trimmedEmail);
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: { data: { age: ageNum } },
      });

      if (error) {
        console.error("Sign up error:", error);
        Alert.alert("Sign up failed", error.message);
        setBusy(false);
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        console.error("No user ID returned from signup");
        Alert.alert("Error", "Failed to create account. Please try again.");
        setBusy(false);
        return;
      }

      console.log("User created with ID:", userId);

      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', trimmedUsername)
        .maybeSingle();

      if (existingUser) {
        Alert.alert("Username Taken", "This username is already taken. Please choose another.");
        setBusy(false);
        return;
      }

      const session = data?.session;
      if (!session) {
        console.log("No session returned - email confirmation required");
        Alert.alert("Email Confirmation Required", "Please check your email and confirm your account before logging in.");
        setBusy(false);
        router.replace("/login");
        return;
      }

      console.log("Session established, creating profile");
      const mergeResult = await mergeUserRow(supabase, userId, {
        age: ageNum,
        username: trimmedUsername
      });

      if (mergeResult.error) {
        console.error("Profile creation error:", mergeResult.error);
        const errorMsg = mergeResult.error.message || JSON.stringify(mergeResult.error);
        Alert.alert("Profile Setup Failed", `Error: ${errorMsg}\n\nYour account was created but the profile setup failed. Please try logging in.`);
        setBusy(false);
        return;
      }

      console.log("Profile created successfully");
      await AsyncStorage.setItem("userAge", ageNum.toString());
      await AsyncStorage.setItem(
        "userProfile",
        JSON.stringify({
          age: ageNum,
          username: trimmedUsername
        })
      );

      router.replace("/profile");
    } catch (error) {
      console.error("Sign up exception:", error);
      const errorMsg = (error as { message?: string })?.message ?? String(error);
      Alert.alert("Sign up failed", errorMsg);
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
        <Text style={styles.title}>Create account</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#888"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          maxLength={20}
        />
        <Text style={styles.hint}>
          3-20 characters, letters, numbers, and underscores only
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
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={handlePasswordChange}
        />

        {passwordStrength && (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBar}>
              <View
                style={[
                  styles.strengthFill,
                  passwordStrength.level === 'weak' && styles.strengthWeak,
                  passwordStrength.level === 'medium' && styles.strengthMedium,
                  passwordStrength.level === 'strong' && styles.strengthStrong,
                ]}
              />
            </View>
            <Text
              style={[
                styles.strengthText,
                passwordStrength.level === 'weak' && styles.strengthTextWeak,
                passwordStrength.level === 'medium' && styles.strengthTextMedium,
                passwordStrength.level === 'strong' && styles.strengthTextStrong,
              ]}
            >
              {passwordStrength.level === 'weak' && 'Weak Password'}
              {passwordStrength.level === 'medium' && 'Medium Password'}
              {passwordStrength.level === 'strong' && 'Strong Password'}
            </Text>
          </View>
        )}

        <View style={styles.requirementsContainer}>
          <Text style={[
            styles.requirement,
            passwordStrength?.checks.minLength && styles.requirementMet
          ]}>
            {passwordStrength?.checks.minLength ? '✓' : '○'} At least 8 characters
          </Text>
          <Text style={[
            styles.requirement,
            passwordStrength?.checks.hasUppercase && styles.requirementMet
          ]}>
            {passwordStrength?.checks.hasUppercase ? '✓' : '○'} One uppercase letter
          </Text>
          <Text style={[
            styles.requirement,
            passwordStrength?.checks.hasLowercase && styles.requirementMet
          ]}>
            {passwordStrength?.checks.hasLowercase ? '✓' : '○'} One lowercase letter
          </Text>
          <Text style={[
            styles.requirement,
            passwordStrength?.checks.hasNumber && styles.requirementMet
          ]}>
            {passwordStrength?.checks.hasNumber ? '✓' : '○'} One number
          </Text>
        </View>
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
  hint: {
    color: "#888",
    fontSize: 12,
    marginBottom: 12,
    marginTop: -4,
  },
  strengthContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  strengthBar: {
    height: 6,
    backgroundColor: "#1f1f1f",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.3s ease",
  },
  strengthWeak: {
    width: "33%",
    backgroundColor: "#FF3B5C",
  },
  strengthMedium: {
    width: "66%",
    backgroundColor: "#FFA500",
  },
  strengthStrong: {
    width: "100%",
    backgroundColor: "#00FF7F",
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },
  strengthTextWeak: {
    color: "#FF3B5C",
  },
  strengthTextMedium: {
    color: "#FFA500",
  },
  strengthTextStrong: {
    color: "#00FF7F",
  },
  requirementsContainer: {
    marginBottom: 16,
  },
  requirement: {
    color: "#666",
    fontSize: 12,
    marginBottom: 4,
  },
  requirementMet: {
    color: "#00FF7F",
  },
});
