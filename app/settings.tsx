// Ac 2025 Benjamin Hawk. All rights reserved.

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  clearLocalAuthSession,
  handleRefreshTokenError,
} from "../lib/authSession";
import { supabase, SUPABASE_PROJECT_REF } from "../supabaseClient";

// in settings.tsx

export default function SettingsScreen() {
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setIsAdmin(false);
          return;
        }

        // Check if user is super admin via raw_user_meta_data
        const isSuperAdmin = user.user_metadata?.is_super_admin === true;
        setIsAdmin(isSuperAdmin);
      } catch (error) {
        console.error("Failed to check admin status:", error);
      }
    };

    checkAdminStatus();
  }, []);

  const handleSignOut = async () => {
    await clearLocalAuthSession();
    router.replace("/login");
  };

  const handleDeleteAccount = () => {
    console.log("Delete Account button clicked");

    const executeDelete = async () => {
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

        const functionUrl = `https://${SUPABASE_PROJECT_REF}.functions.supabase.co/delete-user`;
        console.log("Calling delete function:", functionUrl);

        const resp = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ userId: user.id }),
        });

        console.log("Response status:", resp.status);

        if (!resp.ok) {
          const result = (await resp.json().catch(() => ({}))) as {
            error?: string;
          };
          console.error("Delete error:", result);
          Alert.alert(
            "Error",
            result?.error ?? "Failed to delete user account."
          );
          return;
        }

        const result = await resp.json();
        console.log("Delete success:", result);

        await supabase.auth.signOut();
        await clearLocalAuthSession();

        if (Platform.OS === "web") {
          router.replace("/login");
        } else {
          Alert.alert("Account Deleted", "Your account was successfully removed.", [
            {
              text: "OK",
              onPress: () => router.replace("/login"),
            },
          ]);
        }
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
    };

    if (Platform.OS === "web") {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete your BlazeMates account? This cannot be undone."
      );
      if (confirmDelete) {
        void executeDelete();
      }
    } else {
      Alert.alert(
        "Delete Account",
        "Are you sure you want to delete your BlazeMates account? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => void executeDelete() },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push("/swipe")} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Settings</Text>
      </View>

      {isAdmin && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/admin-reports")}
        >
          <Text style={styles.buttonText}>View Reports</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/subscription")}
      >
        <Text style={styles.buttonText}>Upgrade to Premium</Text>
      </TouchableOpacity>

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
