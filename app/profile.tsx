// © 2025 Benjamin Hawk. All rights reserved.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";
import { SubscriptionBadge } from "../components/SubscriptionBadge";
import { BlazeLevelBadge } from "../components/BlazeLevelBadge";

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [age, setAge] = useState<number | null>(null);
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    strain: "",
    experienceLevel: "",
    preferredStrains: [] as string[],
    consumptionMethods: [] as string[],
    cultivationInterest: false,
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [blazeLevel, setBlazeLevel] = useState<number>(1);
  const [activityPoints, setActivityPoints] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;

        if (userId) {
          const { data, error } = await supabase
            .from("users")
            .select("age, name, bio, strain, experience_level, preferred_strains, consumption_methods, cultivation_interest, image_url, subscription_tier, subscription_status, blaze_level, activity_points")
            .eq("id", userId)
            .maybeSingle();

          if (!error && data) {
            setAge(data.age || null);
            setProfile({
              name: data.name || "",
              bio: data.bio || "",
              strain: data.strain || "",
              experienceLevel: data.experience_level || "Beginner",
              preferredStrains: data.preferred_strains || [],
              consumptionMethods: data.consumption_methods || [],
              cultivationInterest: data.cultivation_interest || false,
            });
            if (data.image_url) {
              setProfileImage(data.image_url);
            }
            setSubscriptionTier(data.subscription_tier);
            setSubscriptionStatus(data.subscription_status);
            setBlazeLevel(data.blaze_level || 1);
            setActivityPoints(data.activity_points || 0);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;

          if (userId) {
            const { data, error } = await supabase
              .from("users")
              .select("blaze_level, activity_points, subscription_tier, subscription_status")
              .eq("id", userId)
              .maybeSingle();

            if (!error && data) {
              setBlazeLevel(data.blaze_level || 1);
              setActivityPoints(data.activity_points || 0);
              setSubscriptionTier(data.subscription_tier);
              setSubscriptionStatus(data.subscription_status);
            }
          }
        } catch (error) {
          console.error("Error refreshing profile data:", error);
        }
      })();
    }, [])
  );

  const isPremium = subscriptionStatus === "active" && (subscriptionTier === "plus" || subscriptionTier === "pro");

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FF7F" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

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

        <View style={styles.blazeLevelContainer}>
          <BlazeLevelBadge
            level={blazeLevel}
            activityPoints={activityPoints}
            showProgress={true}
            size="large"
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

        {subscriptionTier === "pro" && subscriptionStatus === "active" && (
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={() => router.push("/analytics")}
          >
            <Text style={styles.analyticsButtonText}>View Analytics</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.contentSection}>
        {profile.bio && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Cannabis Profile</Text>

          {profile.strain && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Favorite Strain</Text>
              <Text style={styles.infoValue}>{profile.strain}</Text>
            </View>
          )}

          {profile.experienceLevel && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Experience Level</Text>
              <Text style={styles.infoValue}>{profile.experienceLevel}</Text>
            </View>
          )}

          {profile.preferredStrains.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Preferred Types</Text>
              <Text style={styles.infoValue}>{profile.preferredStrains.join(", ")}</Text>
            </View>
          )}

          {profile.consumptionMethods.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Consumption Methods</Text>
              <Text style={styles.infoValue}>{profile.consumptionMethods.join(", ")}</Text>
            </View>
          )}

          {profile.cultivationInterest && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grower</Text>
              <Text style={styles.infoValue}>🌱 Interested in Cultivation</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/swipe")}
        >
          <Text style={styles.backButtonText}>Back to Community</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#00FF7F",
    fontSize: 16,
    marginTop: 16,
    fontWeight: "600",
  },
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
  blazeLevelContainer: {
    marginTop: 16,
    marginBottom: 8,
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
  analyticsButton: {
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#FFD700",
    marginTop: 12,
  },
  analyticsButtonText: {
    color: "#FFD700",
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
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
    boxShadow: "0 4px 12px rgba(0, 255, 127, 0.3)",
    elevation: 8,
  },
  backButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
