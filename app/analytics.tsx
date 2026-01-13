import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Eye, Heart, TrendingUp, Zap, BarChart3, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';

interface AnalyticsData {
  totalProfileViews: number;
  totalLikesReceived: number;
  totalLikesSent: number;
  totalSwipes: number;
  swipeThroughRate: number;
  matchLikelihoodScore: number;
  viewsLast7Days: number;
  likesLast7Days: number;
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const analyticsChannel = supabase
      .channel('analytics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_analytics',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
          filter: `liked_user_id=eq.${userId}`,
        },
        () => {
          loadAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profile_views',
          filter: `viewed_user_id=eq.${userId}`,
        },
        () => {
          loadAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(analyticsChannel);
    };
  }, [userId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.replace('/login');
        return;
      }

      if (!userId) {
        setUserId(authUser.id);
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('subscription_tier, subscription_status')
        .eq('id', authUser.id)
        .maybeSingle();

      console.log('User subscription data:', userData);
      console.log('User error:', userError);

      if (!userData) {
        setError('Unable to load user data. Please try again.');
        setLoading(false);
        return;
      }

      if (userData.subscription_status !== 'active' ||
          userData.subscription_tier !== 'pro') {
        setError('Profile analytics is a Blaze Pro feature. Upgrade to unlock!');
        setLoading(false);
        return;
      }

      let analyticsData = await supabase
        .from('subscription_analytics')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      console.log('Analytics data fetch result:', analyticsData);

      if (!analyticsData.data) {
        console.log('No analytics data, creating new row...');
        const { error: insertError } = await supabase
          .from('subscription_analytics')
          .insert({
            user_id: authUser.id,
            swipe_through_rate: 0,
            match_likelihood_score: 0,
            total_swipes: 0,
            total_likes_sent: 0,
            total_likes_received: 0,
            total_profile_views: 0,
          });

        if (insertError) {
          console.error('Failed to create analytics row:', insertError);
          throw new Error('Failed to create analytics: ' + insertError.message);
        }

        analyticsData = await supabase
          .from('subscription_analytics')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        console.log('Analytics data after insert:', analyticsData);
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: viewsLast7Days, error: viewsError } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_user_id', authUser.id)
        .gte('viewed_at', sevenDaysAgo.toISOString());

      console.log('Views last 7 days:', viewsLast7Days, 'Error:', viewsError);

      const { count: likesLast7Days, error: likesError } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('liked_user_id', authUser.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      console.log('Likes last 7 days:', likesLast7Days, 'Error:', likesError);

      setAnalytics({
        totalProfileViews: analyticsData.data?.total_profile_views || 0,
        totalLikesReceived: analyticsData.data?.total_likes_received || 0,
        totalLikesSent: analyticsData.data?.total_likes_sent || 0,
        totalSwipes: analyticsData.data?.total_swipes || 0,
        swipeThroughRate: analyticsData.data?.swipe_through_rate || 0,
        matchLikelihoodScore: analyticsData.data?.match_likelihood_score || 0,
        viewsLast7Days: viewsLast7Days || 0,
        likesLast7Days: likesLast7Days || 0,
      });

      try {
        await supabase.rpc('update_profile_view_analytics');
      } catch (rpcErr) {
        console.error('Failed to update analytics:', rpcErr);
      }

    } catch (err) {
      console.error('Error loading analytics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#FF6B9D', '#FFA07A', '#FFD700']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </LinearGradient>
    );
  }

  if (error) {
    const isPremiumError = error.includes('Blaze Pro feature') || error.includes('Upgrade');
    return (
      <LinearGradient colors={['#FF6B9D', '#FFA07A', '#FFD700']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Text style={styles.errorEmoji}>📊</Text>
            <Text style={styles.errorTitle}>{error}</Text>
            {isPremiumError ? (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={loadAnalytics}
              >
                <Text style={styles.upgradeButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FF6B9D', '#FFA07A', '#FFD700']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.proBadge}>
          <Zap size={14} color="#333" />
          <Text style={styles.proBadgeText}>PRO FEATURE</Text>
        </View>

        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
              <Eye size={28} color="#2196F3" />
            </View>
            <Text style={styles.statValue}>{analytics?.viewsLast7Days || 0}</Text>
            <Text style={styles.statLabel}>Profile Views</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#FFE5EC' }]}>
              <Heart size={28} color="#FF4458" />
            </View>
            <Text style={styles.statValue}>{analytics?.likesLast7Days || 0}</Text>
            <Text style={styles.statLabel}>Likes Received</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>All Time Stats</Text>
        <View style={styles.statsColumn}>
          <View style={styles.statRow}>
            <View style={styles.statRowIcon}>
              <Eye size={18} color="#2196F3" />
            </View>
            <Text style={styles.statRowLabel}>Total Profile Views</Text>
            <Text style={styles.statRowValue}>{analytics?.totalProfileViews || 0}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statRowIcon}>
              <Heart size={18} color="#FF4458" />
            </View>
            <Text style={styles.statRowLabel}>Likes Received</Text>
            <Text style={styles.statRowValue}>{analytics?.totalLikesReceived || 0}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statRowIcon}>
              <Heart size={18} color="#E91E63" />
            </View>
            <Text style={styles.statRowLabel}>Likes Sent</Text>
            <Text style={styles.statRowValue}>{analytics?.totalLikesSent || 0}</Text>
          </View>

          <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
            <View style={styles.statRowIcon}>
              <Zap size={18} color="#FFC107" />
            </View>
            <Text style={styles.statRowLabel}>Total Swipes</Text>
            <Text style={styles.statRowValue}>{analytics?.totalSwipes || 0}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Performance Metrics</Text>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9', width: 40, height: 40, borderRadius: 20, marginBottom: 0 }]}>
              <TrendingUp size={20} color="#4CAF50" />
            </View>
            <Text style={styles.metricTitle}>Swipe Through Rate</Text>
          </View>
          <Text style={styles.metricValue}>
            {analytics?.swipeThroughRate ? `${(analytics.swipeThroughRate * 100).toFixed(1)}%` : 'N/A'}
          </Text>
          <Text style={styles.metricDescription}>
            Percentage of swipes that result in likes
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#FFF3E0', width: 40, height: 40, borderRadius: 20, marginBottom: 0 }]}>
              <BarChart3 size={20} color="#FF9800" />
            </View>
            <Text style={styles.metricTitle}>Match Likelihood</Text>
          </View>
          <Text style={styles.metricValue}>
            {analytics?.matchLikelihoodScore ? `${(analytics.matchLikelihoodScore * 100).toFixed(1)}%` : 'N/A'}
          </Text>
          <Text style={styles.metricDescription}>
            Your estimated match success rate
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Analytics update automatically as you use Blazemates
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: '#FF4458',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  proBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  statsColumn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statRowIcon: {
    marginRight: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statRowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  statRowValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  metricTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  metricValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  metricDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
