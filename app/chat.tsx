// © 2025 Benjamin Hawk. All rights reserved.

import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import uuid from 'react-native-uuid';
import { SafeAreaView } from 'react-native-safe-area-context';

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type TypingMap = { [key: string]: boolean };

const ChatScreen = ({ threadId, userId }: { threadId: string; userId: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingMap>({});
  const listRef = useRef<FlatList>(null);

  // 🟢 Load and subscribe to new messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages-${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);

      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  // 💬 Typing indicator
  useEffect(() => {
    const channel = supabase
      .channel(`typing-${threadId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_threads',
        filter: `id=eq.${threadId}`,
      }, payload => {
        const typingMap = payload.new.typing || {};
        setTypingUsers(typingMap);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  const otherTyping = Object.entries(typingUsers).some(
    ([id, isTyping]) => id !== userId && isTyping
  );

  // 🟡 Update read receipts
  useEffect(() => {
    const updateRead = async () => {
      await supabase
        .from('read_receipts')
        .upsert(
          [{ thread_id: threadId, user_id: userId, read_at: new Date().toISOString() }],
          { onConflict: 'thread_id,user_id' }
        );
    };
    updateRead();
  }, [threadId, userId]);

  // 🟢 Send message
  const sendMessage = async () => {
    if (!input.trim()) return;

    await supabase.from('messages').insert([
      {
        id: uuid.v4(),
        thread_id: threadId,
        sender_id: userId,
        content: input.trim(),
        created_at: new Date().toISOString(),
      }
    ]);

    setInput('');
    await updateTyping(false);
  };

  // 🟡 Typing status update
  const updateTyping = async (isTyping: boolean) => {
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('typing')
      .eq('id', threadId)
      .single();

    const updatedTyping = {
      ...(thread?.typing || {}),
      [userId]: isTyping,
    };

    await supabase
      .from('chat_threads')
      .update({ typing: updatedTyping })
      .eq('id', threadId);
  };

  return (
  <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
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
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {otherTyping && (
        <Text style={{ color: '#00FF7F', marginBottom: 4 }}>💬 Typing…</Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={(text) => {
            setInput(text);
            updateTyping(!!text);
          }}
          placeholder="Type a message..."
          placeholderTextColor="#888"
          style={styles.input}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 10 },
  message: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 4,
    maxWidth: '70%',
  },
  them: {
    backgroundColor: '#1e1e1e',
    alignSelf: 'flex-start',
  },
  you: {
    backgroundColor: '#00FF7F',
    alignSelf: 'flex-end',
  },
  text: {
    color: '#fff',
  },
  meta: {
    fontSize: 10,
    color: '#aaa',
    marginTop: 4,
  },
  inputRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 10,
  paddingBottom: Platform.OS === 'android' ? 10 : 0,
  backgroundColor: '#121212',
  paddingHorizontal: 10,
},

  input: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    color: '#fff',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  sendBtn: {
    backgroundColor: '#00FF7F',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  sendText: {
    color: '#000',
    fontWeight: 'bold',
  },
});

export default ChatScreen;
