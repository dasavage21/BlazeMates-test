// © 2025 Benjamin Hawk. All rights reserved.

import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
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

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type TypingMap = Record<string, boolean>;

export default function ChatScreen() {
  // /chat?threadId=...&userId=...
  const params = useLocalSearchParams<{
    threadId?: string | string[];
  }>();
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
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setUserId(data?.user?.id ?? null);
        }
      } catch (e) {
        console.warn("Failed to load auth user", e);
        if (!cancelled) setUserId(null);
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ensure thread exists once we know the user
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
      } catch (e) {
        console.warn("Failed to ensure thread", e);
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

  // Initial load + realtime inserts
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
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [threadId, threadReady]);

  // Typing indicator subscription
  useEffect(() => {
    if (!threadReady) return;
    const channel = supabase
      .channel(`typing-${threadId}`)
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
      supabase.removeChannel(channel);
    };
  }, [threadId, threadReady]);

  const otherTyping = useMemo(
    () =>
      Object.entries(typingUsers).some(
        ([id, isTyping]) => id !== userId && isTyping
      ),
    [typingUsers, userId]
  );

  // Mark read
  useEffect(() => {
    if (!threadReady || !userId) return;
    (async () => {
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
            {
              onConflict: "thread_id,user_id",
            }
          );
      } catch {
        /* no-op */
      }
    })();
  }, [threadId, threadReady, userId]);

  const updateTyping = async (isTyping: boolean) => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("threads")
        .select("typing")
        .eq("id", threadId)
        .single();
      const updated = { ...(data?.typing ?? {}), [userId]: isTyping };
      await supabase
        .from("threads")
        .update({ typing: updated })
        .eq("id", threadId);
    } catch {
      /* no-op */
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (!userId) {
      Alert.alert("Sign in required", "Sign in before sending messages.");
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: userId,
        content: text,
        // created_at can be DEFAULT now() in the DB; omit it here if so
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]); // optimistic update with server id
    }
    setInput("");
    await updateTyping(false);
  };

  if (loadingUser) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
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
      <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMe = item.sender_id === userId;
            return (
              <View style={[styles.message, isMe ? styles.you : styles.them]}>
                <Text style={styles.text}>{item.content}</Text>
                <Text style={styles.meta}>
                  {new Date(item.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
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

        {otherTyping && (
          <Text style={styles.typing}>💬 Typing…</Text>
        )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 10 },
  message: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 4,
    maxWidth: "70%",
  },
  them: { backgroundColor: "#1e1e1e", alignSelf: "flex-start" },
  you: { backgroundColor: "#00FF7F", alignSelf: "flex-end" },
  text: { color: "#fff" },
  meta: { fontSize: 10, color: "#aaa", marginTop: 4 },
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

