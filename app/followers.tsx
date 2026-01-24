import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { supabase } from "../supabaseClient";
import { ArrowLeft } from "lucide-react-native";

type User = {
  id: string;
  name: string;
  bio: string;
  image_url: string | null;
};

type FollowItem = {
  user: User;
};

export default function FollowersScreen() {
  const router = useRouter();
  const { userId, tab } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<"followers" | "following">(
    (tab as "followers" | "following") || "followers"
  );
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      if (userData) {
        setUserName(userData.name);
      }

      const { data: followersData } = await supabase
        .from("follows")
        .select(`
          follower_id,
          users!follows_follower_id_fkey(
            id,
            name,
            bio,
            image_url
          )
        `)
        .eq("followed_id", userId);

      const { data: followingData } = await supabase
        .from("follows")
        .select(`
          followed_id,
          users!follows_followed_id_fkey(
            id,
            name,
            bio,
            image_url
          )
        `)
        .eq("follower_id", userId);

      if (followersData) {
        setFollowers(
          followersData
            .map((item: any) => item.users)
            .filter((user: any) => user !== null)
        );
      }

      if (followingData) {
        setFollowing(
          followingData
            .map((item: any) => item.users)
            .filter((user: any) => user !== null)
        );
      }
    } catch (error) {
      console.error("Error loading followers/following:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => router.push({ pathname: "/profile", params: { userId: item.id } })}
    >
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.userAvatar}
        />
      ) : (
        <View style={[styles.userAvatar, styles.defaultAvatar]} />
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        {item.bio && <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>}
      </View>
    </TouchableOpacity>
  );

  const currentData = activeTab === "followers" ? followers : following;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#00FF7F" />
        </TouchableOpacity>
        <Text style={styles.title}>{userName}</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "followers" && styles.activeTab]}
          onPress={() => setActiveTab("followers")}
        >
          <Text style={[styles.tabText, activeTab === "followers" && styles.activeTabText]}>
            Followers
          </Text>
          <Text style={[styles.tabCount, activeTab === "followers" && styles.activeTabCount]}>
            {followers.length}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "following" && styles.activeTab]}
          onPress={() => setActiveTab("following")}
        >
          <Text style={[styles.tabText, activeTab === "following" && styles.activeTabText]}>
            Following
          </Text>
          <Text style={[styles.tabCount, activeTab === "following" && styles.activeTabCount]}>
            {following.length}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === "followers" ? "No followers yet" : "Not following anyone yet"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    gap: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
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
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
    marginBottom: 4,
  },
  activeTabText: {
    color: "#fff",
  },
  tabCount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
  },
  activeTabCount: {
    color: "#00FF7F",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#00FF7F",
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  userBio: {
    fontSize: 14,
    color: "#888",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  defaultAvatar: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
