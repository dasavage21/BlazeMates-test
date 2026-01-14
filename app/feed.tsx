import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";
import { updateUserActivity } from "../lib/activityTracker";
import { Heart, MessageCircle, Plus, Send, X } from "lucide-react-native";

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
  is_liked: boolean;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string;
  user_image: string | null;
};

export default function FeedScreen() {
  const router = useRouter();
  const PLACEHOLDER_50 = "https://via.placeholder.com/50";

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(PLACEHOLDER_50);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

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
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

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
        .select("post_id, user_id")
        .in("post_id", postIds);

      const { data: commentsData } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      const likeCounts = new Map<string, number>();
      const userLikes = new Set<string>();

      likesData?.forEach(like => {
        likeCounts.set(like.post_id, (likeCounts.get(like.post_id) || 0) + 1);
        if (like.user_id === currentUserId) {
          userLikes.add(like.post_id);
        }
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
          is_liked: userLikes.has(post.id),
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

  useEffect(() => {
    const channel = supabase
      .channel("feed_posts_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_posts",
        },
        () => {
          loadPosts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_likes",
        },
        () => {
          loadPosts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_comments",
        },
        () => {
          loadPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      updateUserActivity();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [loadPosts]);

  const handleLikeToggle = async (postId: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) return;

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      setPosts(posts.map(p =>
        p.id === postId
          ? {
              ...p,
              is_liked: !post.is_liked,
              like_count: post.is_liked ? p.like_count - 1 : p.like_count + 1
            }
          : p
      ));

      if (post.is_liked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) {
          console.error("Error unliking post:", error);
          setPosts(posts.map(p =>
            p.id === postId
              ? { ...p, is_liked: true, like_count: p.like_count + 1 }
              : p
          ));
        }
      } else {
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: userId });

        if (error) {
          console.error("Error liking post:", error);
          setPosts(posts.map(p =>
            p.id === postId
              ? { ...p, is_liked: false, like_count: p.like_count - 1 }
              : p
          ));
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const loadComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const { data: commentsData, error } = await supabase
        .from("post_comments")
        .select("id, post_id, user_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading comments:", error);
        return;
      }

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, image_url")
        .in("id", userIds);

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

      const enrichedComments: Comment[] = commentsData.map(comment => {
        const user = usersMap.get(comment.user_id);
        return {
          ...comment,
          user_name: user?.name || "Unknown User",
          user_image: user?.image_url || null,
        };
      });

      setComments(enrichedComments);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const openCommentModal = (postId: string) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
    loadComments(postId);
  };

  useEffect(() => {
    if (!selectedPostId || !commentModalVisible) return;

    const channel = supabase
      .channel(`comments_${selectedPostId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "post_comments",
          filter: `post_id=eq.${selectedPostId}`,
        },
        () => {
          loadComments(selectedPostId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPostId, commentModalVisible]);

  const closeCommentModal = () => {
    setCommentModalVisible(false);
    setSelectedPostId(null);
    setComments([]);
    setCommentText("");
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !selectedPostId) return;

    setSubmittingComment(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) return;

      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: selectedPostId,
          user_id: userId,
          content: commentText.trim(),
        });

      if (error) {
        console.error("Error submitting comment:", error);
        return;
      }

      setCommentText("");
      Keyboard.dismiss();
      loadComments(selectedPostId);
      loadPosts();
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

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
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => handleLikeToggle(post.id)}
                    >
                      <Heart
                        size={20}
                        color={post.is_liked ? "#FF4444" : "#888"}
                        fill={post.is_liked ? "#FF4444" : "none"}
                      />
                      <Text style={[
                        styles.actionText,
                        post.is_liked && styles.actionTextActive
                      ]}>
                        {post.like_count}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => openCommentModal(post.id)}
                    >
                      <MessageCircle size={20} color="#888" />
                      <Text style={styles.actionText}>{post.comment_count}</Text>
                    </TouchableOpacity>
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

      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeCommentModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={closeCommentModal}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.commentsContainer}>
              {loadingComments ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#00FF7F" />
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyCommentsText}>
                    No comments yet. Be the first to comment!
                  </Text>
                </View>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <Image
                      source={{ uri: comment.user_image || "https://via.placeholder.com/40" }}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUserName}>{comment.user_name}</Text>
                        <Text style={styles.commentTime}>{formatTime(comment.created_at)}</Text>
                      </View>
                      <Text style={styles.commentText}>{comment.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#666"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!commentText.trim() || submittingComment) && styles.sendButtonDisabled
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#121212" />
                ) : (
                  <Send size={20} color="#121212" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: isDesktop ? 48 : 20,
    paddingTop: 32,
    paddingBottom: 24,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
  },
  pageTitle: {
    fontSize: isDesktop ? 36 : 30,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 28,
    letterSpacing: -1,
  },
  postCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
    ...(Platform.OS === "web" && {
      transition: "all 0.2s ease",
    }),
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  postAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: "#00FF7F",
    marginRight: 14,
    boxShadow: "0 2px 8px rgba(0, 255, 127, 0.3)",
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  postTime: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  postContent: {
    fontSize: 16,
    color: "#e0e0e0",
    lineHeight: 24,
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  postImage: {
    width: "100%",
    height: 300,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#0f0f0f",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.4)",
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#141414",
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s ease",
    }),
  },
  actionText: {
    fontSize: 15,
    color: "#999",
    fontWeight: "600",
  },
  actionTextActive: {
    color: "#FF4444",
    fontWeight: "700",
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
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#00FF7F",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    boxShadow: "0 8px 24px rgba(0, 255, 127, 0.4)",
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.3s ease",
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  commentsContainer: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  emptyComments: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCommentsText: {
    color: "#888",
    fontSize: 15,
    textAlign: "center",
  },
  commentItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#00FF7F",
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  commentTime: {
    fontSize: 12,
    color: "#888",
  },
  commentText: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00FF7F",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#2a2a2a",
    opacity: 0.5,
  },
});
