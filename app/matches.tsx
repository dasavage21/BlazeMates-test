// © 2025 Benjamin Hawk. All rights reserved.
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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

type Connection = {
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

export default function ConnectionsScreen() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isUserActive = useCallback((lastActiveAt: string | null): boolean => {
    if (!lastActiveAt) return false;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const lastActive = new Date(lastActiveAt);
    return lastActive > tenMinutesAgo;
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (!myUserId) {
        setLoading(false);
        return;
      }

      setCurrentUserId(myUserId);

      // Get unique user IDs from messages (people you've chatted with)
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("user_id")
        .neq("user_id", myUserId);

      if (messagesError) {
        console.error("Failed to fetch messages:", messagesError);
        setLoading(false);
        return;
      }

      // Get unique user IDs from threads where this user participated
      const uniqueUserIds = Array.from(
        new Set((messages || []).map((msg) => msg.user_id))
      );

      if (uniqueUserIds.length === 0) {
        setConnections([]);
        setLoading(false);
        return;
      }

      // Fetch user details
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, age, bio, image_url, last_active_at, subscription_tier, subscription_status, blaze_level")
        .in("id", uniqueUserIds);

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
      loadConnections();
      updateUserActivity();
    }, [loadConnections])
  );

  const createThreadId = useCallback((userId1: string, userId2: string) => {
    const sorted = [userId1, userId2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }, []);

  const handleConnectionPress = useCallback(
    async (connectionId: string) => {
      if (!currentUserId) return;

      const threadId = createThreadId(currentUserId, connectionId);

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
        <TouchableOpacity onPress={() => router.push('/feed')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Direct Messages</Text>
      </View>

      {connections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No direct messages yet. Join groups and start conversations!
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
              <TouchableOpacity
                style={styles.connectionCard}
                onPress={() => handleConnectionPress(item.id)}
              >
                <View style={styles.imageContainer}>
                  <Image
                    source={{
                      uri: item.image_url || "https://via.placeholder.com/80",
                    }}
                    style={styles.connectionImage}
                  />
                  {isActive && <View style={styles.activeIndicator} />}
                </View>
                <View style={styles.connectionInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.connectionName}>
                      {`${item.name || "Unknown"}`}
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
                  <Text style={styles.connectionBio} numberOfLines={2}>
                    {item.bio || "No bio"}
                  </Text>
                  <Text style={styles.messagePrompt}>Tap to message</Text>
                </View>
              </TouchableOpacity>
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
    color: "#00FF7F",
    fontWeight: "bold",
  },
  list: {
    padding: 16,
  },
  connectionCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0px 2px 8px 0px rgba(0, 255, 127, 0.2)",
    elevation: 3,
  },
  imageContainer: {
    position: "relative",
    marginRight: 16,
  },
  connectionImage: {
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
  connectionInfo: {
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
  connectionName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#00FF7F",
  },
  connectionBio: {
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
    color: "#7FFF9F",
    textAlign: "center",
    lineHeight: 24,
  },
});
