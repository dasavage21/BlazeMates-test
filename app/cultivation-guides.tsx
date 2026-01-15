import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Lock, BookOpen, Leaf } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';

interface CultivationGuide {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  created_at: string;
  is_pro_only: boolean;
}

export default function CultivationGuides() {
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState<CultivationGuide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<CultivationGuide | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    try {
      setLoading(true);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.replace('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier, subscription_status')
        .eq('id', authUser.id)
        .maybeSingle();

      const userIsPro = userData?.subscription_tier === 'pro' && userData?.subscription_status === 'active';
      setIsPro(userIsPro);

      const { data: guidesData, error } = await supabase
        .from('cultivation_guides')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading guides:', error);
        Alert.alert('Error', 'Failed to load cultivation guides');
        return;
      }

      setGuides(guidesData || []);
    } catch (error) {
      console.error('Error loading guides:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGuidePress = (guide: CultivationGuide) => {
    if (guide.is_pro_only && !isPro) {
      Alert.alert(
        'Pro Feature',
        'This is an exclusive Blaze Pro cultivation guide. Upgrade to unlock!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: () => router.push('/subscription') }
        ]
      );
      return;
    }
    setSelectedGuide(guide);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      case 'strain-specific': return '#9C27B0';
      case 'harvesting': return '#FFD700';
      case 'troubleshooting': return '#2196F3';
      default: return '#888';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'beginner': return '🌱';
      case 'intermediate': return '🌿';
      case 'advanced': return '🔥';
      case 'strain-specific': return '🧬';
      case 'harvesting': return '✂️';
      case 'troubleshooting': return '🔧';
      default: return '📚';
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#1a5f1a', '#2d7a2d', '#4CAF50']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cultivation Guides</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </LinearGradient>
    );
  }

  if (selectedGuide) {
    return (
      <LinearGradient colors={['#1a5f1a', '#2d7a2d', '#4CAF50']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedGuide(null)} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guide</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.guideDetailCard}>
            <View style={styles.guideDetailHeader}>
              <View style={styles.categoryBadgeRow}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(selectedGuide.category) }]}>
                  <Text style={styles.categoryEmoji}>{getCategoryIcon(selectedGuide.category)}</Text>
                  <Text style={styles.categoryText}>{selectedGuide.category.toUpperCase()}</Text>
                </View>
                {selectedGuide.is_pro_only && (
                  <View style={styles.proBadgeSmall}>
                    <Text style={styles.proBadgeSmallText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.guideTitle}>{selectedGuide.title}</Text>
            </View>
            <Text style={styles.guideContent}>{selectedGuide.content}</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a5f1a', '#2d7a2d', '#4CAF50']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cultivation Guides</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isPro && (
          <View style={styles.proBanner}>
            <Leaf size={20} color="#333" />
            <Text style={styles.proBannerText}>You have access to all exclusive Pro guides!</Text>
          </View>
        )}

        {!isPro && (
          <View style={styles.upgradeBanner}>
            <Lock size={20} color="#FFD700" />
            <Text style={styles.upgradeBannerText}>
              Upgrade to Blaze Pro for exclusive cultivation guides
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/subscription')}
            >
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        {guides.length === 0 ? (
          <View style={styles.emptyState}>
            <BookOpen size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>No guides available yet</Text>
          </View>
        ) : (
          guides.map((guide) => (
            <TouchableOpacity
              key={guide.id}
              style={styles.guideCard}
              onPress={() => handleGuidePress(guide)}
            >
              <View style={styles.guideCardHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(guide.category) }]}>
                  <Text style={styles.categoryEmoji}>{getCategoryIcon(guide.category)}</Text>
                  <Text style={styles.categoryText}>{guide.category.toUpperCase()}</Text>
                </View>
                {guide.is_pro_only && (
                  <View style={styles.lockBadge}>
                    <Lock size={14} color="#FFD700" />
                    <Text style={styles.lockBadgeText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.guideCardTitle}>{guide.title}</Text>
              <Text style={styles.guideCardPreview} numberOfLines={2}>
                {guide.content}
              </Text>
              <View style={styles.readMore}>
                <Text style={styles.readMoreText}>Read More →</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            New guides are added regularly. Check back often!
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  proBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  upgradeBanner: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  upgradeBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  upgradeButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 16,
  },
  guideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
  },
  guideCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  guideCardPreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  readMore: {
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  guideDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  guideDetailHeader: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#f0f0f0',
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  proBadgeSmall: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proBadgeSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  guideTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  guideContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
});
