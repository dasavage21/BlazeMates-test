// © 2025 Benjamin Hawk. All rights reserved.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { supabase } from "../supabaseClient";

const screenWidth = Dimensions.get("window").width;
const screenHeight = Dimensions.get("window").height;
const cardWidth = Math.min(screenWidth * 0.9, 440);
const isDesktop = screenWidth >= 768;
const profilePicSize = isDesktop ? 90 : 70;
const titleFontSize = isDesktop ? 26 : 22;
const buttonFontSize = isDesktop ? 16 : 15;
const settingsFontSize = isDesktop ? 16 : 14;
const containerPaddingTop = isDesktop ? 60 : 48;
const containerPaddingHorizontal = isDesktop ? 20 : 16;

const SWIPE_THRESHOLD = 120;

type Looking = "smoke" | "hookup" | "both";

type Profile = {
  id: string;
  name: string;
  age: number;
  strain: string;
  style: string;
  bio: string;
  lookingFor: Looking;
  image: string;
};

type SupaUser = {
  id: string;
  name: string | null;
  age: number | null;
  bio: string | null;
  strain: string | null;
  style: string | null;
  looking_for: Looking | null;
  image_url: string | null;
};

function SwipeCard({
  profile,
  userAge,
  isTop,
  onSwipeLeft,
  onSwipeRight,
}: {
  profile: Profile;
  userAge: number | null;
  isTop: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const PLACEHOLDER_300 = "https://via.placeholder.com/300";

  const gesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 1 : -1;
        translateX.value = withSpring(
          direction * screenWidth * 1.5,
          { velocity: event.velocityX },
          () => {
            if (direction > 0) {
              runOnJS(onSwipeRight)();
            } else {
              runOnJS(onSwipeLeft)();
            }
          }
        );
        translateY.value = withSpring(event.translationY + event.velocityY * 0.1);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-screenWidth / 2, 0, screenWidth / 2],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
      opacity: isTop ? 1 : 0.8,
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  const renderLookingForTag = (type: Looking) => {
    if (type === "smoke")
      return <Text style={styles.lookingForTag}>🌿 Just Wanna Smoke</Text>;
    if (type === "hookup")
      return (
        <Text style={styles.lookingForTag}>🍑 Just Looking to Hook Up</Text>
      );
    return <Text style={styles.lookingForTag}>🌿+🍑 Both</Text>;
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Image
          key={profile?.id ?? "card"}
          source={{
            uri:
              profile?.image && profile.image.trim().length > 10
                ? profile.image
                : PLACEHOLDER_300,
          }}
          style={styles.image}
        />

        <Animated.View style={[styles.likeStamp, likeOpacity]}>
          <Text style={styles.likeText}>LIKE</Text>
        </Animated.View>

        <Animated.View style={[styles.nopeStamp, nopeOpacity]}>
          <Text style={styles.nopeText}>NOPE</Text>
        </Animated.View>

        <View style={styles.cardInfo}>
          <View style={styles.row}>
            <Text style={styles.name}>
              {profile.name}, {profile.age}
              {userAge && userAge >= 21 && (
                <Text style={styles.verified}> ✅</Text>
              )}
            </Text>
          </View>

          {renderLookingForTag(profile.lookingFor)}

          <Text style={styles.bio} numberOfLines={2}>
            {profile.bio}
          </Text>
          <Text style={styles.meta}>
            {profile.strain} • {profile.style}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function SwipeScreen() {
  const router = useRouter();
  const PLACEHOLDER_50 = "https://via.placeholder.com/50";
  const PLACEHOLDER_300 = "https://via.placeholder.com/300";

  const [index, setIndex] = useState(0);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [likedUsers, setLikedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilePhoto, setProfilePhoto] = useState(
    "https://via.placeholder.com/50"
  );
  const [loading, setLoading] = useState(true);
  const [skipCount, setSkipCount] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [shouldAdvance, setShouldAdvance] = useState(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "avatar-updated",
      ({ url, ts }) => {
        setProfilePhoto(`${url}?t=${ts}`);
      }
    );
    return () => sub.remove();
  }, []);

  const loadHeaderPhoto = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authedUser = auth?.user;

      if (authedUser?.id) {
        const { data, error } = await supabase
          .from("users")
          .select("image_url")
          .eq("id", authedUser.id)
          .maybeSingle();

        if (!error && data?.image_url) {
          const ts = (await AsyncStorage.getItem("avatarVersion")) || "";
          setProfilePhoto(ts ? `${data.image_url}?t=${ts}` : data.image_url);
          return;
        }
      }

      const stored = await AsyncStorage.getItem("userProfile");
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.profileImage) {
        const ts = (await AsyncStorage.getItem("avatarVersion")) || "";
        setProfilePhoto(
          ts ? `${parsed.profileImage}?t=${ts}` : parsed.profileImage
        );
        return;
      }

      const pending = await AsyncStorage.getItem("pendingAvatarUri");
      if (pending) {
        setProfilePhoto(pending || PLACEHOLDER_50);
        return;
      }

      setProfilePhoto(PLACEHOLDER_50);
    } catch {
      setProfilePhoto(PLACEHOLDER_50);
    }
  }, [PLACEHOLDER_50]);

  useEffect(() => {
    const init = async () => {
      const ageStored = await AsyncStorage.getItem("userAge");
      if (ageStored) setUserAge(parseInt(ageStored));

      const profileData = await AsyncStorage.getItem("userProfile");
      let userLookingFor: Looking = "both";
      if (profileData) {
        const parsed = JSON.parse(profileData);
        userLookingFor = (parsed.lookingFor as Looking) || "both";
        if (parsed.profileImage) setProfilePhoto(parsed.profileImage);
      }

      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      let alreadyLiked: string[] = [];
      if (myUserId) {
        const { data: likesData } = await supabase
          .from("likes")
          .select("liked_user_id")
          .eq("user_id", myUserId);

        if (likesData) {
          alreadyLiked = likesData.map((like) => like.liked_user_id);
          setLikedUsers(alreadyLiked);
        }
      }

      const { data, error } = await supabase
        .from("users")
        .select("id,name,age,bio,strain,style,looking_for,image_url");

      if (error) {
        console.error("Failed to fetch users:", error);
        setProfiles([]);
        setIndex(0);
        setLoading(false);
        return;
      }

      if (myUserId && data) {
        const me = data.find((u: SupaUser) => u.id === myUserId);
        if (me?.age !== null && me?.age !== undefined) {
          const meAge = Number(me.age);
          if (!Number.isNaN(meAge)) {
            setUserAge(meAge);
            await AsyncStorage.setItem("userAge", meAge.toString());
          }
        }
      }

      const everyone: Profile[] = (data ?? []).map((u: SupaUser) => ({
        id: u.id,
        name: u.name ?? "—",
        age: u.age ?? 0,
        strain: u.strain ?? "—",
        style: u.style ?? "—",
        bio: u.bio ?? "",
        lookingFor: (u.looking_for ?? "both") as Looking,
        image:
          u.image_url && u.image_url.trim().length > 0
            ? u.image_url
            : PLACEHOLDER_300,
      }));

      const filtered = everyone
        .filter((p) => !myUserId || p.id !== myUserId)
        .filter((p) => !alreadyLiked.includes(p.id))
        .filter(
          (p) =>
            userLookingFor === "both" ||
            p.lookingFor === userLookingFor ||
            p.lookingFor === "both"
        );

      setProfiles(filtered);
      setIndex(0);
      setLoading(false);

      const channel = supabase
        .channel("users-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "users",
          },
          (payload) => {
            const newUser = payload.new as SupaUser;

            if (myUserId && newUser.id === myUserId) return;
            if (alreadyLiked.includes(newUser.id)) return;

            const newProfile: Profile = {
              id: newUser.id,
              name: newUser.name ?? "—",
              age: newUser.age ?? 0,
              strain: newUser.strain ?? "—",
              style: newUser.style ?? "—",
              bio: newUser.bio ?? "",
              lookingFor: (newUser.looking_for ?? "both") as Looking,
              image:
                newUser.image_url && newUser.image_url.trim().length > 0
                  ? newUser.image_url
                  : PLACEHOLDER_300,
            };

            const lookingForMatches =
              userLookingFor === "both" ||
              newProfile.lookingFor === userLookingFor ||
              newProfile.lookingFor === "both";

            if (lookingForMatches) {
              setProfiles((prev) => [...prev, newProfile]);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
          },
          (payload) => {
            const updatedUser = payload.new as SupaUser;

            if (myUserId && updatedUser.id === myUserId) return;

            setProfiles((prev) =>
              prev.map((profile) => {
                if (profile.id === updatedUser.id) {
                  return {
                    id: updatedUser.id,
                    name: updatedUser.name ?? "—",
                    age: updatedUser.age ?? 0,
                    strain: updatedUser.strain ?? "—",
                    style: updatedUser.style ?? "—",
                    bio: updatedUser.bio ?? "",
                    lookingFor: (updatedUser.looking_for ?? "both") as Looking,
                    image:
                      updatedUser.image_url &&
                      updatedUser.image_url.trim().length > 0
                        ? updatedUser.image_url
                        : PLACEHOLDER_300,
                  };
                }
                return profile;
              })
            );
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    init();
  }, []);

  useEffect(() => {
    loadHeaderPhoto();
  }, [loadHeaderPhoto]);

  useFocusEffect(
    useCallback(() => {
      if (shouldAdvance) {
        setShouldAdvance(false);
        if (index < profiles.length - 1) {
          setIndex((i) => i + 1);
        } else {
          router.push("/matches");
        }
      }
    }, [shouldAdvance, index, profiles.length, router])
  );

  useEffect(() => {
    if (skipCount > 0) {
      const t = setTimeout(() => setSkipCount(0), 10_000);
      return () => clearTimeout(t);
    }
  }, [skipCount]);

  const handleSwipeRight = async () => {
    const current = profiles[index];
    if (!current) return;

    if (!likedUsers.includes(current.id)) {
      setLikedUsers((prev) => [...prev, current.id]);

      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (myUserId) {
        await supabase.from("likes").insert({
          user_id: myUserId,
          liked_user_id: current.id,
        });
      }

      setShouldAdvance(true);
      router.push(`/match?matchId=${current.id}`);
      return;
    }

    handleNext();
  };

  const handleSwipeLeft = () => {
    if (cooldownActive) return;

    const next = skipCount + 1;
    setSkipCount(next);

    if (next >= 5) {
      setCooldownActive(true);
      setTimeout(() => {
        setCooldownActive(false);
        setSkipCount(0);
      }, 5000);
      return;
    }

    handleNext();
  };

  const handleNext = () => {
    if (index < profiles.length - 1) {
      setIndex((i) => i + 1);
    } else {
      router.push("/matches");
    }
  };

  const handleButtonSwipeRight = () => {
    handleSwipeRight();
  };

  const handleButtonSwipeLeft = () => {
    handleSwipeLeft();
  };

  const visibleProfiles = profiles.slice(index, index + 3);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF7F" />
          <Text style={styles.loadingText}>Loading profiles...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <Text style={styles.logo}>🔥</Text>
          <Text style={styles.brandName}>BlazeMates</Text>
        </View>

        <View style={styles.navCenter}>
          <TouchableOpacity onPress={() => router.push("/profile")}>
            <Image
              key={profilePhoto}
              source={{ uri: profilePhoto || PLACEHOLDER_50 }}
              style={styles.navProfilePic}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/matches")}>
            <Text style={styles.navLink}>💚 Matches</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/chat")}>
            <Text style={styles.navLink}>💬 Chat</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Text style={styles.navLink}>⚙️ Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardContainer}>
        {visibleProfiles.length > 0 ? (
          <>
            {visibleProfiles
              .slice()
              .reverse()
              .map((profile, idx) => {
                const isTop = idx === visibleProfiles.length - 1;
                return (
                  <View
                    key={profile.id}
                    style={[
                      styles.cardWrapper,
                      !isTop && {
                        position: "absolute",
                        top: -idx * 4,
                        transform: [{ scale: 1 - idx * 0.03 }],
                      },
                    ]}
                  >
                    <SwipeCard
                      profile={profile}
                      userAge={userAge}
                      isTop={isTop}
                      onSwipeLeft={handleSwipeLeft}
                      onSwipeRight={handleSwipeRight}
                    />
                  </View>
                );
              })}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              😕 No users found yet. Check back soon!
            </Text>
          </View>
        )}
      </View>

      {visibleProfiles.length > 0 && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.nopeButton,
              cooldownActive && { backgroundColor: "#555", opacity: 0.5 },
            ]}
            onPress={handleButtonSwipeLeft}
            disabled={cooldownActive}
          >
            <Text style={styles.buttonIcon}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={handleButtonSwipeRight}
          >
            <Text style={styles.buttonIcon}>♥</Text>
          </TouchableOpacity>
        </View>
      )}

      {cooldownActive && (
        <View style={styles.cooldownBanner}>
          <Text style={styles.cooldownText}>
            ⏳ Slow down! You're swiping too fast.
          </Text>
        </View>
      )}

      <Text style={styles.footer}>
        BlazeMates LLC v1.0.0 (c) 2025 BlazeMates LLC. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    paddingVertical: 12,
    paddingHorizontal: isDesktop ? 40 : 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  navLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    fontSize: 28,
  },
  brandName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00FF7F",
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: isDesktop ? 24 : 16,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  navLink: {
    color: "#fff",
    fontSize: isDesktop ? 15 : 13,
    fontWeight: "500",
  },
  navProfilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: "#00FF7F",
    borderWidth: 2,
  },
  cardContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    position: "relative",
  },
  cardWrapper: {
    width: cardWidth,
    maxWidth: 440,
    height: screenHeight * 0.55,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1e1e1e",
    width: cardWidth,
    maxWidth: 440,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#00FF7F",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5,
  },
  image: {
    width: "100%",
    height: screenHeight * 0.35,
    resizeMode: "cover",
  },
  cardInfo: {
    padding: 16,
    backgroundColor: "#1e1e1e",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginRight: 10,
  },
  verified: { fontSize: 18, color: "#00FF7F" },
  bio: {
    fontSize: 15,
    color: "#ccc",
    marginVertical: 8,
  },
  meta: {
    fontSize: 13,
    color: "#aaa",
    marginTop: 4,
  },
  lookingForTag: {
    backgroundColor: "#2e2e2e",
    color: "#00FF7F",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: "600",
    overflow: "hidden",
  },
  likeStamp: {
    position: "absolute",
    top: 50,
    left: 30,
    borderWidth: 4,
    borderColor: "#00FF7F",
    borderRadius: 8,
    padding: 8,
    transform: [{ rotate: "-20deg" }],
    zIndex: 10,
  },
  likeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#00FF7F",
    letterSpacing: 2,
  },
  nopeStamp: {
    position: "absolute",
    top: 50,
    right: 30,
    borderWidth: 4,
    borderColor: "#FF3B5C",
    borderRadius: 8,
    padding: 8,
    transform: [{ rotate: "20deg" }],
    zIndex: 10,
  },
  nopeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FF3B5C",
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    gap: 40,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  nopeButton: {
    backgroundColor: "#FF3B5C",
  },
  likeButton: {
    backgroundColor: "#00FF7F",
  },
  buttonIcon: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
  },
  cooldownBanner: {
    marginTop: 16,
    backgroundColor: "#2e2e2e",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  cooldownText: {
    color: "#FF3B5C",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    color: "#aaa",
    fontSize: isDesktop ? 16 : 15,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#00FF7F",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  footer: {
    color: "#777",
    paddingVertical: 20,
    fontSize: 12,
    textAlign: "center",
  },
});
