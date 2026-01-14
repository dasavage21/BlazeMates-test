import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";
import { updateUserActivity } from "../lib/activityTracker";
import { Heart, MessageCircle, Plus } from "lucide-react-native";

const screenWidth = Dimensions.get("window").width;

const isSmallPhone = screenWidth <= 390;
const isMediumPhone = screenWidth > 390 && screenWidth < 414;
const isDesktop = screenWidth >= 768;

const navPadding = isSmallPhone ? 8 : (isMediumPhone ? 14 : (isDesktop ? 40 : 16));
const navGap = isSmallPhone ? 6 : (isMediumPhone ? 16 : (isDesktop ? 24 : 16));
const navFontSize = isSmallPhone ? 11 : (isDesktop ? 15 : 13);
const logoSize = isSmallPhone ? 20 : 28;
const brandFontSize = isSmallPhone ? 13 : 20;
const navProfilePicSize = isSmallPhone ? 26 : 36;

type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_name: string;
  user_image: string | null;
  like_count: number;
  comment_count: number;
};

export default function FeedScreen() {
  const router = useRouter();
  const PLACEHOLDER_50 = "https://via.placeholder.com/50";

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(PLACEHOLDER_50);

  const loadHeaderPhoto = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authedUser = auth?.user;

      if (authedUser?.id) {
        const { data, error } = await supabase
          .from("users")
          .select("image_url")
          .eq("id", authedUser.id)
          .maybeSingle();

        if (!error && data?.image_url) {
          const ts = (await AsyncStorage.getItem("avatarVersion")) || "";
          setProfilePhoto(ts ? `${data.image_url}?t=${ts}` : data.image_url);
          return;
        }
      }

      const stored = await AsyncStorage.getItem("userProfile");
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.profileImage) {
        const ts = (await AsyncStorage.getItem("avatarVersion")) || "";
        setProfilePhoto(
          ts ? `${parsed.profileImage}?t=${ts}` : parsed.profileImage
        );
        return;
      }

      const pending = await AsyncStorage.getItem("pendingAvatarUri");
      if (pending) {
        setProfilePhoto(pending || PLACEHOLDER_50);
        return;
      }

      setProfilePhoto(PLACEHOLDER_50);
    } catch {
      setProfilePhoto(PLACEHOLDER_50);
    }
  }, [PLACEHOLDER_50]);

  const loadPosts = useCallback(async () => {
    try {
      const { data: postsData, error } = await supabase
        .from("feed_posts")
        .select(`
          id,
          user_id,
          content,
          image_url,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to fetch posts:", error);
        return;
      }

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, image_url")
        .in("id", userIds);

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

      const postIds = postsData.map(p => p.id);
      const { data: likesData } = await supabase
        .from("post_likes")
        .select("post_id")
        .in("post_id", postIds);

      const { data: commentsData } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      const likeCounts = new Map<string, number>();
      likesData?.forEach(like => {
        likeCounts.set(like.post_id, (likeCounts.get(like.post_id) || 0) + 1);
      });

      const commentCounts = new Map<string, number>();
      commentsData?.forEach(comment => {
        commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) || 0) + 1);
      });

      const enrichedPosts: Post[] = postsData.map(post => {
        const user = usersMap.get(post.user_id);
        return {
          id: post.id,
          user_id: post.user_id,
          content: post.content,
          image_url: post.image_url,
          created_at: post.created_at,
          user_name: user?.name || "Unknown User",
          user_image: user?.image_url || null,
          like_count: likeCounts.get(post.id) || 0,
          comment_count: commentCounts.get(post.id) || 0,
        };
      });

      setPosts(enrichedPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHeaderPhoto();
    loadPosts();
  }, [loadHeaderPhoto, loadPosts]);

  useFocusEffect(
    useCallback(() => {
      updateUserActivity();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [loadPosts]);

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffMs = now.getTime() - postTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return postTime.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00FF7F" />
            <Text style={styles.loadingText}>Loading feed...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF7F" />
        }
      >
        <View style={styles.container}>
          <View style={styles.navbar}>
            <View style={styles.navLeft}>
              <Text style={styles.logo}>🔥</Text>
              <Text style={styles.brandName} numberOfLines={1}>BlazeMates</Text>
            </View>

            <View style={styles.navCenter}>
              <TouchableOpacity onPress={() => router.push("/profile")}>
                <Image
                  key={profilePhoto}
                  source={{ uri: profilePhoto || PLACEHOLDER_50 }}
                  style={styles.navProfilePic}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/swipe")}>
                <Text style={styles.navLink}>
                  {isSmallPhone ? "🔥" : "🔥 Discover"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/matches")}>
                <Text style={styles.navLink}>
                  {isSmallPhone ? "👥" : "👥 DMs"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/groups")}>
                <Text style={styles.navLink}>
                  {isSmallPhone ? "💬" : "💬 Groups"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/events")}>
                <Text style={styles.navLink}>
                  {isSmallPhone ? "📅" : "📅 Events"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.navRight}>
              <TouchableOpacity onPress={() => router.push("/settings")}>
                <Text style={styles.navLink} numberOfLines={1}>
                  {isSmallPhone ? "⚙️" : "⚙️ Settings"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.feedContainer}>
            <Text style={styles.pageTitle}>Community Feed</Text>

            {posts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Text style={styles.emptyIconText}>📝</Text>
                </View>
                <Text style={styles.emptyTitle}>No Posts Yet</Text>
                <Text style={styles.emptyText}>
                  Be the first to share something with the community!
                </Text>
              </View>
            ) : (
              posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <Image
                      source={{ uri: post.user_image || "https://via.placeholder.com/40" }}
                      style={styles.postAvatar}
                    />
                    <View style={styles.postHeaderInfo}>
                      <Text style={styles.postUserName}>{post.user_name}</Text>
                      <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
                    </View>
                  </View>

                  <Text style={styles.postContent}>{post.content}</Text>

                  {post.image_url && (
                    <Image
                      source={{ uri: post.image_url }}
                      style={styles.postImage}
                      resizeMode="cover"
                    />
                  )}

                  <View style={styles.postActions}>
                    <View style={styles.actionItem}>
                      <Heart size={20} color="#888" />
                      <Text style={styles.actionText}>{post.like_count}</Text>
                    </View>
                    <View style={styles.actionItem}>
                      <MessageCircle size={20} color="#888" />
                      <Text style={styles.actionText}>{post.comment_count}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>
            BlazeMates LLC v1.0.0 (c) 2025 BlazeMates LLC. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/create-post")}
      >
        <Plus size={28} color="#121212" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#0f0f0f",
  },
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    paddingVertical: isSmallPhone ? 10 : 12,
    paddingHorizontal: navPadding,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  navLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: isSmallPhone ? 4 : 8,
    flex: 1,
    minWidth: 0,
  },
  logo: {
    fontSize: logoSize,
  },
  brandName: {
    fontSize: brandFontSize,
    fontWeight: "bold",
    color: "#00FF7F",
    flexShrink: 1,
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: isSmallPhone ? 6 : navGap,
    flex: 2,
    justifyContent: "center",
    minWidth: 0,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    minWidth: 0,
  },
  navLink: {
    color: "#fff",
    fontSize: navFontSize,
    fontWeight: "500",
    flexShrink: 1,
  },
  navProfilePic: {
    width: navProfilePicSize,
    height: navProfilePicSize,
    borderRadius: navProfilePicSize / 2,
    borderColor: "#00FF7F",
    borderWidth: 2,
  },
  feedContainer: {
    flex: 1,
    paddingHorizontal: isDesktop ? 40 : 16,
    paddingTop: 24,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
  },
  pageTitle: {
    fontSize: isDesktop ? 32 : 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  postCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#00FF7F",
    marginRight: 12,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  postTime: {
    fontSize: 13,
    color: "#888",
  },
  postContent: {
    fontSize: 15,
    color: "#ccc",
    lineHeight: 22,
    marginBottom: 12,
  },
  postImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#00FF7F",
    fontSize: isSmallPhone ? 16 : 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#2a2a2a",
  },
  emptyIconText: {
    fontSize: 48,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: isSmallPhone ? 20 : 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: "#888",
    fontSize: isSmallPhone ? 14 : 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 400,
  },
  footer: {
    color: "#777",
    paddingVertical: isSmallPhone ? 16 : 20,
    paddingHorizontal: 16,
    fontSize: isSmallPhone ? 10 : 12,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#00FF7F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00FF7F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
