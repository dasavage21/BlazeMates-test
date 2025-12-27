// Ac 2025 Benjamin Hawk. All rights reserved.

import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../lib/ThemeContext";
import {
  clearLocalAuthSession,
  handleRefreshTokenError,
} from "../lib/authSession";
import { supabase } from "../supabaseClient";

// in settings.tsx

export default function SettingsScreen() {
  const { isDark, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const router = useRouter();
  const showThemeToggle = false; // flip to true when exposing the theme switch

  const handleToggleTheme = useCallback(async () => {
    try {
      await toggleTheme();
    } catch (error) {
      console.error("Failed to toggle theme", error);
      Alert.alert("Theme Error", "Unable to change the app theme right now.");
    }
  }, [toggleTheme]);

  const handleThemeSwitch = useCallback(() => {
    void handleToggleTheme();
  }, [handleToggleTheme]);

  const toggleNotifications = () => {
    setNotifications((prev) => !prev);
    // Hook in with notification system here if using one
  };

  const handleSignOut = async () => {
    await clearLocalAuthSession();
    router.replace("/login");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your BlazeMates account? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const {
                data: { user },
                error: userError,
              } = await supabase.auth.getUser();
              if (userError || !user) {
                console.error(userError);
                Alert.alert("Error", "Failed to find user.");
                return;
              }

              // Call Edge Function to delete the user from Auth + storage + tables
              const { data: session } = await supabase.auth.getSession();
              const accessToken = session?.session?.access_token;
              if (!accessToken) {
                Alert.alert("Error", "Missing session token. Please sign in again.");
                return;
              }

              const FUNCTION_BASE =
                "https://zedfmjwqbikwynwqtylu.functions.supabase.co";
              const resp = await fetch(`${FUNCTION_BASE}/delete-user`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ userId: user.id }),
              });

              if (!resp.ok) {
                const result = (await resp.json().catch(() => ({}))) as {
                  error?: string;
                };
                console.error(result);
                Alert.alert(
                  "Error",
                  result?.error ?? "Failed to delete user account."
                );
                return;
              }

              await clearLocalAuthSession();
              Alert.alert("Account Deleted", "Your account was successfully removed.", [
                {
                  text: "OK",
                  onPress: () => router.replace("/login"),
                },
              ]);
            } catch (err) {
              const handled = await handleRefreshTokenError(err);
              if (handled) {
                Alert.alert(
                  "Session expired",
                  "Please sign in again to manage your account.",
                  [{ text: "OK", onPress: () => router.replace("/login") }]
                );
                return;
              }
              console.error(err);
              Alert.alert("Error", "Something went wrong.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Settings</Text>
      </View>

      {showThemeToggle && (
        <View style={styles.row}>
          <Text style={styles.label}>
            {isDark ? "Dark Theme Enabled" : "Light Theme Enabled"}
          </Text>
          <Switch value={isDark} onValueChange={handleThemeSwitch} />
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Push Notifications</Text>
        <Switch value={notifications} onValueChange={toggleNotifications} />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.buttonDanger}
        onPress={handleDeleteAccount}
      >
        <Text style={styles.buttonText}>Delete Account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          Linking.openURL(
            "https://dasavage21.github.io/BlazeMates-test/blazemates-privacy.html"
          )
        }
      >
        <Text style={styles.buttonText}>Privacy Policy</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        BlazeMates LLC v1.0.0 (c) 2025 BlazeMates LLC. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
  },
  backText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    color: "#00FF7F",
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
    alignItems: "center",
  },
  label: { color: "#fff", fontSize: 16 },
  button: {
    backgroundColor: "#1f1f1f",
    padding: 14,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: "center",
  },
  buttonDanger: {
    backgroundColor: "#ff5555",
    padding: 14,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  footer: {
    color: "#777",
    marginTop: 30,
    fontSize: 12,
    textAlign: "center",
  },
});
