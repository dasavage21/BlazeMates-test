// © 2025 Benjamin Hawk. All rights reserved.

import { View, Text, FlatList, TextInput, Button, StyleSheet } from 'react-native';
import { useState } from 'react';

const dummyMessages = [
  { id: '1', sender: 'Hannah', text: 'Hey, what’s up?' },
  { id: '2', sender: 'You', text: 'Not much, just chillin. You?' },
  { id: '3', sender: 'Hannah', text: 'Same here 😎' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState(dummyMessages);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      sender: 'You',
      text: input.trim(),
    };
    setMessages([...messages, newMessage]);
    setInput('');
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.message, item.sender === 'You' ? styles.you : styles.them]}>
            <Text style={styles.sender}>{item.sender}:</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        )}
        style={styles.list}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          value={input}
          onChangeText={setInput}
        />
        <Button title="Send" color="#00FF7F" onPress={sendMessage} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 10 },
  list: { flex: 1, marginBottom: 10 },
  message: { padding: 10, borderRadius: 10, marginVertical: 4, maxWidth: '32%' },
  them: { backgroundColor: '#1e1e1e', alignSelf: 'flex-start' },
  you: { backgroundColor: '#00FF7F', alignSelf: 'flex-end' },
  sender: { fontWeight: 'bold', color: '#fff' },
  text: { color: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    color: '#fff',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
  },
});
