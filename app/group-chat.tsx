// © 2025 Benjamin Hawk. All rights reserved.

import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../supabaseClient";

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

export default function GroupChatScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId || !groupId) {
          setLoading(false);
          return;
        }
        setCurrentUserId(userId);

        const { data: groupData } = await supabase
          .from("group_chats")
          .select("name")
          .eq("id", groupId)
          .single();

        if (groupData) {
          setGroupName(groupData.name);
        }

        const { data: messagesData, error } = await supabase
          .from("group_messages")
          .select(`
            id,
            sender_id,
            content,
            created_at,
            users!group_messages_sender_id_fkey(name)
          `)
          .eq("group_id", groupId)
          .order("created_at", { ascending: true })
          .limit(100);

        if (!error && messagesData) {
          const formattedMessages = messagesData.map((msg: any) => ({
            id: msg.id,
            sender_id: msg.sender_id,
            sender_name: msg.users?.name || "Unknown",
            content: msg.content,
            created_at: msg.created_at,
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Error loading group chat:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;
          const { data: userData } = await supabase
            .from("users")
            .select("name")
            .eq("id", newMessage.sender_id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              id: newMessage.id,
              sender_id: newMessage.sender_id,
              sender_name: userData?.name || "Unknown",
              content: newMessage.content,
              created_at: newMessage.created_at,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [groupId]);

  const handleSend = async () => {
    if (!input.trim() || sending || !currentUserId || !groupId) return;

    setSending(true);
    const messageText = input.trim();
    setInput("");

    try {
      const { error } = await supabase.from("group_messages").insert({
        group_id: groupId as string,
        sender_id: currentUserId,
        content: messageText,
      });

      if (error) {
        console.error("Error sending message:", error);
        setInput(messageText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setInput(messageText);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FF7F" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{groupName}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isOwnMessage = item.sender_id === currentUserId;
          return (
            <View
              style={[
                styles.messageContainer,
                isOwnMessage ? styles.ownMessage : styles.otherMessage,
              ]}
            >
              {!isOwnMessage && (
                <Text style={styles.senderName}>{item.sender_name}</Text>
              )}
              <View
                style={[
                  styles.messageBubble,
                  isOwnMessage ? styles.ownBubble : styles.otherBubble,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>{item.content}</Text>
              </View>
              <Text style={styles.messageTime}>
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#888"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendButtonText}>{sending ? "..." : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#242424",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    gap: 16,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    color: "#aaa",
    fontSize: 16,
    textAlign: "center",
  },
  messageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: "75%",
  },
  ownMessage: {
    alignSelf: "flex-end",
  },
  otherMessage: {
    alignSelf: "flex-start",
  },
  senderName: {
    color: "#00FF7F",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  ownBubble: {
    backgroundColor: "#00FF7F",
  },
  otherBubble: {
    backgroundColor: "#2a2a2a",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: "#121212",
  },
  otherMessageText: {
    color: "#ffffff",
  },
  messageTime: {
    color: "#888",
    fontSize: 11,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#242424",
    borderTopWidth: 1,
    borderTopColor: "#333",
    gap: 12,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#333",
  },
  sendButton: {
    backgroundColor: "#00FF7F",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 16,
  },
});
