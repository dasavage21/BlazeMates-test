// © 2025 Benjamin Hawk. All rights reserved.

import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

const allProfiles = [
  { id: '1', name: 'Hannah', age: 25, strain: 'Sour Diesel', style: 'Social', bio: 'Love to chill and smoke.', lookingFor: 'smoke', image: 'https://via.placeholder.com/300' },
  { id: '2', name: 'Jason', age: 27, strain: 'Indica', style: 'Chill', bio: 'Indica lover, always down to blaze.', lookingFor: 'both', image: 'https://via.placeholder.com/300' },
  { id: '3', name: 'Sarah', age: 26, strain: 'Hybrid', style: 'Party', bio: 'Looking for good vibes only.', lookingFor: 'hookup', image: 'https://via.placeholder.com/300' },
];

export default function SwipeScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const fadeAnim = new Animated.Value(1);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [likedUsers, setLikedUsers] = useState<string[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<typeof allProfiles>([]);
  const [profilePhoto, setProfilePhoto] = useState('https://via.placeholder.com/50');

  useEffect(() => {
    const init = async () => {
      const ageStored = await AsyncStorage.getItem('userAge');
      if (ageStored) setUserAge(parseInt(ageStored));

      const profileData = await AsyncStorage.getItem('userProfile');
      let userLookingFor = 'both';
      if (profileData) {
        const parsed = JSON.parse(profileData);
        userLookingFor = parsed.lookingFor || 'both';
        if (parsed.image) {
          setProfilePhoto(parsed.image);
        }
      }

      const matches = allProfiles.filter((p) =>
        userLookingFor === 'both' || p.lookingFor === userLookingFor || p.lookingFor === 'both'
      );
      setFilteredProfiles(matches);
    };
    init();
  }, []);
  const [cooldownAnim] = useState(new Animated.Value(0));
const [skipCount, setSkipCount] = useState(0);
const [cooldownActive, setCooldownActive] = useState(false);
useEffect(() => {
  if (skipCount > 0) {
    const timer = setTimeout(() => setSkipCount(0), 10000); // reset after 10 seconds
    return () => clearTimeout(timer);
  }
}, [skipCount]);
  const handleNext = () => {
    if (index < filteredProfiles.length - 1) setIndex(index + 1);
    else router.push('/chat');
  };

  const handleSwipeRight = () => {
    const current = filteredProfiles[index];
    if (!likedUsers.includes(current.id)) {
      setLikedUsers([...likedUsers, current.id]);
      if (current.id === '2') {
        router.push('/match');
        return;
      }
    }
  
  
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start(handleNext);
  };
const handleSwipeLeft = () => {
  if (cooldownActive) return;
  useEffect(() => {
  Animated.timing(cooldownAnim, {
    toValue: cooldownActive ? 1 : 0,
    duration: 300,
    useNativeDriver: true,
  }).start();
}, [cooldownActive]);

  const newSkipCount = skipCount + 1;
  setSkipCount(newSkipCount);

  if (newSkipCount >= 5) {
    setCooldownActive(true);
    setTimeout(() => {
      setCooldownActive(false);
      setSkipCount(0);
    }, 5000); // 5 second cooldown
    return;
  }

  if (index < filteredProfiles.length - 1) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start(() => setIndex(index + 1));
  } else {
    
  }
};

  const currentProfile = filteredProfiles[index];

  const renderLookingForTag = (type: string) => {
    switch (type) {
      case 'smoke':
        return <Text style={styles.lookingForTag}>🌿 Just Wanna Smoke</Text>;
      case 'hookup':
        return <Text style={styles.lookingForTag}>🍑 Just Looking to Hook Up</Text>;
      case 'both':
        return <Text style={styles.lookingForTag}>🌿+🍑 Both</Text>;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
  <TouchableOpacity onPress={() => router.push('/profile')}>
    <Image source={{ uri: profilePhoto }} style={styles.profilePicLarge} />
  </TouchableOpacity>
  <Text style={styles.title}>🔥 BlazeMates</Text>
</View>

      

      

      <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/chat')}>
        <Text style={styles.profileBtnText}>💬 Chat</Text>
      </TouchableOpacity>

      {currentProfile && (
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Image source={{ uri: currentProfile.image }} style={styles.image} />
          <View style={styles.row}>
            <Text style={styles.name}>
              {currentProfile.name}, {currentProfile.age}
              {userAge && userAge >= 21 && <Text style={styles.verified}> ✅</Text>}
            </Text>
            {renderLookingForTag(currentProfile.lookingFor)}
          </View>

          <Text style={styles.bio}>{currentProfile.bio}</Text>
          <Text style={styles.meta}>Strain: {currentProfile.strain} • Style: {currentProfile.style}</Text>

          <View style={styles.row}>
            <TouchableOpacity
           style={[
               styles.button,
                cooldownActive && { backgroundColor: '#555' } // darker when disabled
        ]}
           onPress={handleSwipeLeft}
           disabled={cooldownActive}
>
      <Text style={styles.buttonText}>❌</Text>
      </TouchableOpacity>
              
            <TouchableOpacity style={styles.button} onPress={handleSwipeRight}>
              <Text style={styles.buttonText}>✔️</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ opacity: cooldownAnim, marginTop: 10 }}>
  <Text style={{ color: '#ff5555' }}>
    ⏳ Slow down! You're swiping too fast.
  </Text>
</Animated.View>
          
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 20,
  marginTop: 10,
},
  profilePicLarge: {
  width: 90,
  height: 90,
  borderRadius: 45,
  borderColor: '#00FF7F',
  borderWidth: 2,
  marginBottom: 8,
},
  title: {
  fontSize: 26,
  color: '#00FF7F',
  fontWeight: 'bold',
  },
  profileBtn: {
    backgroundColor: '#1f1f1f',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  profileBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1e1e1e',
    width: screenWidth * 0.9,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#00FF7F',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5,
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: 20,
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginRight: 10,
  },
  verified: {
    fontSize: 18,
    color: '#00FF7F',
  },
  bio: {
    fontSize: 16,
    color: '#ccc',
    marginVertical: 10,
    textAlign: 'center',
  },
  meta: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#00FF7F',
    padding: 14,
    borderRadius: 50,
    marginHorizontal: 20,
  },
  buttonText: {
    fontSize: 20,
  },
  lookingForTag: {
    backgroundColor: '#2e2e2e',
    color: '#00FF7F',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
