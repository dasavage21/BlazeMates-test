import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { X, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 5000;

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  expires_at: string;
  user?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function StoryViewer() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwnStory, setIsOwnStory] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout>();
  const autoAdvanceTimeout = useRef<NodeJS.Timeout>();

  const userId = params.userId as string;

  useEffect(() => {
    if (userId) {
      fetchStories();
    }
  }, [userId]);

  useEffect(() => {
    if (stories.length > 0 && !paused) {
      startProgress();
      markStoryAsViewed(stories[currentIndex].id);
    }
    return () => {
      clearProgress();
    };
  }, [currentIndex, stories, paused]);

  const fetchStories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwnStory(user?.id === userId);

      const { data: storiesData, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!storiesData || storiesData.length === 0) {
        router.back();
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();

      const storiesWithUser = storiesData.map(story => ({
        ...story,
        user: userData || { username: 'Unknown', avatar_url: null }
      }));

      setStories(storiesWithUser);
    } catch (error) {
      console.error('Error fetching stories:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const markStoryAsViewed = async (storyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          viewer_id: user.id,
        }, {
          onConflict: 'story_id,viewer_id'
        });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const startProgress = () => {
    clearProgress();
    setProgress(0);

    const startTime = Date.now();
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / STORY_DURATION) * 100;

      if (newProgress >= 100) {
        goToNext();
      } else {
        setProgress(newProgress);
      }
    }, 50);
  };

  const clearProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    if (autoAdvanceTimeout.current) {
      clearTimeout(autoAdvanceTimeout.current);
    }
  };

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handlePress = (x: number) => {
    const third = width / 3;
    if (x < third) {
      goToPrevious();
    } else {
      goToNext();
    }
  };

  const handleDeleteStory = async () => {
    if (!isOwnStory || deleting) return;

    setDeleting(true);
    try {
      const currentStory = stories[currentIndex];

      const fileName = currentStory.image_url.split('/stories/')[1];
      if (fileName) {
        await supabase.storage
          .from('stories')
          .remove([fileName]);
      }

      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', currentStory.id);

      if (error) throw error;

      const updatedStories = stories.filter((_, index) => index !== currentIndex);

      if (updatedStories.length === 0) {
        router.back();
      } else {
        setStories(updatedStories);
        if (currentIndex >= updatedStories.length) {
          setCurrentIndex(updatedStories.length - 1);
        }
      }
    } catch (error) {
      console.error('Error deleting story:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (stories.length === 0) {
    return null;
  }

  const currentStory = stories[currentIndex];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Image
        source={{ uri: currentStory.image_url }}
        style={styles.storyImage}
        resizeMode="contain"
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topGradient}
      />

      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${
                    index < currentIndex
                      ? 100
                      : index === currentIndex
                      ? progress
                      : 0
                  }%`,
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <View style={styles.userInfo}>
          {currentStory.user?.avatar_url ? (
            <Image
              source={{ uri: currentStory.user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]} />
          )}
          <Text style={styles.username}>{currentStory.user?.username}</Text>
          <Text style={styles.timestamp}>
            {getTimeAgo(currentStory.created_at)}
          </Text>
        </View>

        <View style={styles.headerButtons}>
          {isOwnStory && (
            <TouchableOpacity
              onPress={handleDeleteStory}
              style={styles.deleteButton}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Trash2 size={24} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <X size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <Pressable
        style={styles.tapArea}
        onPress={(e) => handlePress(e.nativeEvent.locationX)}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
      />
    </View>
  );
}

function getTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width,
    height,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressBarBackground: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
  },
  username: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    borderRadius: 20,
  },
  closeButton: {
    padding: 8,
  },
  tapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  defaultAvatar: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
