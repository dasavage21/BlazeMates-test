// © 2025 Benjamin Hawk. All rights reserved.
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../supabaseClient";
import { updateUserActivity } from "../lib/activityTracker";
import { SubscriptionBadge } from "../components/SubscriptionBadge";
import { BlazeLevelBadge } from "../components/BlazeLevelBadge";

type Match = {
  id: string;
  name: string;
  age: number;
  bio: string;
  image_url: string | null;
  last_active_at: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  blaze_level: number;
};

type TabType = "matches" | "likes" | "wholiked";

export default function MatchesScreen() {
  const router = useRouter();
  const [mutualMatches, setMutualMatches] = useState<Match[]>([]);
  const [pendingLikes, setPendingLikes] = useState<Match[]>([]);
  const [whoLikedYou, setWhoLikedYou] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("matches");
  const [isPremium, setIsPremium] = useState(false);

  const isUserActive = useCallback((lastActiveAt: string | null): boolean => {
    if (!lastActiveAt) return false;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const lastActive = new Date(lastActiveAt);
    return lastActive > tenMinutesAgo;
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (!myUserId) {
        setLoading(false);
        return;
      }

      setCurrentUserId(myUserId);

      const { data: userData } = await supabase
        .from("users")
        .select("subscription_tier, subscription_status")
        .eq("id", myUserId)
        .maybeSingle();

      const userIsPremium =
        (userData?.subscription_tier === "plus" || userData?.subscription_tier === "pro") &&
        userData?.subscription_status === "active";
      setIsPremium(userIsPremium);

      const { data: myLikes, error: likesError } = await supabase
        .from("likes")
        .select("liked_user_id")
        .eq("user_id", myUserId);

      if (likesError) {
        console.error("Failed to fetch likes:", likesError);
        setLoading(false);
        return;
      }

      const likedUserIds = (myLikes || []).map((like) => like.liked_user_id);

      const { data: likesReceived, error: likesReceivedError } = await supabase
        .from("likes")
        .select("user_id")
        .eq("liked_user_id", myUserId);

      if (likesReceivedError) {
        console.error("Failed to fetch likes received:", likesReceivedError);
      }

      const receivedLikeUserIds = (likesReceived || []).map((like) => like.user_id);
      const whoLikedMeIds = receivedLikeUserIds.filter(
        (id) => !likedUserIds.includes(id)
      );

      if (likedUserIds.length === 0 && whoLikedMeIds.length === 0) {
        setMutualMatches([]);
        setPendingLikes([]);
        setWhoLikedYou([]);
        setLoading(false);
        return;
      }

      const { data: theirLikes, error: theirLikesError } = await supabase
        .from("likes")
        .select("user_id, liked_user_id")
        .in("user_id", likedUserIds)
        .eq("liked_user_id", myUserId);

      if (theirLikesError) {
        console.error("Failed to fetch their likes:", theirLikesError);
        setLoading(false);
        return;
      }

      const mutualUserIds = (theirLikes || []).map((like) => like.user_id);
      const pendingUserIds = likedUserIds.filter(
        (id) => !mutualUserIds.includes(id)
      );

      const allUserIds = [...new Set([...likedUserIds, ...whoLikedMeIds])];

      if (allUserIds.length === 0) {
        setMutualMatches([]);
        setPendingLikes([]);
        setWhoLikedYou([]);
        setLoading(false);
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, age, bio, image_url, last_active_at, subscription_tier, subscription_status, blaze_level")
        .in("id", allUserIds);

      if (usersError) {
        console.error("Failed to fetch users:", usersError);
        setLoading(false);
        return;
      }

      const allUsers = usersData || [];
      const mutual = allUsers.filter((user) => mutualUserIds.includes(user.id));
      const pending = allUsers.filter((user) => pendingUserIds.includes(user.id));
      const whoLiked = allUsers.filter((user) => whoLikedMeIds.includes(user.id));

      setMutualMatches(mutual);
      setPendingLikes(pending);
      setWhoLikedYou(whoLiked);
      setLoading(false);
    } catch (error) {
      console.error("Error loading matches:", error);
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
      updateUserActivity();
    }, [loadMatches])
  );

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('likes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
        },
        () => {
          loadMatches();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'likes',
        },
        () => {
          loadMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadMatches]);

  const createThreadId = useCallback((userId1: string, userId2: string) => {
    const sorted = [userId1, userId2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }, []);

  const handleMatchPress = useCallback(
    async (matchId: string) => {
      if (!currentUserId) return;

      if (activeTab === "matches") {
        const threadId = createThreadId(currentUserId, matchId);

        try {
          await supabase.from("threads").upsert({ id: threadId }, { onConflict: "id" });
        } catch (e: any) {
          console.warn("Failed to create chat thread", e);
        }

        router.push({ pathname: "/chat", params: { threadId } });
      } else if (activeTab === "wholiked" && !isPremium) {
        router.push("/subscription");
      }
    },
    [currentUserId, createThreadId, router, activeTab, isPremium]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      </SafeAreaView>
    );
  }

  const displayedMatches =
    activeTab === "matches"
      ? mutualMatches
      : activeTab === "likes"
      ? pendingLikes
      : whoLikedYou;

  const emptyMessage =
    activeTab === "matches"
      ? "No mutual matches yet. Keep swiping!"
      : activeTab === "likes"
      ? "You haven't liked anyone yet. Start swiping!"
      : "No one has liked you yet. Keep swiping!";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/swipe')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Matches</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "matches" && styles.activeTab]}
          onPress={() => setActiveTab("matches")}
        >
          <Text
            style={[styles.tabText, activeTab === "matches" && styles.activeTabText]}
          >
            Matches ({mutualMatches.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "likes" && styles.activeTab]}
          onPress={() => setActiveTab("likes")}
        >
          <Text
            style={[styles.tabText, activeTab === "likes" && styles.activeTabText]}
          >
            Likes ({pendingLikes.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "wholiked" && styles.activeTab]}
          onPress={() => setActiveTab("wholiked")}
        >
          <Text
            style={[styles.tabText, activeTab === "wholiked" && styles.activeTabText]}
          >
            Who Liked You ({whoLikedYou.length})
          </Text>
        </TouchableOpacity>
      </View>

      {displayedMatches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={displayedMatches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isActive = isUserActive(item.last_active_at);
            const isBlurred = activeTab === "wholiked" && !isPremium;
            return (
              <View style={styles.matchCard}>
                <TouchableOpacity
                  style={styles.matchMainContent}
                  onPress={() => handleMatchPress(item.id)}
                >
                  <View style={styles.imageContainer}>
                    <Image
                      source={{
                        uri: item.image_url || "https://via.placeholder.com/80",
                      }}
                      style={[styles.matchImage, isBlurred && styles.blurredImage]}
                      blurRadius={isBlurred ? 20 : 0}
                    />
                    {isActive && !isBlurred && <View style={styles.activeIndicator} />}
                    {isBlurred && (
                      <View style={styles.premiumOverlay}>
                        <Text style={styles.premiumIcon}>👀</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.matchInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.matchName}>
                        {isBlurred ? "Premium User" : `${item.name || "Unknown"}, ${item.age || "?"}`}
                        {isActive && !isBlurred && <Text style={styles.activeText}> • Active</Text>}
                      </Text>
                      {!isBlurred && (
                        <View style={styles.badgeContainer}>
                          <SubscriptionBadge
                            tier={item.subscription_tier}
                            status={item.subscription_status}
                            size="small"
                          />
                          <BlazeLevelBadge
                            level={item.blaze_level || 1}
                            size="small"
                          />
                        </View>
                      )}
                    </View>
                    <Text style={styles.matchBio} numberOfLines={2}>
                      {isBlurred
                        ? "Upgrade to Premium to see who liked you!"
                        : item.bio || "No bio"}
                    </Text>
                    <Text style={styles.messagePrompt}>
                      {activeTab === "matches"
                        ? "Tap to message"
                        : activeTab === "wholiked" && isBlurred
                        ? "Tap to upgrade"
                        : "Waiting for them to match"}
                    </Text>
                  </View>
                </TouchableOpacity>
                {!isBlurred && (
                  <TouchableOpacity
                    style={styles.viewProfileButton}
                    onPress={() => router.push(`/match?matchId=${item.id}`)}
                  >
                    <Text style={styles.viewProfileText}>View Profile</Text>
                  </TouchableOpacity>
                )}
                {isBlurred && (
                  <TouchableOpacity
                    style={styles.upgradeProfileButton}
                    onPress={() => router.push("/subscription")}
                  >
                    <Text style={styles.upgradeProfileText}>Upgrade to See</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2f2f2f",
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#2f2f2f",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#00FF7F",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
  },
  activeTabText: {
    color: "#00FF7F",
  },
  list: {
    padding: 16,
  },
  matchCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0px 2px 8px 0px rgba(0, 255, 127, 0.2)",
    elevation: 3,
  },
  matchMainContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  imageContainer: {
    position: "relative",
    marginRight: 16,
  },
  matchImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#00FF7F",
  },
  activeIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#00FF7F",
    borderWidth: 2,
    borderColor: "#1e1e1e",
  },
  matchInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeText: {
    fontSize: 14,
    color: "#00FF7F",
    fontWeight: "600",
  },
  viewProfileButton: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00FF7F",
    alignItems: "center",
  },
  viewProfileText: {
    color: "#00FF7F",
    fontSize: 14,
    fontWeight: "600",
  },
  matchName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  matchBio: {
    fontSize: 14,
    color: "#aaa",
    marginBottom: 8,
  },
  messagePrompt: {
    fontSize: 13,
    color: "#00FF7F",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
  },
  blurredImage: {
    opacity: 0.6,
  },
  premiumOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 40,
  },
  premiumIcon: {
    fontSize: 32,
  },
  upgradeProfileButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  upgradeProfileText: {
    color: "#121212",
    fontSize: 14,
    fontWeight: "700",
  },
});
