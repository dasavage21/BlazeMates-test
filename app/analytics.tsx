import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Eye, Heart, TrendingUp, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { userStore } from '../lib/userStore';

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
  const user = userStore((state) => state.user);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

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

      if (!userData ||
          userData.subscription_status !== 'active' ||
          !['pro', 'blaze_og', 'blaze_pro'].includes(userData.subscription_tier)) {
        setError('Profile analytics is a Blaze Pro feature. Upgrade to unlock!');
        setLoading(false);
        return;
      }

      let analyticsData = await supabase
        .from('subscription_analytics')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!analyticsData.data) {
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
        }

        analyticsData = await supabase
          .from('subscription_analytics')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: viewsLast7Days } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_user_id', authUser.id)
        .gte('viewed_at', sevenDaysAgo.toISOString());

      const { count: likesLast7Days } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('liked_user_id', authUser.id)
        .gte('created_at', sevenDaysAgo.toISOString());

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

      await supabase.rpc('update_profile_view_analytics').catch(err => {
        console.error('Failed to update analytics:', err);
      });

    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF4458" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>📊</Text>
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/subscription')}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO FEATURE</Text>
        </View>

        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
              <Eye size={24} color="#2196F3" />
            </View>
            <Text style={styles.statValue}>{analytics?.viewsLast7Days || 0}</Text>
            <Text style={styles.statLabel}>Profile Views</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#FCE4EC' }]}>
              <Heart size={24} color="#FF4458" />
            </View>
            <Text style={styles.statValue}>{analytics?.likesLast7Days || 0}</Text>
            <Text style={styles.statLabel}>Likes Received</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>All Time Stats</Text>
        <View style={styles.statsColumn}>
          <View style={styles.statRow}>
            <View style={styles.statRowIcon}>
              <Eye size={20} color="#666" />
            </View>
            <Text style={styles.statRowLabel}>Total Profile Views</Text>
            <Text style={styles.statRowValue}>{analytics?.totalProfileViews || 0}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statRowIcon}>
              <Heart size={20} color="#666" />
            </View>
            <Text style={styles.statRowLabel}>Likes Received</Text>
            <Text style={styles.statRowValue}>{analytics?.totalLikesReceived || 0}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statRowIcon}>
              <Heart size={20} color="#666" />
            </View>
            <Text style={styles.statRowLabel}>Likes Sent</Text>
            <Text style={styles.statRowValue}>{analytics?.totalLikesSent || 0}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statRowIcon}>
              <Zap size={20} color="#666" />
            </View>
            <Text style={styles.statRowLabel}>Total Swipes</Text>
            <Text style={styles.statRowValue}>{analytics?.totalSwipes || 0}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <View style={styles.statsColumn}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <TrendingUp size={20} color="#4CAF50" />
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
              <TrendingUp size={20} color="#FF9800" />
              <Text style={styles.metricTitle}>Match Likelihood</Text>
            </View>
            <Text style={styles.metricValue}>
              {analytics?.matchLikelihoodScore ? `${(analytics.matchLikelihoodScore * 100).toFixed(1)}%` : 'N/A'}
            </Text>
            <Text style={styles.metricDescription}>
              Your estimated match success rate
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Analytics update automatically as you use Blazemates
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    padding: 16,
  },
  proBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statsColumn: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statRowIcon: {
    marginRight: 12,
  },
  statRowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  statRowValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  metricValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  metricDescription: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
