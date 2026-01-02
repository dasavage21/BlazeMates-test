// Ac 2025 Benjamin Hawk. All rights reserved.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../supabaseClient";
import { showChatNotification, requestNotificationPermission } from "../lib/notificationHelper";
import { updateUserActivity } from "../lib/activityTracker";

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type TypingMap = Record<string, boolean>;

type ActiveUser = {
  user_id: string;
  last_seen: string;
  display_name?: string | null;
};

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ threadId?: string | string[] }>();
  const rawThread = params.threadId;
  const threadId = useMemo(() => {
    if (!rawThread) return "global-chat";
    if (Array.isArray(rawThread)) return rawThread[0] ?? "global-chat";
    return rawThread;
  }, [rawThread]);

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [threadReady, setThreadReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<TypingMap>({});
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [otherUserName, setOtherUserName] = useState<string | null>(null);
  const [userImages, setUserImages] = useState<Record<string, string>>({});
  const [isBlocked, setIsBlocked] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  const listRef = useRef<FlatList<Message>>(null);

  const formatInitials = useCallback((raw?: string | null) => {
    if (!raw) return "??";
    const cleaned = raw.trim();
    if (!cleaned) return "??";
    const tokens = cleaned
      .replace(/[^A-Za-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length >= 2) {
      return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
    }
    const fallback = cleaned.replace(/[^A-Za-z0-9]/g, "");
    if (fallback.length >= 2) return fallback.slice(0, 2).toUpperCase();
    if (fallback.length === 1) return `${fallback}${fallback}`.toUpperCase();
    return "??";
  }, []);

  // Load the signed-in user and request notification permission
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setUserId(data?.user?.id ?? null);
        }

        await requestNotificationPermission();
        updateUserActivity();
      } catch (error) {
        console.warn("Failed to load auth user", error);
        if (!cancelled) setUserId(null);
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load other user's name if this is a DM
  useEffect(() => {
    let cancelled = false;
    if (!userId || !threadId.startsWith("dm_")) {
      setOtherUserName(null);
      setOtherUserId(null);
      return;
    }

    (async () => {
      try {
        const parts = threadId.split("_");
        if (parts.length !== 3) return;

        const otherUser = parts[1] === userId ? parts[2] : parts[1];
        if (!cancelled) {
          setOtherUserId(otherUser);
        }

        const { data, error } = await supabase
          .from("users")
          .select("name")
          .eq("id", otherUser)
          .maybeSingle();

        if (!cancelled && !error && data) {
          setOtherUserName(data.name || "User");
        }
      } catch (error) {
        console.warn("Failed to load other user name", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, threadId]);

  // Check if user is blocked
  useEffect(() => {
    let cancelled = false;
    if (!userId || !otherUserId) {
      setIsBlocked(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("blocks")
          .select("id")
          .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`)
          .maybeSingle();

        if (!cancelled) {
          setIsBlocked(!!data);
        }
      } catch (error) {
        console.warn("Failed to check block status", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, otherUserId]);

  // Ensure the thread exists
  useEffect(() => {
    let cancelled = false;
    if (loadingUser) return;
    if (!userId) {
      setThreadReady(false);
      return;
    }
    setThreadReady(false);
    (async () => {
      try {
        await supabase
          .from("threads")
          .upsert({ id: threadId }, { onConflict: "id" });
        if (!cancelled) setThreadReady(true);
      } catch (error) {
        console.warn("Failed to ensure thread", error);
        if (!cancelled) {
          setThreadReady(false);
          Alert.alert(
            "Chat unavailable",
            "We couldn't open this chat. Please try again."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, loadingUser, userId]);

  // Initial message load + realtime inserts
  useEffect(() => {
    if (!threadReady) return;
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (!error && active) setMessages(data ?? []);
    })();

    const channel = supabase
      .channel(`messages-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);

          if (newMessage.sender_id !== userId) {
            const senderName = otherUserName || "Someone";
            showChatNotification(senderName, newMessage.content);
          }
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`threads-${threadId}-typing`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "threads",
          filter: `id=eq.${threadId}`,
        },
        (payload) => {
          const map = (payload.new as { typing?: TypingMap }).typing ?? {};
          setTypingUsers(map);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [threadId, threadReady]);

  // Fetch user images for message senders
  useEffect(() => {
    if (messages.length === 0) return;

    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const fetchUserImages = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, image_url")
          .in("id", senderIds);

        if (!error && data) {
          const imageMap: Record<string, string> = {};
          data.forEach((user) => {
            if (user.image_url) {
              imageMap[user.id] = user.image_url;
            }
          });
          setUserImages(imageMap);
        }
      } catch (error) {
        console.warn("Failed to fetch user images", error);
      }
    };

    void fetchUserImages();
  }, [messages]);

  // Read receipts
  useEffect(() => {
    if (!threadReady) return;
    let cancelled = false;

    const toMap = (
      rows: { user_id: string; read_at: string | null }[] | null | undefined
    ) => {
      const map: Record<string, string> = {};
      (rows ?? []).forEach(({ user_id, read_at }) => {
        if (user_id && read_at) map[user_id] = read_at;
      });
      return map;
    };

    const loadReceipts = async () => {
      try {
        const { data, error } = await supabase
          .from("read_receipts")
          .select("user_id, read_at")
          .eq("thread_id", threadId);
        if (!cancelled && !error) {
          setReadReceipts(toMap(data));
        }
      } catch {
        // ignore read receipt fetch errors
      }
    };

    void loadReceipts();

    const channel = supabase
      .channel(`read-receipts-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "read_receipts",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const eventType = (payload as { eventType?: string }).eventType;
          const record =
            (payload.new as { user_id?: string; read_at?: string }) ??
            (payload.old as { user_id?: string; read_at?: string }) ??
            null;
          if (!record?.user_id) return;
          if (eventType === "DELETE") {
            setReadReceipts((prev) => {
              const next = { ...prev };
              delete next[record.user_id as string];
              return next;
            });
            return;
          }
          if (record.read_at) {
            setReadReceipts((prev) => ({
              ...prev,
              [record.user_id as string]: record.read_at as string,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [threadId, threadReady]);

  // Active user list
  useEffect(() => {
    let cancelled = false;

    const normalizeTimestamp = (value: unknown) => {
      if (!value) return new Date().toISOString();
      if (typeof value === "string") {
        const date = new Date(value);
        return Number.isFinite(date.getTime())
          ? date.toISOString()
          : new Date().toISOString();
      }
      if (value instanceof Date) {
        return Number.isFinite(value.getTime())
          ? value.toISOString()
          : new Date().toISOString();
      }
      const date = new Date(value as number);
      return Number.isFinite(date.getTime())
        ? date.toISOString()
        : new Date().toISOString();
    };

    const mapActive = (rows: any[] | null | undefined): ActiveUser[] => {
      const dedup = new Map<string, ActiveUser>();

      (rows ?? []).forEach((row) => {
        const profile =
          row.profile ?? row.profiles ?? row.account ?? row.user ?? null;
        const resolvedId =
          row.user_id ??
          row.id ??
          row.uid ??
          row.user ??
          row.sender_id ??
          profile?.id ??
          undefined;

        if (!resolvedId) return;

        const rawSeen =
          row.last_seen ??
          row.last_active_at ??
          row.updated_at ??
          row.seen_at ??
          row.last_event_at ??
          row.activity_at ??
          row.created_at ??
          row.inserted_at ??
          new Date().toISOString();

        const activeRecord: ActiveUser = {
          user_id: resolvedId,
          last_seen: normalizeTimestamp(rawSeen),
          display_name:
            row.display_name ??
            row.username ??
            row.name ??
            profile?.display_name ??
            profile?.username ??
            profile?.name ??
            null,
        };

        const existing = dedup.get(resolvedId);
        if (!existing) {
          dedup.set(resolvedId, activeRecord);
          return;
        }

        if (
          new Date(activeRecord.last_seen).getTime() >
          new Date(existing.last_seen).getTime()
        ) {
          dedup.set(resolvedId, activeRecord);
        }
      });

      return Array.from(dedup.values());
    };

    const fetchFromRelation = async (relation: string) => {
      const { data, error } = await supabase
        .from(relation)
        .select("*")
        .limit(10);
      if (error) throw error;
      return mapActive(data);
    };

    const fetchFromUserSessions = async () => {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .order("last_seen", { ascending: false, nullsFirst: false })
        .limit(10);
      if (error) throw error;
      return mapActive(data);
    };

    const fetchFromMessages = async () => {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      let query = supabase
        .from("messages")
        .select("sender_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(120);

      if (threadId) {
        query = query.eq("thread_id", threadId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = mapActive(
        (data ?? []).map((row) => ({
          sender_id: row.sender_id,
          created_at: row.created_at,
        }))
      );

      if (mapped.length === 0) return mapped;

      const ids = mapped.map((item) => item.user_id);
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, full_name")
          .in("id", ids);

        if (profiles) {
          const lookup = new Map(
            profiles.map((profile) => [
              profile.id,
              profile.display_name ??
                profile.username ??
                profile.full_name ??
                null,
            ])
          );
          mapped.forEach((item) => {
            const displayName = lookup.get(item.user_id);
            if (displayName) {
              item.display_name = displayName;
            }
          });
        }
      } catch {
        // profiles table might not exist; ignore
      }

      return mapped.slice(0, 10);
    };

    const refreshActiveUsers = async () => {
      const loaders: (() => Promise<ActiveUser[]>)[] = [
        () => fetchFromRelation("active_users_15m"),
        () => fetchFromRelation("active_users"),
        () => fetchFromRelation("active_users_view"),
        () => fetchFromRelation("active_users_1h"),
        () => fetchFromRelation("active_users_15m_count"),
        fetchFromUserSessions,
        fetchFromMessages,
      ];

      for (const load of loaders) {
        if (cancelled) return;
        try {
          const result = await load();
          if (cancelled) return;
          setActiveUsers(result);
          return;
        } catch {
          // Try the next available source
        }
      }

      if (!cancelled) {
        setActiveUsers([]);
      }
    };

    void refreshActiveUsers();
    const intervalId = setInterval(refreshActiveUsers, 60_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [threadId]);

  const otherTyping = useMemo(
    () =>
      Object.entries(typingUsers).some(
        ([id, isTyping]) => id !== userId && isTyping
      ),
    [typingUsers, userId]
  );

  const activePreview = useMemo(() => activeUsers.slice(0, 3), [activeUsers]);
  const activeOverflow = Math.max(activeUsers.length - activePreview.length, 0);
  const activeSummary = activeUsers.length
    ? `${activeUsers.length} active in last 15 minutes`
    : "Nobody active recently";

  const postHeartbeat = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.functions.invoke(
        "idle-logout/heartbeat",
        {
          body: { room_id: threadId },
        }
      );
      if (error) {
        console.warn("Heartbeat invoke failed", error.message, error.status);
      }
      void data;
    } catch (error) {
      console.warn("Failed to post idle heartbeat", error);
    }
  }, [threadId, userId]);

  // Mark this thread as read for the current user
  useEffect(() => {
    if (!threadReady || !userId) return;
    void (async () => {
      try {
        await supabase
          .from("read_receipts")
          .upsert(
            [
              {
                thread_id: threadId,
                user_id: userId,
                read_at: new Date().toISOString(),
              },
            ],
            { onConflict: "thread_id,user_id" }
          );
      } catch {
        // best effort
      }
    })();
  }, [threadId, threadReady, userId, messages]);

  useEffect(() => {
    if (!threadReady || !userId) return;
    let cancelled = false;

    const beat = async () => {
      if (cancelled) return;
      await postHeartbeat();
    };

    void beat();
    const intervalId = setInterval(() => {
      void beat();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [postHeartbeat, threadReady, userId]);

  const updateTyping = useCallback(
    async (isTyping: boolean) => {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from("threads")
          .select("typing")
          .eq("id", threadId)
          .maybeSingle();
        const updated = { ...(data?.typing ?? {}), [userId]: isTyping };
        await supabase
          .from("threads")
          .update({ typing: updated })
          .eq("id", threadId);
      } catch {
        /* no-op */
      }
    },
    [threadId, userId]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || text.length === 0) return;
    if (text.length > 2000) {
      Alert.alert("Message too long", "Messages must be 2000 characters or less.");
      return;
    }
    if (!userId) {
      Alert.alert("Sign in required", "Sign in before sending messages.");
      return;
    }

    if (isBlocked) {
      Alert.alert("Cannot send message", "You cannot message this user.");
      return;
    }

    const { error } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: userId,
        content: text,
      });

    if (error) {
      console.error("Failed to send message:", error);
      Alert.alert("Error", `Failed to send message: ${error.message}`);
      return;
    }

    setInput("");
    await updateTyping(false);
    await postHeartbeat();
  }, [input, postHeartbeat, threadId, updateTyping, userId, isBlocked]);

  const handleBlock = useCallback(async () => {
    if (!userId || !otherUserId) {
      console.log("Cannot block: missing userId or otherUserId", { userId, otherUserId });
      return;
    }

    const confirmBlock = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to block ${otherUserName || "this user"}? You won't be able to message each other.`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Block User",
            `Are you sure you want to block ${otherUserName || "this user"}? You won't be able to message each other.`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Block", style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmBlock) return;

    try {
      const { error } = await supabase
        .from("blocks")
        .insert({
          blocker_id: userId,
          blocked_id: otherUserId,
        });

      if (error) {
        console.error("Block error:", error);
        if (Platform.OS === 'web') {
          window.alert("Failed to block user. Please try again.");
        } else {
          Alert.alert("Error", "Failed to block user. Please try again.");
        }
        return;
      }

      setIsBlocked(true);
      if (Platform.OS === 'web') {
        window.alert("You have blocked this user.");
      } else {
        Alert.alert("User Blocked", "You have blocked this user.");
      }
    } catch (error) {
      console.error("Failed to block user:", error);
      if (Platform.OS === 'web') {
        window.alert("Something went wrong. Please try again.");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    }
  }, [userId, otherUserId, otherUserName]);

  const handleReport = useCallback(async () => {
    if (!userId || !otherUserId) {
      console.log("Cannot report: missing userId or otherUserId", { userId, otherUserId });
      return;
    }

    let reason: string | null = null;

    if (Platform.OS === 'web') {
      const choice = window.prompt(
        "Why are you reporting this user?\n\n1 - Harassment\n2 - Spam\n3 - Inappropriate Content\n\nEnter the number (1-3):"
      );

      if (!choice) return;

      if (choice === '1') reason = 'harassment';
      else if (choice === '2') reason = 'spam';
      else if (choice === '3') reason = 'inappropriate_content';
      else {
        window.alert("Invalid choice. Please try again.");
        return;
      }
    } else {
      reason = await new Promise<string | null>((resolve) => {
        Alert.alert(
          "Report User",
          "Why are you reporting this user?",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
            { text: "Harassment", onPress: () => resolve("harassment") },
            { text: "Spam", onPress: () => resolve("spam") },
            { text: "Inappropriate Content", onPress: () => resolve("inappropriate_content") },
          ]
        );
      });
    }

    if (!reason) return;

    try {
      const { data: reportData, error } = await supabase
        .from("reports")
        .insert({
          reporter_id: userId,
          reported_id: otherUserId,
          reason: reason,
          context: `Reported from chat thread: ${threadId}`,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error("Report error:", error);
        if (Platform.OS === 'web') {
          window.alert("Failed to submit report. Please try again.");
        } else {
          Alert.alert("Error", "Failed to submit report. Please try again.");
        }
        return;
      }

      if (reportData) {
        try {
          const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-admin-report`;
          const { data: { session } } = await supabase.auth.getSession();

          await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              report_id: reportData.id,
              reporter_id: userId,
              reported_id: otherUserId,
              reason: reason,
              context: `Reported from chat thread: ${threadId}`,
            }),
          });
        } catch (notifyError) {
          console.warn("Failed to send admin notification:", notifyError);
        }
      }

      if (Platform.OS === 'web') {
        window.alert("Thank you for helping keep BlazeMates safe.");
      } else {
        Alert.alert("Report Submitted", "Thank you for helping keep BlazeMates safe.");
      }
    } catch (error) {
      console.error("Failed to report user:", error);
      if (Platform.OS === 'web') {
        window.alert("Something went wrong. Please try again.");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    }
  }, [userId, otherUserId, threadId]);

  if (loadingUser) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.locked}>
          <Text style={styles.lockedText}>
            Sign in to start chatting with other BlazeMates.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!threadReady) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <View style={styles.wrapper}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>
              {otherUserName ? `Chat with ${otherUserName}` : "Messages"}
            </Text>
            {!otherUserName && (
              <Text style={styles.headerSubtitle}>{activeSummary}</Text>
            )}
          </View>
          {otherUserName && (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity onPress={handleReport} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>⚠️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBlock} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>🚫</Text>
              </TouchableOpacity>
            </View>
          )}
          {!otherUserName && (
            <View style={styles.badgeRow}>
              {activePreview.map((user) => (
                <View key={user.user_id} style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {formatInitials(user.display_name ?? user.user_id)}
                  </Text>
                </View>
              ))}
              {activeOverflow > 0 && (
                <View style={[styles.badge, styles.badgeOverflow]}>
                  <Text style={styles.badgeText}>+{activeOverflow}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.chatBody}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={80}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => {
              const isMe = item.sender_id === userId;
              const otherReaders = Object.entries(readReceipts).filter(
                ([id]) => id !== userId
              );
              const messageTime = new Date(item.created_at).getTime();
              const seenCount = otherReaders.filter(([, readAt]) => {
                if (!readAt) return false;
                const readTime = new Date(readAt).getTime();
                return Number.isFinite(readTime) && readTime >= messageTime;
              }).length;

              let receiptLabel: string | null = null;
              if (isMe) {
                if (seenCount > 0) {
                  receiptLabel =
                    otherReaders.length > 1
                      ? `Seen by ${seenCount}`
                      : "Seen";
                } else if (otherReaders.length > 0) {
                  receiptLabel = "Delivered";
                }
              }

              const senderImage = userImages[item.sender_id];

              return (
                <View
                  style={[
                    styles.messageRow,
                    isMe ? styles.rowReverse : styles.rowForward,
                  ]}
                >
                  {!isMe && (
                    <View style={styles.avatar}>
                      {senderImage ? (
                        <Image
                          source={{ uri: senderImage }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {formatInitials(item.sender_id)}
                        </Text>
                      )}
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.you : styles.them,
                    ]}
                  >
                    <Text
                      style={[
                        styles.text,
                        isMe ? styles.textSelf : styles.textOther,
                      ]}
                    >
                      {item.content}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text
                        style={[
                          styles.meta,
                          isMe ? styles.metaSelf : styles.metaOther,
                        ]}
                      >
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                      {isMe && receiptLabel && (
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptDot}>✓</Text>
                          <Text style={styles.receiptText}>{receiptLabel}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Start the conversation by sending the first message.
              </Text>
            }
          />

          {otherTyping && <Text style={styles.typing}>Typing...</Text>}

          <View style={styles.inputContainer}>
            <TextInput
              value={input}
              onChangeText={(text) => {
                setInput(text);
                updateTyping(!!text);
              }}
              placeholder="Type a message..."
              placeholderTextColor="#888"
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#121212" },
  wrapper: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  backBtnText: {
    color: "#00FF7F",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerTextGroup: { flexShrink: 1, flex: 1 },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#9e9e9e",
    marginTop: 4,
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  badgeOverflow: {
    backgroundColor: "rgba(0, 255, 127, 0.15)",
    borderColor: "#00FF7F",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  actionButtonText: {
    fontSize: 18,
  },
  chatBody: { flex: 1 },
  messageList: { paddingBottom: 12, paddingTop: 8 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 4,
  },
  rowForward: { justifyContent: "flex-start" },
  rowReverse: { justifyContent: "flex-end" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "80%",
  },
  them: { backgroundColor: "#1e1e1e" },
  you: { backgroundColor: "#00FF7F" },
  text: { fontSize: 15, lineHeight: 20 },
  textOther: { color: "#fff" },
  textSelf: { color: "#121212" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 6,
  },
  meta: { fontSize: 10 },
  metaOther: { color: "#b5b5b5" },
  metaSelf: { color: "#121212", opacity: 0.7 },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 18, 18, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  receiptDot: { color: "#121212", fontSize: 10, marginRight: 4 },
  receiptText: { color: "#121212", fontSize: 10, fontWeight: "600" },
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#f2f2f2",
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#00FF7F",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: {
    color: "#121212",
    fontWeight: "bold",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  locked: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#121212",
  },
  lockedText: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
  },
  typing: {
    color: "#00FF7F",
    marginBottom: 4,
    textAlign: "center",
  },
  empty: {
    color: "#888",
    textAlign: "center",
    marginVertical: 16,
  },
});
