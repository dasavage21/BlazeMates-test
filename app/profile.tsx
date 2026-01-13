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
  const [boostActiveUntil, setBoostActiveUntil] = useState<string | null>(null);
  const [lastBoostUsedAt, setLastBoostUsedAt] = useState<string | null>(null);
  const [activatingBoost, setActivatingBoost] = useState(false);

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
          .select("age, name, bio, strain, style, looking_for, image_url, subscription_tier, subscription_status, boost_active_until, last_boost_used_at")
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
          setBoostActiveUntil(data.boost_active_until);
          setLastBoostUsedAt(data.last_boost_used_at);
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

  const isPremium = subscriptionStatus === "active" && (subscriptionTier === "plus" || subscriptionTier === "pro" || subscriptionTier === "blaze_plus" || subscriptionTier === "blaze_og" || subscriptionTier === "blaze_pro");
  const isBoostActive = boostActiveUntil ? new Date(boostActiveUntil) > new Date() : false;

  const canBoost = () => {
    if (!isPremium) return { can: false, reason: "Premium required" };
    if (isBoostActive) return { can: false, reason: "Boost already active" };

    if (lastBoostUsedAt) {
      const lastBoost = new Date(lastBoostUsedAt);
      const now = new Date();
      const hoursSinceLastBoost = (now.getTime() - lastBoost.getTime()) / (1000 * 60 * 60);

      const isPro = subscriptionTier === "pro" || subscriptionTier === "blaze_og" || subscriptionTier === "blaze_pro";
      const cooldownHours = isPro ? 24 : 168;

      if (hoursSinceLastBoost < cooldownHours) {
        const hoursRemaining = Math.ceil(cooldownHours - hoursSinceLastBoost);
        const daysRemaining = Math.floor(hoursRemaining / 24);
        const hoursRemainingInDay = hoursRemaining % 24;
        const timeRemaining = daysRemaining > 0
          ? `${daysRemaining}d ${hoursRemainingInDay}h`
          : `${hoursRemainingInDay}h`;
        return { can: false, reason: `Available in ${timeRemaining}` };
      }
    }

    return { can: true, reason: "" };
  };

  const handleActivateBoost = async () => {
    const boostCheck = canBoost();
    if (!boostCheck.can) {
      alert(boostCheck.reason);
      return;
    }

    setActivatingBoost(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        alert("You must be logged in to activate boost");
        return;
      }

      const now = new Date();
      const boostExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from("users")
        .update({
          boost_active_until: boostExpiresAt.toISOString(),
          last_boost_used_at: now.toISOString(),
        })
        .eq("id", userId);

      if (error) {
        console.error("Error activating boost:", error);
        alert("Failed to activate boost. Please try again.");
      } else {
        setBoostActiveUntil(boostExpiresAt.toISOString());
        setLastBoostUsedAt(now.toISOString());
        alert("Boost activated! Your profile will appear first in the swipe feed for 24 hours.");
      }
    } catch (error) {
      console.error("Boost activation exception:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setActivatingBoost(false);
    }
  };

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

        {(subscriptionTier === "pro" || subscriptionTier === "blaze_og" || subscriptionTier === "blaze_pro") && subscriptionStatus === "active" && (
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={() => router.push("/analytics")}
          >
            <Text style={styles.analyticsButtonText}>View Profile Analytics</Text>
          </TouchableOpacity>
        )}

        {isPremium && (
          <View style={styles.boostSection}>
            {isBoostActive ? (
              <View style={styles.boostActiveCard}>
                <Text style={styles.boostActiveTitle}>⚡ Boost Active</Text>
                <Text style={styles.boostActiveText}>
                  Your profile is boosted until{" "}
                  {new Date(boostActiveUntil!).toLocaleString()}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.boostButton,
                  !canBoost().can && styles.boostButtonDisabled,
                ]}
                onPress={handleActivateBoost}
                disabled={!canBoost().can || activatingBoost}
              >
                <Text style={styles.boostButtonIcon}>⚡</Text>
                <View style={styles.boostButtonTextContainer}>
                  <Text style={styles.boostButtonTitle}>
                    {activatingBoost ? "Activating..." : "Activate Profile Boost"}
                  </Text>
                  <Text style={styles.boostButtonSubtitle}>
                    {canBoost().can
                      ? subscriptionTier === "pro" || subscriptionTier === "blaze_og" || subscriptionTier === "blaze_pro"
                        ? "Available daily • Lasts 24 hours"
                        : "Available weekly • Lasts 24 hours"
                      : canBoost().reason}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
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
  boostSection: {
    marginTop: 16,
    width: "100%",
  },
  boostButton: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderWidth: 2,
    borderColor: "#FFD700",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  boostButtonDisabled: {
    opacity: 0.5,
    borderColor: "#666",
  },
  boostButtonIcon: {
    fontSize: 32,
  },
  boostButtonTextContainer: {
    flex: 1,
  },
  boostButtonTitle: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  boostButtonSubtitle: {
    color: "#aaa",
    fontSize: 13,
  },
  boostActiveCard: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderWidth: 2,
    borderColor: "#FFD700",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  boostActiveTitle: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  boostActiveText: {
    color: "#fff",
    fontSize: 14,
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
