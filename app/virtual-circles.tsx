import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoIcon, Sparkles, Users, MessageCircle, ArrowLeft, Globe } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function VirtualCirclesScreen() {
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
          <Text style={styles.headerTitle}>Virtual Circles</Text>
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
              <VideoIcon size={60} color="#10b981" />
            </View>
          </View>

          <Text style={styles.title}>Virtual Smoke Circles</Text>
          <Text style={styles.subtitle}>
            Join video chat rooms and smoke together with friends from anywhere in the world
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <VideoIcon size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Video Chat Rooms</Text>
                <Text style={styles.featureDescription}>
                  Join or create circles with up to 8 people at once
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Users size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Public & Private Circles</Text>
                <Text style={styles.featureDescription}>
                  Create invite-only sessions or join public smoke circles
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <MessageCircle size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Real-Time Chat</Text>
                <Text style={styles.featureDescription}>
                  Text chat alongside video for sharing links and jokes
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Globe size={28} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Global Sessions</Text>
                <Text style={styles.featureDescription}>
                  Connect with cannabis enthusiasts worldwide
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Virtual Smoke Circles will revolutionize how you connect with the community:
            </Text>
            <Text style={styles.bulletPoint}>• Host private sessions with close friends</Text>
            <Text style={styles.bulletPoint}>• Join public circles and meet new people</Text>
            <Text style={styles.bulletPoint}>• Share music and sync playlists in real-time</Text>
            <Text style={styles.bulletPoint}>• Play games and activities during sessions</Text>
            <Text style={styles.bulletPoint}>• Record and share memorable moments</Text>
          </View>

          <View style={styles.useCaseBox}>
            <Text style={styles.useCaseTitle}>Perfect For:</Text>
            <View style={styles.useCaseList}>
              <Text style={styles.useCaseItem}>🌍 Long-distance friendships</Text>
              <Text style={styles.useCaseItem}>🎮 Gaming sessions</Text>
              <Text style={styles.useCaseItem}>🎬 Watch parties</Text>
              <Text style={styles.useCaseItem}>🎵 Music listening sessions</Text>
              <Text style={styles.useCaseItem}>💭 Deep conversations</Text>
            </View>
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
    marginBottom: 20,
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
  useCaseBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 30,
  },
  useCaseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  useCaseList: {
    gap: 12,
  },
  useCaseItem: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
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
