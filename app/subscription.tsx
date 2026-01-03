import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function SubscriptionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (tier: "plus" | "pro") => {
    console.log(`[Subscription] Starting subscription flow for tier: ${tier}`);
    try {
      setLoading(tier);

      const { data: { session } } = await supabase.auth.getSession();
      console.log(`[Subscription] Session check:`, session ? "Valid session" : "No session");

      if (!session) {
        Alert.alert("Error", "You must be logged in to subscribe");
        return;
      }

      const priceIds = {
        plus: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_PLUS || "",
        pro: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_PRO || "",
      };

      console.log(`[Subscription] All env vars:`, {
        plus: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_PLUS,
        pro: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_PRO,
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      });
      console.log(`[Subscription] Price ID for ${tier}:`, priceIds[tier]);
      console.log(`[Subscription] Price ID is empty?`, !priceIds[tier]);

      if (!priceIds[tier]) {
        console.error("[Subscription] Price ID is empty - showing alert");
        Alert.alert(
          "Configuration Error",
          "Subscription pricing not configured. Please contact support."
        );
        return;
      }

      const baseUrl = Platform.OS === "web"
        ? (typeof window !== "undefined" ? window.location.origin : "")
        : process.env.EXPO_PUBLIC_SUPABASE_URL || "";

      console.log(`[Subscription] Base URL:`, baseUrl);

      const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`;
      console.log(`[Subscription] Calling edge function:`, functionUrl);

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId: priceIds[tier],
          successUrl: `${baseUrl}/profile?success=true`,
          cancelUrl: `${baseUrl}/subscription?canceled=true`,
        }),
      });

      console.log(`[Subscription] Response status:`, response.status);
      const data = await response.json();
      console.log(`[Subscription] Response data:`, data);

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to create checkout session");
      }

      if (data.url) {
        console.log(`[Subscription] Opening checkout URL`);
        await Linking.openURL(data.url);
      } else {
        console.error("[Subscription] No URL in response");
        Alert.alert("Error", "No checkout URL returned from server");
      }
    } catch (error) {
      console.error("[Subscription] Subscribe error:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to start checkout"
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Upgrade to Premium</Text>

        <View style={[styles.tierCard, styles.freeTier]}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierBadge}>1</Text>
            <Text style={styles.tierTitle}>Free (Default)</Text>
          </View>

          <Text style={styles.freePrice}>$0/month</Text>
          <Text style={styles.subtitle}>Gets users hooked first.</Text>

          <View style={styles.divider} />

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>✏️</Text>
              <Text style={styles.featureText}>Create profile</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>💚</Text>
              <Text style={styles.featureText}>Swipe & match (daily limit)</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>💬</Text>
              <Text style={styles.featureText}>Basic chat after match</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👤</Text>
              <Text style={styles.featureText}>View profiles</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎯</Text>
              <Text style={styles.featureText}>Limited filters (age + distance)</Text>
            </View>
          </View>
        </View>

        <View style={[styles.tierCard, styles.popularTier]}>
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>

          <View style={styles.tierHeader}>
            <Text style={styles.tierBadge}>🔥</Text>
            <Text style={styles.tierTitle}>Blaze+</Text>
          </View>

          <Text style={styles.price}>$4.99/month</Text>
          <Text style={styles.subtitle}>Enhanced Experience</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>More control + visibility.</Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🔁</Text>
              <Text style={styles.featureText}>Unlimited swipes</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👀</Text>
              <Text style={styles.featureText}>See who liked you</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🧊</Text>
              <Text style={styles.featureText}>Undo last swipe</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⭐</Text>
              <Text style={styles.featureText}>Profile boost (1 per week) - Coming Soon</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, loading === "plus" && styles.buttonDisabled]}
            onPress={() => handleSubscribe("plus")}
            disabled={loading !== null}
          >
            {loading === "plus" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.subscribeButtonText}>Subscribe to Blaze+</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.tierCard}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierBadge}>💨</Text>
            <Text style={styles.tierTitle}>Blaze Pro</Text>
          </View>

          <Text style={styles.price}>$12.99/month</Text>
          <Text style={styles.subtitle}>Power User Tier</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Everything in Blaze+, plus:</Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⭐</Text>
              <Text style={styles.featureText}>Daily profile boost</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⏪</Text>
              <Text style={styles.featureText}>Rewind last swipe</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🚀</Text>
              <Text style={styles.featureText}>Priority placement in swipe queue</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🟢</Text>
              <Text style={styles.featureText}>See "recently active"</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📊</Text>
              <Text style={styles.featureText}>Profile analytics</Text>
            </View>

            <View style={styles.subFeaturesList}>
              <Text style={styles.subFeatureText}>○ Views</Text>
              <Text style={styles.subFeatureText}>○ Likes per day</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎨</Text>
              <Text style={styles.featureText}>Custom profile badges (cosmetic)</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, loading === "pro" && styles.buttonDisabled]}
            onPress={() => handleSubscribe("pro")}
            disabled={loading !== null}
          >
            {loading === "pro" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.subscribeButtonText}>Subscribe to Blaze Pro</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 24,
    textAlign: "center",
  },
  tierCard: {
    backgroundColor: "#1f1f1f",
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: "#00FF7F",
    marginBottom: 24,
    position: "relative",
  },
  freeTier: {
    borderColor: "#666",
  },
  popularTier: {
    borderColor: "#FF6B35",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    right: 20,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
  },
  popularBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  tierBadge: {
    backgroundColor: "#666",
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  tierTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  price: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00FF7F",
    marginTop: 8,
  },
  freePrice: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#888",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00FF7F",
    marginBottom: 20,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: "#fff",
    flex: 1,
  },
  subFeaturesList: {
    marginLeft: 44,
    gap: 8,
  },
  subFeatureText: {
    fontSize: 14,
    color: "#aaa",
  },
  comingSoonBanner: {
    backgroundColor: "#2a2a2a",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  comingSoonText: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  comingSoonSubtext: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
  },
  subscribeButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: "#121212",
    fontSize: 18,
    fontWeight: "bold",
  },
});
