// © 2025 Benjamin Hawk. All rights reserved.

import { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AgeCheck() {
  const router = useRouter();
  const [age, setAge] = useState('');

  const handleContinue = async () => {
    const ageNum = parseInt(age);
    if (isNaN(ageNum)) {
      return Alert.alert('Please enter a valid number');
    }

    if (ageNum >= 21) {
      try {
        // ✅ Save age persistently
        await AsyncStorage.setItem('userAge', ageNum.toString());

        router.replace('/swipe');
      } catch (err) {
        Alert.alert('Error saving age. Try again.');
        console.error(err);
      }
    } else {
      Alert.alert('Must be 21+ to use BlazeMates');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Enter your age</Text>
      <TextInput
        style={styles.input}
        placeholder="21+ only"
        keyboardType="numeric"
        value={age}
        onChangeText={setAge}
      />
      <Button title="Continue" color="#00FF7F" onPress={handleContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
    justifyContent: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
});
