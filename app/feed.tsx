import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../supabaseClient";
import { updateUserActivity } from "../lib/activityTracker";
import { MessageCircle, Plus, Send, X, MoreVertical, Trash2, AlertTriangle, Ban, Flame, Wind, Laugh, Sparkles } from "lucide-react-native";

const screenWidth = Dimensions.get("window").width;

const isSmallPhone = screenWidth <= 390;
const isMediumPhone = screenWidth > 390 && screenWidth < 414;
const isDesktop = screenWidth >= 768;

const navPadding = isSmallPhone ? 12 : (isMediumPhone ? 14 : (isDesktop ? 40 : 16));
const navGap = isSmallPhone ? 10 : (isMediumPhone ? 16 : (isDesktop ? 24 : 16));
const navFontSize = isSmallPhone ? 14 : (isDesktop ? 15 : 13);
const logoSize = isSmallPhone ? 26 : 28;
const brandFontSize = isSmallPhone ? 16 : 20;
const navProfilePicSize = isSmallPhone ? 34 : 36;

type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_name: string;
  user_image: string | null;
  user_last_active: string | null;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  tags: string[] | null;
  is_moment: boolean;
  expires_at: string | null;
  reactions: {
    smoke: number;
    fire: number;
    funny: number;
    chill: number;
  };
  user_reaction: string | null;
};

