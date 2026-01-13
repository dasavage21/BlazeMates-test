import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Heart, Users, MessageCircle, Shield, Zap, MapPin } from "lucide-react-native";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🔥</Text>
          </View>
          <Text style={styles.title}>BlazeMates</Text>
          <Text style={styles.tagline}>Find Your Smoke Buddies</Text>
          <Text style={styles.description}>
            Connect with the cannabis community in your area. Find people to smoke with, share strains, and discuss cultivation.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push("/create-account")}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push("/login")}
            >
              <Text style={styles.secondaryButtonText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Why BlazeMates?</Text>

          <View style={styles.featureGrid}>
            <View style={styles.featureCard}>
              <Heart color="#00FF7F" size={32} strokeWidth={2} />
              <Text style={styles.featureTitle}>Smart Matching</Text>
              <Text style={styles.featureDescription}>
                Find compatible smoke buddies based on strains, consumption methods, and experience level
              </Text>
            </View>

            <View style={styles.featureCard}>
              <MapPin color="#00FF7F" size={32} strokeWidth={2} />
              <Text style={styles.featureTitle}>Location Based</Text>
              <Text style={styles.featureDescription}>
                Connect with cannabis enthusiasts nearby for sessions and events
              </Text>
            </View>

            <View style={styles.featureCard}>
              <MessageCircle color="#00FF7F" size={32} strokeWidth={2} />
              <Text style={styles.featureTitle}>Community Chat</Text>
              <Text style={styles.featureDescription}>
                Share strain recommendations, cultivation tips, and organize smoke sessions
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Shield color="#00FF7F" size={32} strokeWidth={2} />
              <Text style={styles.featureTitle}>Safe & Secure</Text>
              <Text style={styles.featureDescription}>
                Your privacy and safety are our top priorities
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Users color="#00FF7F" size={32} strokeWidth={2} />
              <Text style={styles.featureTitle}>Growing Community</Text>
              <Text style={styles.featureDescription}>
                Join a thriving cannabis community of enthusiasts, growers, and advocates
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Zap color="#00FF7F" size={32} strokeWidth={2} />
              <Text style={styles.featureTitle}>Premium Features</Text>
              <Text style={styles.featureDescription}>
                Unlock unlimited connections, profile boost, and advanced filters
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to Connect?</Text>
          <Text style={styles.ctaDescription}>
            Create your profile and start connecting with the cannabis community today
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push("/create-account")}
          >
            <Text style={styles.ctaButtonText}>Join the Community</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push("/about")}>
            <Text style={styles.footerLink}>About Us</Text>
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
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    fontSize: 50,
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 20,
    color: "#00FF7F",
    fontWeight: "600",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 500,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
    maxWidth: 400,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#00FF7F",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "transparent",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#00FF7F",
  },
  secondaryButtonText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "bold",
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    backgroundColor: "#0a0a0a",
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 32,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "center",
  },
  featureCard: {
    backgroundColor: "#1f1f1f",
    padding: 24,
    borderRadius: 16,
    width: Platform.OS === 'web' ? 300 : "100%",
    alignItems: "center",
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  ctaDescription: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 24,
    textAlign: "center",
    maxWidth: 500,
  },
  ctaButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: "#121212",
    fontSize: 18,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
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
