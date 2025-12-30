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

type Match = {
  id: string;
  name: string;
  age: number;
  bio: string;
  image_url: string | null;
};

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (!myUserId) {
        setLoading(false);
        return;
      }

      setCurrentUserId(myUserId);

      const { data: likesData, error: likesError } = await supabase
        .from("likes")
        .select("liked_user_id")
        .eq("user_id", myUserId);

      if (likesError) {
        console.error("Failed to fetch likes:", likesError);
        setLoading(false);
        return;
      }

      const likedUserIds = (likesData || []).map((like) => like.liked_user_id);

      if (likedUserIds.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, age, bio, image_url")
        .in("id", likedUserIds);

      if (usersError) {
        console.error("Failed to fetch users:", usersError);
        setLoading(false);
        return;
      }

      setMatches(usersData || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading matches:", error);
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [loadMatches])
  );

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Matches</Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No matches yet. Start swiping to find your BlazeMates!
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.matchCard}
              onPress={() => handleMatchPress(item.id)}
            >
              <Image
                source={{
                  uri: item.image_url || "https://via.placeholder.com/80",
                }}
                style={styles.matchImage}
              />
              <View style={styles.matchInfo}>
                <Text style={styles.matchName}>
                  {item.name || "Unknown"}, {item.age || "?"}
                </Text>
                <Text style={styles.matchBio} numberOfLines={2}>
                  {item.bio || "No bio"}
                </Text>
                <Text style={styles.messagePrompt}>Tap to message</Text>
              </View>
            </TouchableOpacity>
          )}
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
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0px 2px 8px 0px rgba(0, 255, 127, 0.2)",
    elevation: 3,
  },
  matchImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    borderWidth: 2,
    borderColor: "#00FF7F",
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
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
