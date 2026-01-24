import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string | null;
  };
}

interface UserStory {
  user_id: string;
  username: string;
  avatar_url: string | null;
  stories: Story[];
  has_viewed: boolean;
}

export default function StoriesRow() {
  const router = useRouter();
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasOwnStory, setHasOwnStory] = useState(false);
  const [ownStoryData, setOwnStoryData] = useState<UserStory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStories();

    const channel = supabase
      .channel('stories_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories',
        },
        () => {
          fetchStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: stories, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          image_url,
          created_at
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const uniqueUserIds = [...new Set(stories?.map(s => s.user_id) || [])];

      const { data: usersData } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', uniqueUserIds);

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id);

      const viewedStoryIds = new Set(views?.map(v => v.story_id) || []);

      const grouped = stories?.reduce((acc: { [key: string]: UserStory }, story) => {
        if (!acc[story.user_id]) {
          const userData = usersMap.get(story.user_id);
          acc[story.user_id] = {
            user_id: story.user_id,
            username: userData?.username || 'Unknown',
            avatar_url: userData?.avatar_url || null,
            stories: [],
            has_viewed: true,
          };
        }

        acc[story.user_id].stories.push(story);

        if (!viewedStoryIds.has(story.id)) {
          acc[story.user_id].has_viewed = false;
        }

        return acc;
      }, {});

      const userStoriesList = Object.values(grouped || {});

      const ownStory = userStoriesList.find(us => us.user_id === user.id);
      const othersStories = userStoriesList
        .filter(us => us.user_id !== user.id)
        .sort((a, b) => {
          if (a.has_viewed !== b.has_viewed) {
            return a.has_viewed ? 1 : -1;
          }
          return 0;
        });

      setHasOwnStory(!!ownStory);
      setOwnStoryData(ownStory || null);
      setUserStories(othersStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = () => {
    router.push('/create-story');
  };

  const handleViewStory = (userId: string) => {
    router.push(`/story-viewer?userId=${userId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={styles.storyItem}
          onPress={handleCreateStory}
        >
          <View style={[styles.storyAvatarContainer, styles.createStoryBorder]}>
            <View style={styles.createStoryAvatar}>
              <View style={styles.plusIconContainer}>
                <Plus size={20} color="#fff" />
              </View>
            </View>
          </View>
          <Text style={styles.storyUsername} numberOfLines={1}>
            Add story
          </Text>
        </TouchableOpacity>

        {hasOwnStory && ownStoryData && (
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => handleViewStory(ownStoryData.user_id)}
          >
            <View style={styles.storyAvatarContainer}>
              <LinearGradient
                colors={['#4CAF50', '#45a049', '#4CAF50']}
                style={styles.storyGradient}
              >
                {ownStoryData.avatar_url ? (
                  <Image
                    source={{ uri: ownStoryData.avatar_url }}
                    style={styles.storyAvatar}
                  />
                ) : (
                  <View style={[styles.storyAvatar, styles.defaultAvatar]} />
                )}
              </LinearGradient>
            </View>
            <Text style={styles.storyUsername} numberOfLines={1}>
              Your story
            </Text>
          </TouchableOpacity>
        )}

        {userStories.map((userStory) => (
          <TouchableOpacity
            key={userStory.user_id}
            style={styles.storyItem}
            onPress={() => handleViewStory(userStory.user_id)}
          >
            <View style={styles.storyAvatarContainer}>
              {userStory.has_viewed ? (
                <View style={styles.viewedStoryBorder}>
                  {userStory.avatar_url ? (
                    <Image
                      source={{ uri: userStory.avatar_url }}
                      style={styles.storyAvatar}
                    />
                  ) : (
                    <View style={[styles.storyAvatar, styles.defaultAvatar]} />
                  )}
                </View>
              ) : (
                <LinearGradient
                  colors={['#4CAF50', '#45a049', '#4CAF50']}
                  style={styles.storyGradient}
                >
                  {userStory.avatar_url ? (
                    <Image
                      source={{ uri: userStory.avatar_url }}
                      style={styles.storyAvatar}
                    />
                  ) : (
                    <View style={[styles.storyAvatar, styles.defaultAvatar]} />
                  )}
                </LinearGradient>
              )}
            </View>
            <Text style={styles.storyUsername} numberOfLines={1}>
              {userStory.username}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26, 26, 26, 0.6)',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 16,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
  },
  storyAvatarContainer: {
    width: 68,
    height: 68,
    marginBottom: 6,
  },
  storyGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  viewedStoryBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createStoryBorder: {
    borderWidth: 3,
    borderColor: 'rgba(76, 175, 80, 0.5)',
    borderRadius: 34,
    borderStyle: 'dashed',
  },
  storyAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  createStoryAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyUsername: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  defaultAvatar: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
