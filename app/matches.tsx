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

export default function MatchesScreen() {
  const router = useRouter();
  const [connections, setConnections] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

      if (likedUserIds.length === 0) {
        setConnections([]);
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

      if (mutualUserIds.length === 0) {
        setConnections([]);
        setLoading(false);
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, age, bio, image_url, last_active_at, subscription_tier, subscription_status, blaze_level")
        .in("id", mutualUserIds);

      if (usersError) {
        console.error("Failed to fetch users:", usersError);
        setLoading(false);
        return;
      }

      setConnections(usersData || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading connections:", error);
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

      const threadId = createThreadId(currentUserId, matchId);

      try {
        await supabase.from("threads").upsert({ id: threadId }, { onConflict: "id" });
      } catch (e: any) {
        console.warn("Failed to create chat thread", e);
      }

      router.push({ pathname: "/chat", params: { threadId } });
    },
    [currentUserId, createThreadId, router]
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/swipe')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Direct Messages</Text>
      </View>

      {connections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No connections yet. Keep exploring the community!
          </Text>
        </View>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isActive = isUserActive(item.last_active_at);
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
                      style={styles.matchImage}
                    />
                    {isActive && <View style={styles.activeIndicator} />}
                  </View>
                  <View style={styles.matchInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.matchName}>
                        {`${item.name || "Unknown"}, ${item.age || "?"}`}
                        {isActive && <Text style={styles.activeText}> • Active</Text>}
                      </Text>
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
                    </View>
                    <Text style={styles.matchBio} numberOfLines={2}>
                      {item.bio || "No bio"}
                    </Text>
                    <Text style={styles.messagePrompt}>Tap to message</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.viewProfileButton}
                  onPress={() => router.push(`/match?matchId=${item.id}`)}
                >
                  <Text style={styles.viewProfileText}>View Profile</Text>
                </TouchableOpacity>
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
});
