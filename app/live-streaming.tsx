import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Video, Sparkles, Users, Eye, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LiveStreamingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#0a0a0a']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Streaming</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.comingSoonBadge}>
            <Sparkles size={20} color="#FFD700" />
            <Text style={styles.comingSoonText}>COMING SOON</Text>
            <Sparkles size={20} color="#FFD700" />
          </View>

          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Video size={60} color="#10b981" />
            </View>
          </View>

          <Text style={styles.title}>Live Stream Your Sessions</Text>
          <Text style={styles.subtitle}>
            Share your smoke sessions and grow updates in real-time with the community
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Video size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>HD Live Streaming</Text>
                <Text style={styles.featureDescription}>
                  Broadcast your sessions in high quality with real-time chat
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Users size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Interactive Chat</Text>
                <Text style={styles.featureDescription}>
                  Engage with viewers through live comments and reactions
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Eye size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Grow Updates</Text>
                <Text style={styles.featureDescription}>
                  Share your cultivation progress and get advice from experts
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Sparkles size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Scheduled Streams</Text>
                <Text style={styles.featureDescription}>
                  Plan your streams and notify followers in advance
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              We're working hard to bring you live streaming capabilities. Soon you'll be able to:
            </Text>
            <Text style={styles.bulletPoint}>• Stream smoke sessions with friends</Text>
            <Text style={styles.bulletPoint}>• Share grow room tours and updates</Text>
            <Text style={styles.bulletPoint}>• Host Q&A sessions with the community</Text>
            <Text style={styles.bulletPoint}>• Earn points and rewards for engaging streams</Text>
          </View>

          <TouchableOpacity style={styles.notifyButton} disabled>
            <Text style={styles.notifyButtonText}>Get Notified When Available</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignSelf: 'center',
    marginBottom: 30,
  },
  comingSoonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  featuresContainer: {
    gap: 16,
    marginBottom: 30,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 30,
  },
  infoText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#10b981',
    lineHeight: 24,
  },
  notifyButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  notifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
});
