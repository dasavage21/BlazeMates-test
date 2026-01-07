// © 2025 Benjamin Hawk. All rights reserved.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";
import { SubscriptionBadge } from "../components/SubscriptionBadge";

export default function ProfileScreen() {
  const router = useRouter();
  const [age, setAge] = useState<number | null>(null);
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    strain: "",
    style: "",
    lookingFor: "",
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      let localAge: number | null = null;

      const stored = await AsyncStorage.getItem("userProfile");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProfile(parsed);
        if (parsed?.age !== null && parsed?.age !== undefined) {
          const parsedAge = Number(parsed.age);
          if (!Number.isNaN(parsedAge)) {
            localAge = parsedAge;
            setAge(parsedAge);
          }
        }
      }

      const storedAge = await AsyncStorage.getItem("userAge");
      if (storedAge) {
        const parsedAge = parseInt(storedAge);
        if (!Number.isNaN(parsedAge)) {
          localAge = parsedAge;
          setAge(parsedAge);
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const { data, error } = await supabase
          .from("users")
          .select("age, name, bio, strain, style, looking_for, image_url, subscription_tier, subscription_status")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) {
          if (data.age !== null && data.age !== undefined) {
            setAge(data.age);
          } else if (localAge !== null) {
            await supabase
              .from("users")
              .update({ age: localAge })
              .eq("id", userId);
            setAge(localAge);
          }

          setProfile({
            name: data.name || "",
            bio: data.bio || "",
            strain: data.strain || "",
            style: data.style || "",
            lookingFor: data.looking_for || "",
          });
          if (data.image_url) {
            setProfileImage(data.image_url);
          }
          setSubscriptionTier(data.subscription_tier);
          setSubscriptionStatus(data.subscription_status);
        }
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const stored = await AsyncStorage.getItem("userProfile");
        if (stored) {
          const data = JSON.parse(stored);
          setProfileImage(data.profileImage ?? null);
        }
      })();
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: profileImage || "https://via.placeholder.com/250" }}
            style={styles.avatar}
          />
          {age !== null && age >= 21 && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </View>
          )}
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.name}>{profile.name || "BlazeMate"}</Text>
          {age !== null && age >= 21 && (
            <Text style={styles.verifiedLabel}>Verified</Text>
          )}
          <SubscriptionBadge
            tier={subscriptionTier}
            status={subscriptionStatus}
            size="medium"
          />
        </View>

        <Text style={styles.ageText}>
          {age !== null ? `${age} years old` : "Age not set"}
        </Text>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push("/profile-edit")}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentSection}>
        {profile.bio && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Details</Text>

          {profile.strain && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Favorite Strain</Text>
              <Text style={styles.infoValue}>{profile.strain}</Text>
            </View>
          )}

          {profile.style && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Blaze Style</Text>
              <Text style={styles.infoValue}>{profile.style}</Text>
            </View>
          )}

          {profile.lookingFor && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Looking For</Text>
              <Text style={styles.infoValue}>
                {profile.lookingFor === "smoke"
                  ? "🌿 Just Wanna Smoke"
                  : profile.lookingFor === "hookup"
                  ? "🍑 Just Looking to Hook Up"
                  : profile.lookingFor === "both"
                  ? "🌿+🍑 Both"
                  : "Not set"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/swipe")}
        >
          <Text style={styles.backButtonText}>Back to Swiping</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0f0f0f",
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 20,
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: "#00FF7F",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00FF7F",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#121212",
  },
  verifiedText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#121212",
  },
  nameSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  name: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  verifiedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00FF7F",
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0, 255, 127, 0.1)",
    borderRadius: 6,
  },
  ageText: {
    fontSize: 18,
    color: "#888",
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  editButton: {
    backgroundColor: "#1f1f1f",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#00FF7F",
  },
  editButtonText: {
    color: "#00FF7F",
    fontWeight: "600",
    fontSize: 15,
  },
  contentSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  infoCard: {
    backgroundColor: "#121212",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#222",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  bioText: {
    fontSize: 16,
    color: "#ccc",
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  infoLabel: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
    flex: 1,
    letterSpacing: 0.2,
  },
  infoValue: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  backButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#00FF7F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  backButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
