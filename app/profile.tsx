// © 2025 Benjamin Hawk. All rights reserved.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

const PLACEHOLDER_50 = "https://via.placeholder.com/50";
const isDesktop = Platform.OS === "web" && Dimensions.get("window").width >= 768;

type Match = {
  id: string;
  name: string;
  age: number;
  bio: string;
  image_url: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadProfileAndMatches();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const stored = await AsyncStorage.getItem("userProfile");
        if (stored) {
          const data = JSON.parse(stored);
          setProfileImage(data.profileImage ?? null);
        }
      })();
    }, [])
  );

  const loadProfileAndMatches = async () => {
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
        .select("image_url")
        .eq("id", myUserId)
        .maybeSingle();

      if (userData?.image_url) {
        setProfileImage(userData.image_url);
      }

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
      console.error("Error loading:", error);
      setLoading(false);
    }
  };

  const handleMatchPress = useCallback(
    (matchId: string) => {
      router.push({ pathname: "/match", params: { userId: matchId } });
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity
          onPress={() => router.push("/profile-edit")}
          style={styles.navProfileContainer}
        >
          <Image
            key={profileImage}
            source={{ uri: profileImage || PLACEHOLDER_50 }}
            style={styles.navProfilePic}
          />
          <Text style={styles.navYouText}>You</Text>
        </TouchableOpacity>

        <View style={styles.navIconsRight}>
          <TouchableOpacity onPress={() => router.push("/swipe")}>
            <Text style={styles.navIcon}>🔥</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/map")}>
            <Text style={styles.navIcon}>🗺️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Text style={styles.navIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <View style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>
            Matches
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B5C" />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyCard}>
            <View style={styles.gradientBox} />
            <Text style={styles.emptyTitle}>Start Matching</Text>
            <Text style={styles.emptyText}>
              Matches will appear here once you start to Like people. You can
              message them directly from here when you're ready to spark up the
              conversation.
            </Text>
          </View>
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
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FF3B5C",
    paddingVertical: 12,
    paddingHorizontal: isDesktop ? 40 : 16,
  },
  navProfileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navProfilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: "#fff",
    borderWidth: 2,
  },
  navYouText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  navIconsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  navIcon: {
    fontSize: 24,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#FF3B5C",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
  },
  activeTabText: {
    color: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    maxWidth: 340,
  },
  gradientBox: {
    width: 120,
    height: 160,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: "#FF6B8A",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  list: {
    padding: 16,
  },
  matchCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  matchImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  matchBio: {
    fontSize: 14,
    color: "#666",
  },
});
