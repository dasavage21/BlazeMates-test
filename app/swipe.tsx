// © 2025 Benjamin Hawk. All rights reserved.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
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
import { updateUserActivity } from "../lib/activityTracker";
import { fetchSiteStatus, SiteStatus } from "../lib/siteStatus";
import { SubscriptionBadge } from "../components/SubscriptionBadge";
import { BlazeLevelBadge } from "../components/BlazeLevelBadge";

const screenWidth = Dimensions.get("window").width;
const screenHeight = Dimensions.get("window").height;

const isSmallPhone = screenWidth <= 360;
const isMediumPhone = screenWidth > 360 && screenWidth < 414;
const isLargePhone = screenWidth >= 414 && screenWidth < 768;
const isDesktop = screenWidth >= 768;

const cardWidth = Math.min(screenWidth * 0.92, 440);
const navPadding = isSmallPhone ? 10 : (isMediumPhone ? 14 : (isDesktop ? 40 : 16));
const navGap = isSmallPhone ? 12 : (isMediumPhone ? 16 : (isDesktop ? 24 : 16));
const navFontSize = isSmallPhone ? 12 : (isDesktop ? 15 : 13);
const logoSize = isSmallPhone ? 22 : 28;
const brandFontSize = isSmallPhone ? 14 : 20;
const navProfilePicSize = isSmallPhone ? 28 : 36;

const profilePicSize = isDesktop ? 90 : 70;
const titleFontSize = isDesktop ? 26 : 22;
const buttonFontSize = isDesktop ? 16 : 15;
const settingsFontSize = isDesktop ? 16 : 14;
const containerPaddingTop = isDesktop ? 60 : 48;
const containerPaddingHorizontal = isDesktop ? 20 : 16;

const cardNameFontSize = isSmallPhone ? 18 : 22;
const cardBioFontSize = isSmallPhone ? 13 : 15;
const cardMetaFontSize = isSmallPhone ? 11 : 13;
const cardInfoPadding = isSmallPhone ? 12 : 16;
const actionButtonSize = isSmallPhone ? 50 : 60;
const actionButtonGap = isSmallPhone ? 24 : 40;

const SWIPE_THRESHOLD = 120;

type Profile = {
  id: string;
  name: string;
  age: number;
  strain: string;
  experienceLevel: string;
  bio: string;
  preferredStrains: string[];
  consumptionMethods: string[];
  cultivationInterest: boolean;
  image: string;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  isBoosted: boolean;
  blazeLevel: number;
};

