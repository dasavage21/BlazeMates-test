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
import { useState, useEffect, useCallback, useRef } from "react";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../supabaseClient";

type SubscriptionInfo = {
  tier: string | null;
  status: string | null;
  expiresAt: string | null;
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [pollingPayment, setPollingPayment] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionInfo>({
    tier: null,
    status: null,
    expiresAt: null,
  });
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const loadCurrentSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMountedRef.current) {
        setCheckingSubscription(false);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("subscription_tier, subscription_status, subscription_expires_at")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!error && data && isMountedRef.current) {
        setCurrentSubscription({
          tier: data.subscription_tier,
          status: data.subscription_status,
          expiresAt: data.subscription_expires_at,
        });
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
    } finally {
      if (isMountedRef.current) {
        setCheckingSubscription(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadCurrentSubscription();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const success = params.get('success');
      const canceled = params.get('canceled');

      if (success === 'true') {
        setPollingPayment(true);
        let pollAttempts = 0;
        const maxPolls = 10;

        const pollSubscription = async () => {
          if (!isMountedRef.current) return;

          pollAttempts++;
          const { data: { session } } = await supabase.auth.getSession();

          if (session && isMountedRef.current) {
            const { data: updatedUser } = await supabase
              .from("users")
              .select("subscription_status, subscription_tier")
              .eq("id", session.user.id)
              .maybeSingle();

            if (updatedUser?.subscription_status === 'active') {
              if (isMountedRef.current) {
                setPollingPayment(false);
                await loadCurrentSubscription();
                Alert.alert("Success!", "Your subscription is now active. Enjoy your premium features!");
                window.history.replaceState({}, '', '/subscription');
              }
              return;
            }
          }

          if (pollAttempts < maxPolls && isMountedRef.current) {
            pollingTimeoutRef.current = setTimeout(pollSubscription, 2000);
          } else if (isMountedRef.current) {
            setPollingPayment(false);
            await loadCurrentSubscription();
            Alert.alert("Payment Processing", "Your payment is being processed. It may take a few minutes to activate. Please check back shortly.");
            window.history.replaceState({}, '', '/subscription');
          }
        };

        pollingTimeoutRef.current = setTimeout(pollSubscription, 1000);
      } else if (canceled === 'true') {
        Alert.alert("Canceled", "Subscription checkout was canceled.");
        window.history.replaceState({}, '', '/subscription');
      }
    }

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        try {
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && isMountedRef.current) {
            await loadCurrentSubscription();
          }
        } catch (err) {
          console.warn("Failed to load subscription on auth change", err);
        }
      })();
    });

    return () => {
      isMountedRef.current = false;
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      subscription.data.subscription.unsubscribe();
    };
  }, [loadCurrentSubscription]);

  const proceedWithSubscription = useCallback(async (tier: "plus" | "pro") => {
    try {
      setLoading(tier);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert("Error", "You must be logged in to subscribe");
        return;
      }

      const priceIds = {
        plus: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_PLUS || "",
        pro: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_PRO || "",
      };

      if (!priceIds[tier]) {
        Alert.alert(
          "Configuration Error",
          "Subscription pricing not configured. Please contact support."
        );
        return;
      }

      const baseUrl = Platform.OS === "web"
        ? (typeof window !== "undefined" ? window.location.origin : "")
        : `https://${process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '')}` || "";

      const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`;
      const successUrl = Platform.OS === 'web'
        ? `${baseUrl}/subscription?success=true`
        : `${baseUrl}/subscription?success=true&mobile=true`;

      const cancelUrl = Platform.OS === 'web'
        ? `${baseUrl}/subscription?canceled=true`
        : `${baseUrl}/subscription?canceled=true&mobile=true`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId: priceIds[tier],
          successUrl,
          cancelUrl,
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
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') {
            window.location.href = data.url;
          }
        } else {
          // On mobile, use WebBrowser for in-app browser
          const result = await WebBrowser.openBrowserAsync(data.url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            toolbarColor: '#121212',
            controlsColor: '#00FF7F',
          });

          if (result.type === 'dismiss' && isMountedRef.current) {
            setPollingPayment(true);
            let pollAttempts = 0;
            const maxPolls = 10;

            const pollSubscription = async () => {
              if (!isMountedRef.current) return;

              pollAttempts++;
              const { data: { session: checkSession } } = await supabase.auth.getSession();

              if (checkSession && isMountedRef.current) {
                const { data: updatedUser } = await supabase
                  .from("users")
                  .select("subscription_status, subscription_tier")
                  .eq("id", checkSession.user.id)
                  .maybeSingle();

                if (updatedUser?.subscription_status === 'active') {
                  if (isMountedRef.current) {
                    setPollingPayment(false);
                    await loadCurrentSubscription();
                    Alert.alert(
                      "Success!",
                      "Your subscription is now active. Enjoy your premium features!"
                    );
                  }
                  return;
                }
              }

              if (pollAttempts < maxPolls && isMountedRef.current) {
                pollingTimeoutRef.current = setTimeout(pollSubscription, 2000);
              } else if (isMountedRef.current) {
                setPollingPayment(false);
                await loadCurrentSubscription();
                Alert.alert(
                  "Payment Processing",
                  "Your payment is being processed. It may take a few minutes to activate. Please check back shortly."
                );
              }
            };

            pollingTimeoutRef.current = setTimeout(pollSubscription, 2000);
          } else if (isMountedRef.current) {
            await loadCurrentSubscription();
          }
        }
      } else {
        Alert.alert("Error", "No checkout URL returned from server");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to start checkout"
      );
    } finally {
      setLoading(null);
    }
  }, [loadCurrentSubscription]);

  const handleSubscribe = useCallback(async (tier: "plus" | "pro") => {
    console.log("[Subscription] handleSubscribe called with tier:", tier);
    console.log("[Subscription] Current subscription:", currentSubscription);

    if (currentSubscription.status === "active") {
      const currentTier = currentSubscription.tier;

      if ((tier === "plus" && currentTier === "plus") ||
          (tier === "pro" && currentTier === "pro")) {
        const tierName = tier === "plus" ? "Blaze+" : "Blaze Pro";
        Alert.alert(
          "Already Subscribed",
          `You already have an active ${tierName} subscription.`
        );
        return;
      }

      if (tier === "pro" && (currentTier === "plus" || currentTier === "blaze_plus")) {
        console.log("[Subscription] Showing upgrade confirmation dialog");
        if (Platform.OS === 'web') {
          const confirmed = confirm("You'll be upgraded to Blaze Pro. Your Blaze+ subscription will be canceled and you'll be charged the Pro rate. Continue?");
          if (confirmed) {
            await proceedWithSubscription(tier);
          }
        } else {
          Alert.alert(
            "Upgrade to Blaze Pro",
            "You'll be upgraded to Blaze Pro. Your Blaze+ subscription will be canceled and you'll be charged the Pro rate.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Upgrade", onPress: () => proceedWithSubscription(tier) }
            ]
          );
        }
        return;
      }

      if (tier === "plus" && currentTier === "pro") {
        Alert.alert(
          "Cannot Downgrade",
          "Please cancel your Blaze Pro subscription first before subscribing to Blaze+."
        );
        return;
      }
    }

    console.log("[Subscription] Proceeding with subscription");
    await proceedWithSubscription(tier);
  }, [currentSubscription, proceedWithSubscription]);

  const isCurrentlySubscribed = useCallback((tier: "plus" | "pro") => {
    if (currentSubscription.status !== "active") return false;

    if (tier === "plus") {
      return currentSubscription.tier === "plus";
    } else {
      return currentSubscription.tier === "pro";
    }
  }, [currentSubscription]);

  if (checkingSubscription) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00FF7F" />
        <Text style={styles.loadingText}>Loading subscription info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/profile');
            }
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.comingSoonBanner}>
          <Text style={styles.comingSoonTitle}>🚀 Coming Soon</Text>
          <Text style={styles.comingSoonText}>
            Premium subscriptions are currently in development. Check back soon for exclusive features and benefits!
          </Text>
        </View>

        {pollingPayment && (
          <View style={styles.pollingBanner}>
            <ActivityIndicator size="small" color="#00FF7F" />
            <Text style={styles.pollingText}>Verifying your payment...</Text>
          </View>
        )}

        <Text style={styles.title}>Support the Community</Text>

        {currentSubscription.status === "active" && currentSubscription.tier && currentSubscription.tier !== "free" && (
          <View style={styles.currentSubBanner}>
            <Text style={styles.currentSubTitle}>Current Subscription</Text>
            <Text style={styles.currentSubTier}>
              {currentSubscription.tier === "plus" || currentSubscription.tier === "blaze_plus" ? "✨ Blaze+" : "👑 Blaze Pro"}
            </Text>
            {currentSubscription.expiresAt && (
              <Text style={styles.currentSubExpires}>
                Renews on {new Date(currentSubscription.expiresAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        <View style={[styles.tierCard, styles.freeTier]}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierBadge}>1</Text>
            <Text style={styles.tierTitle}>Free (Default)</Text>
          </View>

          <Text style={styles.freePrice}>$0/month</Text>
          <Text style={styles.subtitle}>Join the community for free.</Text>

          <View style={styles.divider} />

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>✏️</Text>
              <Text style={styles.featureText}>Create cannabis profile</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👥</Text>
              <Text style={styles.featureText}>Join public groups</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>💬</Text>
              <Text style={styles.featureText}>Send direct messages</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🌿</Text>
              <Text style={styles.featureText}>Browse community members</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📍</Text>
              <Text style={styles.featureText}>Basic filters (age + location)</Text>
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
          <Text style={styles.subtitle}>Enhanced Community Features</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Level up your community experience.</Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎪</Text>
              <Text style={styles.featureText}>Create private groups</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📅</Text>
              <Text style={styles.featureText}>Priority event registration</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🌱</Text>
              <Text style={styles.featureText}>Advanced strain database</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎓</Text>
              <Text style={styles.featureText}>Access to educational content</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🏷️</Text>
              <Text style={styles.featureText}>Custom profile badge</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.subscribeButton,
              (loading === "plus" || isCurrentlySubscribed("plus")) && styles.buttonDisabled,
              isCurrentlySubscribed("plus") && styles.currentPlanButton,
            ]}
            disabled={loading === "plus" || isCurrentlySubscribed("plus")}
            onPress={() => handleSubscribe("plus")}
          >
            {loading === "plus" ? (
              <ActivityIndicator color="#121212" />
            ) : isCurrentlySubscribed("plus") ? (
              <Text style={styles.subscribeButtonText}>✓ Current Plan</Text>
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
          <Text style={styles.subtitle}>Community Leader</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Everything in Blaze+, plus:</Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎉</Text>
              <Text style={styles.featureText}>Host unlimited events</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👑</Text>
              <Text style={styles.featureText}>Premium profile badge</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📚</Text>
              <Text style={styles.featureText}>Exclusive cultivation guides</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🌟</Text>
              <Text style={styles.featureText}>Featured in community directory</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📊</Text>
              <Text style={styles.featureText}>Community analytics</Text>
            </View>

            <View style={styles.subFeaturesList}>
              <Text style={styles.subFeatureText}>○ Profile views</Text>
              <Text style={styles.subFeatureText}>○ Engagement metrics</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>💎</Text>
              <Text style={styles.featureText}>Early access to new features</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.subscribeButton,
              (loading === "pro" || isCurrentlySubscribed("pro")) && styles.buttonDisabled,
              isCurrentlySubscribed("pro") && styles.currentPlanButton,
            ]}
            disabled={loading === "pro" || isCurrentlySubscribed("pro")}
            onPress={() => handleSubscribe("pro")}
          >
            {loading === "pro" ? (
              <ActivityIndicator color="#121212" />
            ) : isCurrentlySubscribed("pro") ? (
              <Text style={styles.subscribeButtonText}>✓ Current Plan</Text>
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#888",
    fontSize: 16,
    marginTop: 16,
  },
  pollingBanner: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#00FF7F",
  },
  pollingText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  comingSoonBanner: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#FFA500",
    alignItems: "center",
  },
  comingSoonTitle: {
    color: "#FFA500",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  comingSoonText: {
    color: "#CCCCCC",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  currentSubBanner: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#00FF7F",
    alignItems: "center",
  },
  currentSubTitle: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  currentSubTier: {
    color: "#00FF7F",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  currentSubExpires: {
    color: "#aaa",
    fontSize: 13,
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
  currentPlanButton: {
    backgroundColor: "#666",
    opacity: 1,
  },
  subscribeButtonText: {
    color: "#121212",
    fontSize: 18,
    fontWeight: "bold",
  },
});
