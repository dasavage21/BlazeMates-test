import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";

export default function AboutScreen() {
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

        <View style={styles.header}>
          <Text style={styles.logo}>🔥</Text>
          <Text style={styles.title}>About BlazeMates</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.paragraph}>
            BlazeMates is dedicated to helping people form meaningful connections in a safe,
            respectful, and enjoyable environment. We believe that everyone deserves the
            opportunity to meet compatible people who share their interests and values.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Offer</Text>
          <Text style={styles.paragraph}>
            Our platform provides a modern, intuitive way to discover potential matches in
            your area. With features like location-based matching, instant messaging, and
            advanced filtering options, we make it easy to find people who truly align with
            what you're looking for.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety First</Text>
          <Text style={styles.paragraph}>
            Your safety and privacy are our top priorities. We implement industry-leading
            security measures, including:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Age verification (21+ only)</Text>
            <Text style={styles.bullet}>• Profile verification options</Text>
            <Text style={styles.bullet}>• Report and block features</Text>
            <Text style={styles.bullet}>• Secure data encryption</Text>
            <Text style={styles.bullet}>• 24/7 moderation and support</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Create Your Profile</Text>
              <Text style={styles.stepDescription}>
                Add photos and information about yourself to showcase your personality
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Discover Matches</Text>
              <Text style={styles.stepDescription}>
                Browse profiles and swipe right on people you're interested in
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Start Chatting</Text>
              <Text style={styles.stepDescription}>
                When you both like each other, start a conversation and get to know them
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Features</Text>
          <Text style={styles.paragraph}>
            Upgrade to BlazeMates+ or BlazeMates Pro to unlock advanced features like
            unlimited swipes, see who liked you, undo swipes, profile boosts, and more.
            Premium members get the best experience with priority placement and exclusive features.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Guidelines</Text>
          <Text style={styles.paragraph}>
            We're committed to maintaining a positive and respectful community. All users
            must adhere to our community guidelines, which prohibit harassment, hate speech,
            spam, and inappropriate content. Violations may result in account suspension or
            permanent ban.
          </Text>
        </View>

        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to Join?</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push("/create-account")}
          >
            <Text style={styles.ctaButtonText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginButtonText}>Already have an account? Log In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push("/welcome")}>
            <Text style={styles.footerLink}>Home</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>•</Text>
          <TouchableOpacity onPress={() => Platform.OS === 'web' && window.open('/blazemates-privacy.html', '_blank')}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>•</Text>
          <TouchableOpacity onPress={() => Platform.OS === 'web' && window.open('/child-safety.html', '_blank')}>
            <Text style={styles.footerLink}>Safety</Text>
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
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    fontSize: 60,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00FF7F",
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    color: "#ccc",
    lineHeight: 24,
  },
  bulletList: {
    marginTop: 12,
    gap: 8,
  },
  bullet: {
    fontSize: 16,
    color: "#ccc",
    lineHeight: 24,
  },
  stepContainer: {
    gap: 24,
    marginTop: 16,
  },
  step: {
    backgroundColor: "#1f1f1f",
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#00FF7F",
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00FF7F",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#121212",
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: "#aaa",
    lineHeight: 20,
  },
  ctaSection: {
    alignItems: "center",
    paddingVertical: 40,
    borderTopWidth: 1,
    borderTopColor: "#333",
    marginTop: 20,
  },
  ctaTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 16,
  },
  ctaButtonText: {
    color: "#121212",
    fontSize: 18,
    fontWeight: "bold",
  },
  loginButton: {
    paddingVertical: 12,
  },
  loginButtonText: {
    color: "#00FF7F",
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 12,
  },
  footerLink: {
    color: "#888",
    fontSize: 14,
  },
  footerDivider: {
    color: "#444",
    fontSize: 14,
  },
});