type SupaUser = {
  id: string;
  name: string | null;
  age: number | null;
  bio: string | null;
  strain: string | null;
  experience_level: string | null;
  preferred_strains: string[] | null;
  consumption_methods: string[] | null;
  cultivation_interest: boolean | null;
  image_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  boost_active_until: string | null;
  blaze_level: number | null;
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

  const renderExperienceBadge = (level: string) => {
    const badges: Record<string, string> = {
      "Cannabis Curious": "🌱",
      "Beginner": "🌿",
      "Intermediate": "🔥",
      "Expert": "💎"
    };
    const emoji = badges[level] || "🌿";
    return <Text style={styles.experienceTag}>{emoji} {level}</Text>;
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

        {profile.isBoosted && (
          <View style={styles.boostBadge}>
            <Text style={styles.boostBadgeText}>⚡ BOOSTED</Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <View style={styles.row}>
            <Text style={styles.name}>
              {profile.name}, {profile.age}
              {userAge && userAge >= 21 && (
                <Text style={styles.verified}> ✅</Text>
              )}
            </Text>
            <View style={styles.badgeRow}>
              <SubscriptionBadge
                tier={profile.subscriptionTier}
                status={profile.subscriptionStatus}
                size="small"
              />
              <BlazeLevelBadge
                level={profile.blazeLevel}
                size="small"
              />
            </View>
          </View>

          {renderExperienceBadge(profile.experienceLevel)}

          <Text style={styles.bio} numberOfLines={2}>
            {profile.bio}
          </Text>
          <View style={styles.tagsContainer}>
            {profile.preferredStrains.slice(0, 2).map((strain, idx) => (
              <Text key={idx} style={styles.tag}>{strain}</Text>
            ))}
            {profile.cultivationInterest && (
              <Text style={styles.tag}>🌱 Grower</Text>
            )}
          </View>
          <Text style={styles.meta}>
            {profile.strain} • {profile.consumptionMethods.slice(0, 2).join(", ")}
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
  const [passedUsers, setPassedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilePhoto, setProfilePhoto] = useState(
    "https://via.placeholder.com/50"
  );
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [skipCount, setSkipCount] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [shouldAdvance, setShouldAdvance] = useState(false);
  const [swipesRemaining, setSwipesRemaining] = useState<number>(-1);
  const [isPremium, setIsPremium] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [lastSwipeAction, setLastSwipeAction] = useState<{
    type: "like" | "pass";
    userId: string;
  } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [siteStatus, setSiteStatus] = useState<SiteStatus>({
    enabled: false,
    message: '',
    type: 'warning',
  });

  const likedUsersRef = useRef<string[]>([]);
  const passedUsersRef = useRef<string[]>([]);
  const myUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    likedUsersRef.current = likedUsers;
  }, [likedUsers]);

  useEffect(() => {
    passedUsersRef.current = passedUsers;
  }, [passedUsers]);

  useEffect(() => {
    setProfiles((prev) => prev.filter((p) => !likedUsers.includes(p.id) && !passedUsers.includes(p.id)));
  }, [likedUsers, passedUsers]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "avatar-updated",
      ({ url, ts }) => {
        setProfilePhoto(`${url}?t=${ts}`);
      }
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    fetchSiteStatus().then(setSiteStatus);
  }, []);

  const checkDailyLimit = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (!myUserId) return;

      const { data, error } = await supabase.rpc("check_and_reset_daily_swipes", {
        p_user_id: myUserId,
      });

      if (error) {
        console.error("Failed to check daily limit:", error);
        return;
      }

      if (data && data.length > 0) {
        const { swipes_remaining, is_premium } = data[0];
        setSwipesRemaining(swipes_remaining);
        setIsPremium(is_premium);
        setShowLimitReached(!is_premium && swipes_remaining <= 0);
        setCanUndo(is_premium);
      }
    } catch (error) {
      console.error("Error checking daily limit:", error);
    }
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
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Profile loading timeout - forcing completion");
        setLoading(false);
        setInitialLoad(false);
      }
    }, 10000);

    const init = async () => {
      const ageStored = await AsyncStorage.getItem("userAge");
      if (ageStored) setUserAge(parseInt(ageStored, 10));

      const profileData = await AsyncStorage.getItem("userProfile");
      if (profileData) {
        const parsed = JSON.parse(profileData);
        if (parsed.profileImage) setProfilePhoto(parsed.profileImage);
      }

      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;
      myUserIdRef.current = myUserId;

      let alreadyLiked: string[] = [];
      let alreadyPassed: string[] = [];
      if (myUserId) {
        const { data: likesData } = await supabase
          .from("likes")
          .select("liked_user_id")
          .eq("user_id", myUserId);

        if (likesData) {
          alreadyLiked = likesData.map((like) => like.liked_user_id);
          setLikedUsers(alreadyLiked);
          likedUsersRef.current = alreadyLiked;
        }

        const { data: passesData } = await supabase
          .from("passes")
          .select("passed_user_id")
          .eq("user_id", myUserId);

        if (passesData) {
          alreadyPassed = passesData.map((pass) => pass.passed_user_id);
          setPassedUsers(alreadyPassed);
          passedUsersRef.current = alreadyPassed;
        }

      }

      const { data, error } = await supabase
        .from("users")
        .select("id,name,age,bio,strain,experience_level,preferred_strains,consumption_methods,cultivation_interest,image_url,subscription_tier,subscription_status,boost_active_until,blaze_level")
        .eq("is_suspended", false)
        .not("name", "is", null)
        .not("age", "is", null);

      if (error) {
        console.error("Failed to fetch users:", error);
        setProfiles([]);
        setIndex(0);
        setLoading(false);
        setInitialLoad(false);
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
        experienceLevel: u.experience_level ?? "Beginner",
        bio: u.bio ?? "",
        preferredStrains: u.preferred_strains ?? [],
        consumptionMethods: u.consumption_methods ?? [],
        cultivationInterest: u.cultivation_interest ?? false,
        image:
          u.image_url && u.image_url.trim().length > 0
            ? u.image_url
            : PLACEHOLDER_300,
        subscriptionTier: u.subscription_tier,
        subscriptionStatus: u.subscription_status,
        isBoosted: u.boost_active_until ? new Date(u.boost_active_until) > new Date() : false,
        blazeLevel: u.blaze_level ?? 1,
      }));

      const filtered = everyone
        .filter((p) => !myUserId || p.id !== myUserId)
        .filter((p) => !alreadyLiked.includes(p.id))
        .filter((p) => !alreadyPassed.includes(p.id))
        .sort((a, b) => {
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;
          return 0;
        });

      setProfiles(filtered);
      setIndex(0);
      setLoading(false);
      setInitialLoad(false);

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
            console.log("New user detected:", payload.new);
            const newUser = payload.new as SupaUser & {
              is_suspended?: boolean;
            };

            if (myUserIdRef.current && newUser.id === myUserIdRef.current) {
              console.log("Skipping - it's the current user");
              return;
            }
            if (likedUsersRef.current.includes(newUser.id)) {
              console.log("Skipping - already liked this user");
              return;
            }
            if (passedUsersRef.current.includes(newUser.id)) {
              console.log("Skipping - already passed this user");
              return;
            }
            if (newUser.is_suspended === true) {
              console.log("Skipping - user is suspended");
              return;
            }

            if (!newUser.name || !newUser.age) {
              console.log("Skipping - incomplete profile (missing name or age)");
              return;
            }

            const newProfile: Profile = {
              id: newUser.id,
              name: newUser.name ?? "—",
              age: newUser.age ?? 0,
              strain: newUser.strain ?? "—",
              experienceLevel: newUser.experience_level ?? "Beginner",
              bio: newUser.bio ?? "",
              preferredStrains: newUser.preferred_strains ?? [],
              consumptionMethods: newUser.consumption_methods ?? [],
              cultivationInterest: newUser.cultivation_interest ?? false,
              image:
                newUser.image_url && newUser.image_url.trim().length > 0
                  ? newUser.image_url
                  : PLACEHOLDER_300,
              subscriptionTier: newUser.subscription_tier,
              subscriptionStatus: newUser.subscription_status,
              isBoosted: newUser.boost_active_until ? new Date(newUser.boost_active_until) > new Date() : false,
              blazeLevel: newUser.blaze_level ?? 1,
            };

            console.log("Adding new user to profiles:", newProfile.name);
            setProfiles((prev) => {
              const updated = [...prev, newProfile];
              return updated.sort((a, b) => {
                if (a.isBoosted && !b.isBoosted) return -1;
                if (!a.isBoosted && b.isBoosted) return 1;
                return 0;
              });
            });
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
            console.log("User update detected:", payload.new);
            const updatedUser = payload.new as SupaUser & {
              is_suspended?: boolean;
            };

            if (myUserIdRef.current && updatedUser.id === myUserIdRef.current) {
              console.log("Skipping update - it's the current user");
              return;
            }

            if (updatedUser.is_suspended === true) {
              console.log("Removing suspended user from profiles");
              setProfiles((prev) => prev.filter((p) => p.id !== updatedUser.id));
              return;
            }

            if (!updatedUser.name || !updatedUser.age) {
              console.log("Removing user with incomplete profile from feed");
              setProfiles((prev) => prev.filter((p) => p.id !== updatedUser.id));
              return;
            }

            setProfiles((prev) => {
              const updated = prev.map((profile) => {
                if (profile.id === updatedUser.id) {
                  console.log("Updating profile for:", updatedUser.name);
                  return {
                    id: updatedUser.id,
                    name: updatedUser.name ?? "—",
                    age: updatedUser.age ?? 0,
                    strain: updatedUser.strain ?? "—",
                    experienceLevel: updatedUser.experience_level ?? "Beginner",
                    bio: updatedUser.bio ?? "",
                    preferredStrains: updatedUser.preferred_strains ?? [],
                    consumptionMethods: updatedUser.consumption_methods ?? [],
                    cultivationInterest: updatedUser.cultivation_interest ?? false,
                    image:
                      updatedUser.image_url &&
                      updatedUser.image_url.trim().length > 0
                        ? updatedUser.image_url
                        : PLACEHOLDER_300,
                    subscriptionTier: updatedUser.subscription_tier,
                    subscriptionStatus: updatedUser.subscription_status,
                    isBoosted: updatedUser.boost_active_until ? new Date(updatedUser.boost_active_until) > new Date() : false,
                    blazeLevel: updatedUser.blaze_level ?? 1,
                  };
                }
                return profile;
              });
              return updated.sort((a, b) => {
                if (a.isBoosted && !b.isBoosted) return -1;
                if (!a.isBoosted && b.isBoosted) return 1;
                return 0;
              });
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Realtime subscription active for users table");
          } else if (status === "CHANNEL_ERROR") {
            console.error("Failed to subscribe to users table updates");
          } else if (status === "TIMED_OUT") {
            console.error("Realtime subscription timed out");
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    init().catch((err) => {
      console.error("Failed to initialize swipe screen:", err);
      setLoading(false);
      setInitialLoad(false);
      setProfiles([]);
    }).finally(() => {
      clearTimeout(loadingTimeout);
    });

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, []);

  useEffect(() => {
    loadHeaderPhoto();
    checkDailyLimit();
  }, [loadHeaderPhoto, checkDailyLimit]);

  useFocusEffect(
    useCallback(() => {
      updateUserActivity();
      if (shouldAdvance) {
        setShouldAdvance(false);
        if (index < profiles.length - 1) {
          setIndex((i) => i + 1);
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

  useEffect(() => {
    const trackProfileView = async () => {
      const current = profiles[index];
      const myUserId = myUserIdRef.current;

      if (!current || !myUserId || current.id === myUserId) {
        return;
      }

      try {
        const { error } = await supabase
          .from('profile_views')
          .insert({
            viewer_id: myUserId,
            viewed_user_id: current.id,
          });

        if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
          console.error('Failed to track profile view:', error);
        }
      } catch (err) {
        console.error('Error tracking profile view:', err);
      }
    };

    if (profiles.length > 0 && index < profiles.length) {
      trackProfileView();
    }
  }, [index, profiles]);

  const handleSwipeRight = async () => {
    const current = profiles[index];
    if (!current) return;

    if (!isPremium && swipesRemaining <= 0) {
      setShowLimitReached(true);
      return;
    }

    if (!likedUsers.includes(current.id)) {
      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (myUserId) {
        const { error: insertError } = await supabase.from("likes").insert({
          user_id: myUserId,
          liked_user_id: current.id,
        });

        if (insertError) {
          console.error("Failed to insert like:", insertError);
          return;
        }

        setLikedUsers((prev) => [...prev, current.id]);
        setLastSwipeAction({ type: "like", userId: current.id });

        if (!isPremium) {
          await supabase.rpc("increment_daily_swipes", { p_user_id: myUserId });
          setSwipesRemaining((prev) => Math.max(0, prev - 1));
        }

        const { data: theirLike } = await supabase
          .from("likes")
          .select("id")
          .eq("user_id", current.id)
          .eq("liked_user_id", myUserId)
          .maybeSingle();

        if (theirLike) {
          setShouldAdvance(true);
          router.push(`/match?matchId=${current.id}`);
          return;
        }
      }
    }

    handleNext();
  };

  const handleSwipeLeft = async () => {
    if (cooldownActive) return;

    const current = profiles[index];
    if (!current) return;

    if (!isPremium && swipesRemaining <= 0) {
      setShowLimitReached(true);
      return;
    }

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

    if (!passedUsers.includes(current.id)) {
      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (myUserId) {
        const { error: insertError } = await supabase.from("passes").insert({
          user_id: myUserId,
          passed_user_id: current.id,
        });

        if (insertError) {
          console.error("Failed to insert pass:", insertError);
        } else {
          setPassedUsers((prev) => [...prev, current.id]);
          setLastSwipeAction({ type: "pass", userId: current.id });

          if (!isPremium) {
            await supabase.rpc("increment_daily_swipes", { p_user_id: myUserId });
            setSwipesRemaining((prev) => Math.max(0, prev - 1));
          }
        }
      }
    }

    handleNext();
  };

  const handleNext = () => {
    if (index < profiles.length - 1) {
      setIndex((i) => i + 1);
    }
  };

  const handleButtonSwipeRight = () => {
    handleSwipeRight();
  };

  const handleButtonSwipeLeft = () => {
    handleSwipeLeft();
  };

  const handleUndo = async () => {
    if (!lastSwipeAction || !isPremium) return;

    const { data: authData } = await supabase.auth.getUser();
    const myUserId = authData?.user?.id;

    if (!myUserId) return;

    try {
      if (lastSwipeAction.type === "like") {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", myUserId)
          .eq("liked_user_id", lastSwipeAction.userId);

        if (!error) {
          setLikedUsers((prev) => prev.filter((id) => id !== lastSwipeAction.userId));
        } else {
          console.error("Failed to undo like:", error);
        }
      } else if (lastSwipeAction.type === "pass") {
        const { error } = await supabase
          .from("passes")
          .delete()
          .eq("user_id", myUserId)
          .eq("passed_user_id", lastSwipeAction.userId);

        if (!error) {
          setPassedUsers((prev) => prev.filter((id) => id !== lastSwipeAction.userId));
        } else {
          console.error("Failed to undo pass:", error);
        }
      }

      if (index > 0) {
        setIndex((i) => i - 1);
      }

      setLastSwipeAction(null);
    } catch (error) {
      console.error("Error undoing swipe:", error);
    }
  };

  const visibleProfiles = profiles.slice(index, index + 3);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00FF7F" />
            <Text style={styles.loadingText}>Loading profiles...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {siteStatus.enabled && (
        <View style={[
          styles.statusBanner,
          siteStatus.type === 'warning' && styles.statusBannerWarning,
          siteStatus.type === 'info' && styles.statusBannerInfo,
          siteStatus.type === 'error' && styles.statusBannerError,
        ]}>
          <Text style={styles.statusText}>{siteStatus.message}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        scrollEnabled={false}
      >
        <View style={styles.container}>
          <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <Text style={styles.logo}>🔥</Text>
          <Text style={styles.brandName} numberOfLines={1}>BlazeMates</Text>
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
            <Text style={styles.navLink}>
              {isSmallPhone ? "Matches" : "💚 Matches"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Text style={styles.navLink} numberOfLines={1}>
              {isSmallPhone ? "⚙️" : "⚙️ Settings"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardContainer}>
        {initialLoad ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00FF7F" />
            <Text style={styles.loadingText}>Loading profiles...</Text>
          </View>
        ) : visibleProfiles.length > 0 && !showLimitReached ? (
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
        ) : !showLimitReached ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>🔥</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {profiles.length === 0
                ? "No Profiles Available"
                : "That's Everyone For Now!"}
            </Text>
            <Text style={styles.emptyText}>
              {profiles.length === 0
                ? "No users found yet. Check back soon!"
                : "You've seen all available profiles. New people join all the time, so check back later!"}
            </Text>
          </View>
        ) : null}
      </View>

      {!initialLoad && visibleProfiles.length > 0 && !showLimitReached && (
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

          {canUndo && lastSwipeAction && (
            <TouchableOpacity
              style={[styles.actionButton, styles.undoButton]}
              onPress={handleUndo}
            >
              <Text style={styles.buttonIcon}>↶</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={handleButtonSwipeRight}
          >
            <Text style={styles.buttonIcon}>♥</Text>
          </TouchableOpacity>
        </View>
      )}

      {!initialLoad && cooldownActive && (
        <View style={styles.cooldownBanner}>
          <Text style={styles.cooldownText}>
            ⏳ Slow down! You're swiping too fast.
          </Text>
        </View>
      )}

      {!initialLoad && !isPremium && swipesRemaining >= 0 && swipesRemaining <= 10 && !showLimitReached && (
        <View style={styles.swipeCounterBanner}>
          <Text style={styles.swipeCounterText}>
            {swipesRemaining} swipes remaining today
          </Text>
        </View>
      )}

      {showLimitReached && (
        <View style={styles.limitReachedOverlay}>
          <View style={styles.limitReachedModal}>
            <Text style={styles.limitReachedTitle}>Daily Limit Reached</Text>
            <Text style={styles.limitReachedText}>
              You've used all your swipes for today. Upgrade to BlazeMates Premium for unlimited swipes!
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push("/subscription")}
            >
              <Text style={styles.upgradeButtonText}>Support the Community</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => setShowLimitReached(false)}
            >
              <Text style={styles.dismissButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

          <Text style={styles.footer}>
            BlazeMates LLC v1.0.0 (c) 2025 BlazeMates LLC. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#0f0f0f",
  },
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    paddingVertical: isSmallPhone ? 10 : 12,
    paddingHorizontal: navPadding,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  navLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: isSmallPhone ? 4 : 8,
    flex: isSmallPhone ? 0.9 : 1,
    minWidth: 0,
  },
  logo: {
    fontSize: logoSize,
  },
  brandName: {
    fontSize: brandFontSize,
    fontWeight: "bold",
    color: "#00FF7F",
    flexShrink: 1,
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: isSmallPhone ? 8 : navGap,
    flex: isSmallPhone ? 2 : 2,
    justifyContent: "center",
    minWidth: 0,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    flex: isSmallPhone ? 0.5 : undefined,
    justifyContent: "flex-end",
    minWidth: isSmallPhone ? 32 : 0,
  },
  navLink: {
    color: "#fff",
    fontSize: navFontSize,
    fontWeight: "500",
    flexShrink: 1,
  },
  navProfilePic: {
    width: navProfilePicSize,
    height: navProfilePicSize,
    borderRadius: navProfilePicSize / 2,
    borderColor: "#00FF7F",
    borderWidth: 2,
  },
  cardContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: isSmallPhone ? 12 : 20,
    paddingHorizontal: isSmallPhone ? 8 : 0,
    position: "relative",
  },
  cardWrapper: {
    width: cardWidth,
    maxWidth: 440,
    height: isSmallPhone ? screenHeight * 0.5 : screenHeight * 0.55,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1e1e1e",
    width: cardWidth,
    maxWidth: 440,
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0px 5px 10px 0px rgba(0, 255, 127, 0.3)",
    elevation: 5,
  },
  image: {
    width: "100%",
    height: isSmallPhone ? screenHeight * 0.3 : screenHeight * 0.35,
    resizeMode: "cover",
  },
  cardInfo: {
    padding: cardInfoPadding,
    backgroundColor: "#1e1e1e",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: isSmallPhone ? 4 : 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: cardNameFontSize,
    fontWeight: "600",
    color: "#fff",
    marginRight: 10,
  },
  verified: { fontSize: isSmallPhone ? 16 : 18, color: "#00FF7F" },
  bio: {
    fontSize: cardBioFontSize,
    color: "#ccc",
    marginVertical: isSmallPhone ? 6 : 8,
  },
  meta: {
    fontSize: cardMetaFontSize,
    color: "#aaa",
    marginTop: 4,
  },
  experienceTag: {
    backgroundColor: "#2e2e2e",
    color: "#00FF7F",
    paddingVertical: isSmallPhone ? 3 : 4,
    paddingHorizontal: isSmallPhone ? 10 : 12,
    borderRadius: 16,
    fontSize: isSmallPhone ? 11 : 12,
    fontWeight: "600",
    overflow: "hidden",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: "#1a1a1a",
    color: "#ccc",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontSize: isSmallPhone ? 10 : 11,
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "#333",
  },
  likeStamp: {
    position: "absolute",
    top: isSmallPhone ? 40 : 50,
    left: isSmallPhone ? 20 : 30,
    borderWidth: isSmallPhone ? 3 : 4,
    borderColor: "#00FF7F",
    borderRadius: 8,
    padding: isSmallPhone ? 6 : 8,
    transform: [{ rotate: "-20deg" }],
    zIndex: 10,
  },
  likeText: {
    fontSize: isSmallPhone ? 28 : 32,
    fontWeight: "bold",
    color: "#00FF7F",
    letterSpacing: 2,
  },
  nopeStamp: {
    position: "absolute",
    top: isSmallPhone ? 40 : 50,
    right: isSmallPhone ? 20 : 30,
    borderWidth: isSmallPhone ? 3 : 4,
    borderColor: "#FF3B5C",
    borderRadius: 8,
    padding: isSmallPhone ? 6 : 8,
    transform: [{ rotate: "20deg" }],
    zIndex: 10,
  },
  nopeText: {
    fontSize: isSmallPhone ? 28 : 32,
    fontWeight: "bold",
    color: "#FF3B5C",
    letterSpacing: 2,
  },
  boostBadge: {
    position: "absolute",
    top: isSmallPhone ? 12 : 16,
    right: isSmallPhone ? 12 : 16,
    backgroundColor: "rgba(255, 215, 0, 0.95)",
    paddingHorizontal: isSmallPhone ? 8 : 10,
    paddingVertical: isSmallPhone ? 4 : 6,
    borderRadius: 12,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  boostBadgeText: {
    fontSize: isSmallPhone ? 10 : 11,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: isSmallPhone ? 16 : 24,
    gap: actionButtonGap,
    paddingHorizontal: 16,
  },
  actionButton: {
    width: actionButtonSize,
    height: actionButtonSize,
    borderRadius: actionButtonSize / 2,
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.3)",
    elevation: 4,
  },
  nopeButton: {
    backgroundColor: "#FF3B5C",
  },
  likeButton: {
    backgroundColor: "#00FF7F",
  },
  undoButton: {
    backgroundColor: "#FFD700",
  },
  buttonIcon: {
    fontSize: isSmallPhone ? 24 : 28,
    color: "#fff",
    fontWeight: "bold",
  },
  cooldownBanner: {
    marginTop: isSmallPhone ? 12 : 16,
    backgroundColor: "#2e2e2e",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 16,
  },
  cooldownText: {
    color: "#FF3B5C",
    fontSize: isSmallPhone ? 12 : 14,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#2a2a2a",
  },
  emptyIconText: {
    fontSize: 48,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: isSmallPhone ? 20 : 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: "#888",
    fontSize: isSmallPhone ? 14 : 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 400,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: "#00FF7F",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    boxShadow: "0 2px 4px rgba(0, 255, 127, 0.3)",
    elevation: 4,
  },
  emptyButtonText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#00FF7F",
    fontSize: isSmallPhone ? 16 : 18,
    fontWeight: "600",
    marginTop: 16,
  },
  footer: {
    color: "#777",
    paddingVertical: isSmallPhone ? 16 : 20,
    paddingHorizontal: 16,
    fontSize: isSmallPhone ? 10 : 12,
    textAlign: "center",
  },
  swipeCounterBanner: {
    marginTop: isSmallPhone ? 8 : 12,
    backgroundColor: "#2e2e2e",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginHorizontal: 16,
    alignSelf: "center",
  },
  swipeCounterText: {
    color: "#00FF7F",
    fontSize: isSmallPhone ? 11 : 13,
    fontWeight: "600",
    textAlign: "center",
  },
  limitReachedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  limitReachedModal: {
    backgroundColor: "#1e1e1e",
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    width: "90%",
    borderWidth: 2,
    borderColor: "#00FF7F",
  },
  limitReachedTitle: {
    fontSize: isSmallPhone ? 20 : 24,
    fontWeight: "bold",
    color: "#00FF7F",
    textAlign: "center",
    marginBottom: 12,
  },
  limitReachedText: {
    fontSize: isSmallPhone ? 14 : 16,
    color: "#ccc",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: "#121212",
    fontSize: isSmallPhone ? 15 : 16,
    fontWeight: "700",
    textAlign: "center",
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dismissButtonText: {
    color: "#888",
    fontSize: isSmallPhone ? 14 : 15,
    fontWeight: "600",
    textAlign: "center",
  },
  statusBanner: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBannerWarning: {
    backgroundColor: "#FFA500",
  },
  statusBannerInfo: {
    backgroundColor: "#00A3E0",
  },
  statusBannerError: {
    backgroundColor: "#FF4444",
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