type TrendingTag = {
  tag: string;
  usage_count: number;
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
  const [postMenuVisible, setPostMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);

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

  const loadTrendingTags = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("trending_tags")
        .select("tag, usage_count")
        .order("usage_count", { ascending: false })
        .limit(10);

      if (!error && data) {
        setTrendingTags(data);
      }
    } catch (error) {
      console.error("Error loading trending tags:", error);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      let blockedUserIds: string[] = [];
      if (currentUserId) {
        const { data: blocksData } = await supabase
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", currentUserId);

        blockedUserIds = blocksData?.map(b => b.blocked_id) || [];
      }

      let query = supabase
        .from("feed_posts")
        .select(`
          id,
          user_id,
          content,
          image_url,
          created_at,
          tags,
          is_moment,
          expires_at
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filterTag) {
        query = query.contains("tags", [filterTag]);
      }

      const { data: postsData, error } = await query;

      if (error) {
        console.error("Failed to fetch posts:", error);
        return;
      }

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const filteredPosts = postsData.filter(post => !blockedUserIds.includes(post.user_id));

      if (filteredPosts.length === 0) {
        setPosts([]);
        return;
      }

      const userIds = [...new Set(filteredPosts.map(p => p.user_id))];
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, image_url, last_active_at")
        .in("id", userIds);

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

      const postIds = filteredPosts.map(p => p.id);
      const { data: likesData } = await supabase
        .from("post_likes")
        .select("post_id, user_id, reaction_type")
        .in("post_id", postIds);

      const { data: commentsData } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      const reactionCounts = new Map<string, { smoke: number; fire: number; funny: number; chill: number }>();
      const userReactions = new Map<string, string>();

      likesData?.forEach(like => {
        if (!reactionCounts.has(like.post_id)) {
          reactionCounts.set(like.post_id, { smoke: 0, fire: 0, funny: 0, chill: 0 });
        }
        const counts = reactionCounts.get(like.post_id)!;
        if (like.reaction_type === 'smoke') counts.smoke++;
        else if (like.reaction_type === 'fire') counts.fire++;
        else if (like.reaction_type === 'funny') counts.funny++;
        else if (like.reaction_type === 'chill') counts.chill++;

        if (like.user_id === currentUserId) {
          userReactions.set(like.post_id, like.reaction_type);
        }
      });

      const likeCounts = new Map<string, number>();
      likesData?.forEach(like => {
        likeCounts.set(like.post_id, (likeCounts.get(like.post_id) || 0) + 1);
      });

      const commentCounts = new Map<string, number>();
      commentsData?.forEach(comment => {
        commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) || 0) + 1);
      });

      const enrichedPosts: Post[] = filteredPosts.map(post => {
        const user = usersMap.get(post.user_id);
        return {
          id: post.id,
          user_id: post.user_id,
          content: post.content,
          image_url: post.image_url,
          created_at: post.created_at,
          user_name: user?.name || "Unknown User",
          user_image: user?.image_url || null,
          user_last_active: user?.last_active_at || null,
          like_count: likeCounts.get(post.id) || 0,
          comment_count: commentCounts.get(post.id) || 0,
          is_liked: userReactions.has(post.id),
          tags: post.tags,
          is_moment: post.is_moment,
          expires_at: post.expires_at,
          reactions: reactionCounts.get(post.id) || { smoke: 0, fire: 0, funny: 0, chill: 0 },
          user_reaction: userReactions.get(post.id) || null,
        };
      });

      setPosts(enrichedPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterTag]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id || null;
      setCurrentUserId(userId);
    };
    loadCurrentUser();
    loadHeaderPhoto();
    loadPosts();
    loadTrendingTags();
  }, [loadHeaderPhoto, loadPosts, loadTrendingTags]);

  useEffect(() => {
    let likesDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channelName = `feed_posts_changes_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_posts",
        },
        (payload) => {
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
        (payload) => {
          if (likesDebounceTimer) {
            clearTimeout(likesDebounceTimer);
          }
          likesDebounceTimer = setTimeout(() => {
            loadPosts();
          }, 500);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_comments",
        },
        (payload) => {
          loadPosts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocks",
        },
        (payload) => {
          loadPosts();
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Realtime subscription error:", err);
        }
      });

    return () => {
      if (likesDebounceTimer) {
        clearTimeout(likesDebounceTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      updateUserActivity();
      loadPosts();
    }, [loadPosts])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [loadPosts]);

  const handleReaction = async (postId: string, reactionType: 'smoke' | 'fire' | 'funny' | 'chill') => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) return;

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const hadReaction = post.user_reaction;
      const sameReaction = hadReaction === reactionType;

      if (sameReaction) {
        const newReactions = { ...post.reactions };
        newReactions[reactionType]--;

        setPosts(posts.map(p =>
          p.id === postId
            ? {
                ...p,
                user_reaction: null,
                is_liked: false,
                like_count: p.like_count - 1,
                reactions: newReactions
              }
            : p
        ));

        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) {
          console.error("Error removing reaction:", error);
          loadPosts();
        }
      } else {
        const newReactions = { ...post.reactions };
        if (hadReaction) {
          newReactions[hadReaction as keyof typeof newReactions]--;
        }
        newReactions[reactionType]++;

        setPosts(posts.map(p =>
          p.id === postId
            ? {
                ...p,
                user_reaction: reactionType,
                is_liked: true,
                like_count: hadReaction ? p.like_count : p.like_count + 1,
                reactions: newReactions
              }
            : p
        ));

        if (hadReaction) {
          await supabase
            .from("post_likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", userId);
        }

        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: userId, reaction_type: reactionType });

        if (error && error.code !== '23505') {
          console.error("Error adding reaction:", error);
          loadPosts();
        }
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
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
          loadPosts();
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
    const previousPosts = [...posts];

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) return;

      // Optimistic update: immediately increment comment count
      setPosts(posts.map(p =>
        p.id === selectedPostId
          ? { ...p, comment_count: p.comment_count + 1 }
          : p
      ));

      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: selectedPostId,
          user_id: userId,
          content: commentText.trim(),
        });

      if (error) {
        console.error("Error submitting comment:", error);
        // Revert optimistic update on error
        setPosts(previousPosts);
        return;
      }

      setCommentText("");
      Keyboard.dismiss();
      loadComments(selectedPostId);
    } catch (error) {
      console.error("Error submitting comment:", error);
      // Revert on error
      setPosts(previousPosts);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleQuickReply = async (postId: string, text: string) => {
    const previousPosts = [...posts];

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) return;

      // Optimistic update: immediately increment comment count
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, comment_count: p.comment_count + 1 }
          : p
      ));

      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: userId,
          content: text,
        });

      if (error) {
        console.error("Error submitting quick reply:", error);
        // Revert optimistic update on error
        setPosts(previousPosts);
        return;
      }
    } catch (error) {
      console.error("Error submitting quick reply:", error);
      // Revert on error
      setPosts(previousPosts);
    }
  };

  const isUserOnline = useCallback((lastActiveAt: string | null): boolean => {
    if (!lastActiveAt) return false;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const lastActive = new Date(lastActiveAt);
    return lastActive > tenMinutesAgo;
  }, []);

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

  const openPostMenu = (post: Post) => {
    setSelectedPost(post);
    setPostMenuVisible(true);
  };

  const closePostMenu = () => {
    setPostMenuVisible(false);
    setSelectedPost(null);
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;

    if (Platform.OS === 'web') {
      if (!window.confirm("Are you sure you want to delete this post?")) {
        return;
      }

      try {
        const { error } = await supabase
          .from("feed_posts")
          .delete()
          .eq("id", selectedPost.id);

        if (error) {
          console.error("Error deleting post:", error);
          alert(`Failed to delete post: ${error.message}`);
          return;
        }

        closePostMenu();
        await new Promise(resolve => setTimeout(resolve, 300));
        loadPosts();
      } catch (error) {
        console.error("Error deleting post:", error);
        alert("An unexpected error occurred");
      }
    } else {
      Alert.alert(
        "Delete Post",
        "Are you sure you want to delete this post?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("feed_posts")
                  .delete()
                  .eq("id", selectedPost.id);

                if (error) {
                  console.error("Error deleting post:", error);
                  Alert.alert("Error", `Failed to delete post: ${error.message}`);
                  return;
                }

                closePostMenu();
                await new Promise(resolve => setTimeout(resolve, 300));
                loadPosts();
              } catch (error) {
                console.error("Error deleting post:", error);
                Alert.alert("Error", "An unexpected error occurred");
              }
            },
          },
        ]
      );
    }
  };

  const handleReportPost = async () => {
    if (!selectedPost || !currentUserId) return;

    if (Platform.OS === 'web') {
      const reason = window.prompt(
        "Why are you reporting this post?\n\nEnter:\n1 for Spam\n2 for Inappropriate Content\n3 for Harassment",
        "1"
      );

      if (!reason) return;

      const reasonMap: { [key: string]: string } = {
        '1': 'spam',
        '2': 'inappropriate',
        '3': 'harassment'
      };

      await submitReport(reasonMap[reason] || 'spam');
    } else {
      Alert.alert(
        "Report Post",
        "Why are you reporting this post?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Spam",
            onPress: async () => {
              await submitReport("spam");
            },
          },
          {
            text: "Inappropriate Content",
            onPress: async () => {
              await submitReport("inappropriate");
            },
          },
          {
            text: "Harassment",
            onPress: async () => {
              await submitReport("harassment");
            },
          },
        ]
      );
    }
  };

  const submitReport = async (reason: string) => {
    if (!selectedPost || !currentUserId) return;

    try {
      const { error } = await supabase
        .from("reports")
        .insert({
          reporter_id: currentUserId,
          reported_id: selectedPost.user_id,
          reason: reason,
          context: `Reported post: ${selectedPost.content.substring(0, 100)}`,
        });

      if (error) {
        console.error("Error submitting report:", error);
        if (Platform.OS === 'web') {
          alert("Failed to submit report");
        } else {
          Alert.alert("Error", "Failed to submit report");
        }
        return;
      }

      closePostMenu();
      if (Platform.OS === 'web') {
        alert("Your report has been submitted. Thank you for helping keep our community safe.");
      } else {
        Alert.alert("Success", "Your report has been submitted. Thank you for helping keep our community safe.");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      if (Platform.OS === 'web') {
        alert("An unexpected error occurred");
      } else {
        Alert.alert("Error", "An unexpected error occurred");
      }
    }
  };

  const handleBlockUser = async () => {
    if (!selectedPost || !currentUserId) return;

    if (Platform.OS === 'web') {
      if (!window.confirm(`Are you sure you want to block ${selectedPost.user_name}? You won't see their posts anymore.`)) {
        return;
      }

      try {
        const { error } = await supabase
          .from("blocks")
          .insert({
            blocker_id: currentUserId,
            blocked_id: selectedPost.user_id,
          });

        if (error) {
          console.error("Error blocking user:", error);
          alert("Failed to block user");
          return;
        }

        closePostMenu();
        await new Promise(resolve => setTimeout(resolve, 300));
        loadPosts();
        alert(`You have blocked ${selectedPost.user_name}`);
      } catch (error) {
        console.error("Error blocking user:", error);
        alert("An unexpected error occurred");
      }
    } else {
      Alert.alert(
        "Block User",
        `Are you sure you want to block ${selectedPost.user_name}? You won't see their posts anymore.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("blocks")
                  .insert({
                    blocker_id: currentUserId,
                    blocked_id: selectedPost.user_id,
                  });

                if (error) {
                  console.error("Error blocking user:", error);
                  Alert.alert("Error", "Failed to block user");
                  return;
                }

                closePostMenu();
                await new Promise(resolve => setTimeout(resolve, 300));
                loadPosts();
                Alert.alert("Success", `You have blocked ${selectedPost.user_name}`);
              } catch (error) {
                console.error("Error blocking user:", error);
                Alert.alert("Error", "An unexpected error occurred");
              }
            },
          },
        ]
      );
    }
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
      <LinearGradient
        colors={['#1a1a1a', '#0a0a0a', '#1a1a1a']}
        style={styles.backgroundImage}
      >
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
              <TouchableOpacity onPress={() => router.push("/events")}>
                <Text style={styles.navLink}>
                  {isSmallPhone ? "📅" : "📅 Events"}
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

            {trendingTags.length > 0 && (
              <View style={styles.trendingSection}>
                <Text style={styles.trendingSectionTitle}>Trending This Week</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingTagsContainer}
                >
                  <TouchableOpacity
                    style={[
                      styles.trendingTag,
                      !filterTag && styles.trendingTagActive,
                    ]}
                    onPress={() => setFilterTag(null)}
                  >
                    <Text
                      style={[
                        styles.trendingTagText,
                        !filterTag && styles.trendingTagTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {trendingTags.map((tag) => (
                    <TouchableOpacity
                      key={tag.tag}
                      style={[
                        styles.trendingTag,
                        filterTag === tag.tag && styles.trendingTagActive,
                      ]}
                      onPress={() =>
                        setFilterTag(filterTag === tag.tag ? null : tag.tag)
                      }
                    >
                      <Text
                        style={[
                          styles.trendingTagText,
                          filterTag === tag.tag && styles.trendingTagTextActive,
                        ]}
                      >
                        {tag.tag}
                      </Text>
                      <Text style={styles.trendingTagCount}>{tag.usage_count}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

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
                <View key={post.id} style={[
                  styles.postCard,
                  post.is_moment && styles.momentCard
                ]}>
                  <View style={styles.postHeader}>
                    <TouchableOpacity
                      style={styles.postHeaderLeft}
                      onPress={() => router.push(`/profile?userId=${post.user_id}`)}
                    >
                      <View style={styles.avatarContainer}>
                        <Image
                          source={{ uri: post.user_image || "https://via.placeholder.com/40" }}
                          style={styles.postAvatar}
                        />
                        {isUserOnline(post.user_last_active) && (
                          <View style={styles.onlineIndicator} />
                        )}
                      </View>
                      <View style={styles.postHeaderInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.postUserName}>{post.user_name}</Text>
                          {isUserOnline(post.user_last_active) && (
                            <Text style={styles.onlineText}>• Online</Text>
                          )}
                          {post.is_moment && (
                            <View style={styles.momentBadge}>
                              <Text style={styles.momentBadgeText}>24h</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.postMenuButton}
                      onPress={() => openPostMenu(post)}
                    >
                      <MoreVertical size={20} color="#888" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.postContent}>{post.content}</Text>

                  {post.tags && post.tags.length > 0 && (
                    <View style={styles.postTagsContainer}>
                      {post.tags.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={styles.postTag}
                          onPress={() => setFilterTag(tag)}
                        >
                          <Text style={styles.postTagText}>{tag}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {post.image_url && (
                    <Image
                      source={{ uri: post.image_url }}
                      style={styles.postImage}
                      resizeMode="cover"
                    />
                  )}

                  <View style={styles.postActions}>
                    <TouchableOpacity
                      style={styles.reactionButton}
                      onPress={() => handleReaction(post.id, 'smoke')}
                    >
                      <Wind
                        size={20}
                        color={post.user_reaction === 'smoke' ? "#4CAF50" : "#888"}
                        fill={post.user_reaction === 'smoke' ? "#4CAF50" : "none"}
                      />
                      {post.reactions.smoke > 0 && (
                        <Text style={[
                          styles.reactionCount,
                          post.user_reaction === 'smoke' && styles.reactionCountActive
                        ]}>
                          {post.reactions.smoke}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reactionButton}
                      onPress={() => handleReaction(post.id, 'fire')}
                    >
                      <Flame
                        size={20}
                        color={post.user_reaction === 'fire' ? "#FF6B35" : "#888"}
                        fill={post.user_reaction === 'fire' ? "#FF6B35" : "none"}
                      />
                      {post.reactions.fire > 0 && (
                        <Text style={[
                          styles.reactionCount,
                          post.user_reaction === 'fire' && styles.reactionCountActive
                        ]}>
                          {post.reactions.fire}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reactionButton}
                      onPress={() => handleReaction(post.id, 'funny')}
                    >
                      <Laugh
                        size={20}
                        color={post.user_reaction === 'funny' ? "#FFD700" : "#888"}
                        fill={post.user_reaction === 'funny' ? "#FFD700" : "none"}
                      />
                      {post.reactions.funny > 0 && (
                        <Text style={[
                          styles.reactionCount,
                          post.user_reaction === 'funny' && styles.reactionCountActive
                        ]}>
                          {post.reactions.funny}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reactionButton}
                      onPress={() => handleReaction(post.id, 'chill')}
                    >
                      <Sparkles
                        size={20}
                        color={post.user_reaction === 'chill' ? "#00BCD4" : "#888"}
                        fill={post.user_reaction === 'chill' ? "#00BCD4" : "none"}
                      />
                      {post.reactions.chill > 0 && (
                        <Text style={[
                          styles.reactionCount,
                          post.user_reaction === 'chill' && styles.reactionCountActive
                        ]}>
                          {post.reactions.chill}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => openCommentModal(post.id)}
                    >
                      <MessageCircle size={20} color="#888" />
                      <Text style={styles.actionText}>{post.comment_count}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.quickReplyContainer}>
                    <TouchableOpacity
                      style={styles.quickReplyButton}
                      onPress={() => handleQuickReply(post.id, "Who's down?")}
                    >
                      <Text style={styles.quickReplyText}>Who's down?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickReplyButton}
                      onPress={() => handleQuickReply(post.id, "Where at?")}
                    >
                      <Text style={styles.quickReplyText}>Where at?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickReplyButton}
                      onPress={() => handleQuickReply(post.id, "What strain?")}
                    >
                      <Text style={styles.quickReplyText}>What strain?</Text>
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

      <Modal
        visible={postMenuVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closePostMenu}
      >
        <TouchableOpacity
          style={styles.postMenuOverlay}
          activeOpacity={1}
          onPress={closePostMenu}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.postMenuContent}>
              {selectedPost && currentUserId && (
                selectedPost.user_id === currentUserId ? (
                  <TouchableOpacity
                    style={styles.postMenuItem}
                    onPress={handleDeletePost}
                  >
                    <Trash2 size={20} color="#FF4444" />
                    <Text style={[styles.postMenuText, styles.postMenuTextDanger]}>
                      Delete Post
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.postMenuItem}
                      onPress={handleReportPost}
                    >
                      <AlertTriangle size={20} color="#FFA500" />
                      <Text style={styles.postMenuText}>Report Post</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.postMenuItem}
                      onPress={handleBlockUser}
                    >
                      <Ban size={20} color="#FF4444" />
                      <Text style={[styles.postMenuText, styles.postMenuTextDanger]}>
                        Block User
                      </Text>
                    </TouchableOpacity>
                  </>
                )
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
    opacity: 0.15,
    resizeMode: 'cover',
  },
  scrollView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    paddingVertical: isSmallPhone ? 14 : 12,
    paddingHorizontal: navPadding,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  navLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: isSmallPhone ? 6 : 8,
    flex: 1,
    minWidth: 0,
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
    gap: navGap,
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
    justifyContent: "space-between",
    marginBottom: 16,
  },
  postHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  postMenuButton: {
    padding: 8,
    marginLeft: 8,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 14,
  },
  postAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: "#00FF7F",
    boxShadow: "0 2px 8px rgba(0, 255, 127, 0.3)",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#00FF7F",
    borderWidth: 2,
    borderColor: "#1a1a1a",
  },
  postHeaderInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  postUserName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.2,
  },
  onlineText: {
    fontSize: 13,
    color: "#00FF7F",
    fontWeight: "600",
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
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#141414",
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s ease",
    }),
  },
  reactionCount: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
  },
  reactionCountActive: {
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
  postMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  postMenuContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    borderWidth: 1,
    borderColor: "#333",
    elevation: 10,
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
  },
  postMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  postMenuText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  postMenuTextDanger: {
    color: "#FF4444",
  },
  trendingSection: {
    marginBottom: 24,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  trendingSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  trendingTagsContainer: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  trendingTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#141414",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#2a2a2a",
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s",
    }),
  },
  trendingTagActive: {
    backgroundColor: "rgba(0, 255, 127, 0.15)",
    borderColor: "#00FF7F",
  },
  trendingTagText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    letterSpacing: 0.2,
  },
  trendingTagTextActive: {
    color: "#00FF7F",
    fontWeight: "700",
  },
  trendingTagCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    backgroundColor: "#0f0f0f",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  momentCard: {
    borderColor: "#FFB84D",
    borderWidth: 2,
    ...(Platform.OS === "web" && {
      boxShadow: "0 4px 20px rgba(255, 184, 77, 0.2)",
    }),
  },
  momentBadge: {
    backgroundColor: "#FFB84D",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 6,
  },
  momentBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0a0a0a",
    letterSpacing: 0.5,
  },
  postTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  postTag: {
    backgroundColor: "rgba(0, 255, 127, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 127, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s",
    }),
  },
  postTagText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00FF7F",
    letterSpacing: 0.3,
  },
  quickReplyContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  quickReplyButton: {
    flex: 1,
    backgroundColor: "rgba(0, 255, 127, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 127, 0.3)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s",
    }),
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00FF7F",
    letterSpacing: 0.2,
  },
});
