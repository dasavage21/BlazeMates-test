import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sparkles } from 'lucide-react-native';

const CURRENT_VERSION = '1.2.0';
const VERSION_KEY = 'app_version_seen';

const UPDATES = [
  {
    title: 'Build System Fixed',
    description: 'Fixed deployment issues - the website now builds and deploys correctly to web.',
  },
  {
    title: 'Image Loading Improvements',
    description: 'All website icons and images now load properly across all platforms.',
  },
  {
    title: 'Enhanced Stability',
    description: 'Improved overall website stability and performance.',
  },
];

export function UpdateNotification() {
  const [visible, setVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkVersion();
  }, []);

  const checkVersion = async () => {
    try {
      const seenVersion = await AsyncStorage.getItem(VERSION_KEY);

      if (seenVersion !== CURRENT_VERSION) {
        setVisible(true);
      }
    } catch (error) {
      console.error('Error checking version:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleClose = async () => {
    try {
      await AsyncStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      setVisible(false);

      if (Platform.OS === 'web') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving version:', error);
      setVisible(false);
    }
  };

  if (isChecking || !visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Sparkles size={32} color="#10b981" strokeWidth={2.5} />
            </View>
            <Text style={styles.title}>What's New</Text>
            <Text style={styles.version}>Version {CURRENT_VERSION}</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {UPDATES.map((update, index) => (
              <View key={index} style={styles.updateItem}>
                <View style={styles.bullet} />
                <View style={styles.updateText}>
                  <Text style={styles.updateTitle}>{update.title}</Text>
                  <Text style={styles.updateDescription}>{update.description}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.button}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Got it, Reload website</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10b98120',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: '#888',
  },
  content: {
    padding: 20,
    maxHeight: 300,
  },
  updateItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 12,
    marginTop: 6,
  },
  updateText: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  updateDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#10b981',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
