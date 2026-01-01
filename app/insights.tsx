import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../supabaseClient";

type Analytics = {
  swipe_through_rate: number;
  match_likelihood_score: number;
  total_swipes: number;
  total_likes_sent: number;
  total_likes_received: number;
};

export default function InsightsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("subscription_tier")
        .eq("id", user.id)
        .maybeSingle();

      if (userData?.subscription_tier !== "blaze_og") {
        setIsPremium(false);
        setLoading(false);
        return;
      }

      setIsPremium(true);

      await supabase.rpc("update_user_analytics", { p_user_id: user.id });

      const { data: analyticsData, error } = await supabase
        .from("subscription_analytics")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error("Error loading insights:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00FF7F" />
      </View>
    );
  }

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.premiumRequired}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.premiumTitle}>Premium Feature</Text>
            <Text style={styles.premiumText}>
              Profile insights are only available for Blaze OG members.
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push("/subscription")}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Blaze OG</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Profile Insights</Text>
        <Text style={styles.subtitle}>Your performance analytics</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statValue}>
              {analytics?.swipe_through_rate?.toFixed(1) || "0"}%
            </Text>
            <Text style={styles.statLabel}>Swipe-through Rate</Text>
            <Text style={styles.statDescription}>
              How often you swipe right on profiles
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💘</Text>
            <Text style={styles.statValue}>
              {analytics?.match_likelihood_score?.toFixed(1) || "0"}%
            </Text>
            <Text style={styles.statLabel}>Match Likelihood</Text>
            <Text style={styles.statDescription}>
              Your chance of getting matched
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👍</Text>
            <Text style={styles.statValue}>
              {analytics?.total_likes_sent || 0}
            </Text>
            <Text style={styles.statLabel}>Likes Sent</Text>
            <Text style={styles.statDescription}>
              Total profiles you've liked
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💚</Text>
            <Text style={styles.statValue}>
              {analytics?.total_likes_received || 0}
            </Text>
            <Text style={styles.statLabel}>Likes Received</Text>
            <Text style={styles.statDescription}>
              People who liked you back
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👆</Text>
            <Text style={styles.statValue}>
              {analytics?.total_swipes || 0}
            </Text>
            <Text style={styles.statLabel}>Total Swipes</Text>
            <Text style={styles.statDescription}>
              All profiles you've reviewed
            </Text>
          </View>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipTitle}>Pro Tip</Text>
          <Text style={styles.tipText}>
            A match likelihood score above 50% means you're very attractive to
            other users. Keep your profile updated with great photos!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 24,
  },
  statsGrid: {
    gap: 16,
  },
  statCard: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#00FF7F",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  statDescription: {
    fontSize: 14,
    color: "#888",
  },
  tipBox: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#00FF7F",
  },
  tipIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00FF7F",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
  },
  premiumRequired: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  lockIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  premiumText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  upgradeButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  upgradeButtonText: {
    color: "#121212",
    fontSize: 18,
    fontWeight: "bold",
  },
});
