import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

export default function SubscriptionScreen() {
  const router = useRouter();

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

        <View style={styles.tierCard}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierBadge}>3</Text>
            <Text style={styles.tierTitle}>Blaze OG</Text>
          </View>

          <Text style={styles.price}>$19.99/month</Text>
          <Text style={styles.subtitle}>Elite Tier</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Status + exclusivity.</Text>
          <Text style={styles.sectionSubtitle}>Everything above PLUS</Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👑</Text>
              <Text style={styles.featureText}>OG Smoker badge</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>💎</Text>
              <Text style={styles.featureText}>Top placement in swipe stack</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🔒</Text>
              <Text style={styles.featureText}>Verified-only chat option</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎁</Text>
              <Text style={styles.featureText}>Monthly Super Likes (5-10)</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🆕</Text>
              <Text style={styles.featureText}>Early access to new features</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🧠</Text>
              <Text style={styles.featureText}>Profile insights</Text>
            </View>

            <View style={styles.subFeaturesList}>
              <Text style={styles.subFeatureText}>○ Swipe-through rate</Text>
              <Text style={styles.subFeatureText}>○ Match likelihood score</Text>
            </View>
          </View>

          <View style={styles.comingSoonBanner}>
            <Text style={styles.comingSoonText}>🚀 Coming Soon</Text>
            <Text style={styles.comingSoonSubtext}>
              Premium subscriptions will be available in the next update!
            </Text>
          </View>
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
});
