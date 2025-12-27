// © 2025 Benjamin Hawk. All rights reserved.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

const screenWidth = Dimensions.get("window").width;
const cardWidth = Math.min(screenWidth * 0.9, 440);
const isDesktop = screenWidth >= 768;
const profilePicSize = isDesktop ? 90 : 70;
const titleFontSize = isDesktop ? 26 : 22;
const buttonFontSize = isDesktop ? 16 : 15;
const settingsFontSize = isDesktop ? 16 : 14;
const containerPaddingTop = isDesktop ? 60 : 48;
const containerPaddingHorizontal = isDesktop ? 20 : 16;

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

export default function SwipeScreen() {
  const router = useRouter();
  const PLACEHOLDER_50 = "https://via.placeholder.com/50";
  const PLACEHOLDER_300 = "https://via.placeholder.com/300";
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cooldownAnim = useRef(new Animated.Value(0)).current;

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
        setProfilePhoto(`${url}?t=${ts}`); // cache-bust
      }
    );
    return () => sub.remove();
  }, []);

  // Load header photo on focus or mount (keeps your existing logic)
  const loadHeaderPhoto = useCallback(async () => {
    try {
      // 1) authed user's image_url
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

      // 2) local cache from AsyncStorage
      const stored = await AsyncStorage.getItem("userProfile");
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.profileImage) {
        const ts = (await AsyncStorage.getItem("avatarVersion")) || "";
        setProfilePhoto(
          ts ? `${parsed.profileImage}?t=${ts}` : parsed.profileImage
        );
        return;
      }

      // 3) pending local file:// (not signed in yet)
      const pending = await AsyncStorage.getItem("pendingAvatarUri");
      if (pending) {
        setProfilePhoto(pending || PLACEHOLDER_50); // file:// shows fine in the circle
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

      // Load existing likes from database
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

  useEffect(() => {
    Animated.timing(cooldownAnim, {
      toValue: cooldownActive ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [cooldownActive, cooldownAnim]);

  const currentProfile = useMemo(() => profiles[index], [profiles, index]);

  const handleNext = () => {
    if (index < profiles.length - 1) setIndex((i) => i + 1);
    else router.push("/matches");
  };

  const handleSwipeRight = async () => {
    const current = profiles[index];
    if (!current) return;

    if (!likedUsers.includes(current.id)) {
      setLikedUsers((prev) => [...prev, current.id]);

      // Save like to database
      const { data: authData } = await supabase.auth.getUser();
      const myUserId = authData?.user?.id;

      if (myUserId) {
        await supabase.from("likes").insert({
          user_id: myUserId,
          liked_user_id: current.id,
        });
      }

      // Mark that we should advance when returning from match screen
      setShouldAdvance(true);

      // Show match screen
      router.push(`/match?matchId=${current.id}`);
      return;
    }

    // This should not happen anymore, but keep as fallback
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(handleNext);
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

    if (index < profiles.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setIndex((i) => i + 1));
    }
  };

  const renderLookingForTag = (type: Looking) => {
    if (type === "smoke")
      return <Text style={styles.lookingForTag}>🌿 Just Wanna Smoke</Text>;
    if (type === "hookup")
      return (
        <Text style={styles.lookingForTag}>🍑 Just Looking to Hook Up</Text>
      );
    return <Text style={styles.lookingForTag}>🌿+🍑 Both</Text>;
  };

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
      <View style={styles.settingsContainer}>
        <TouchableOpacity onPress={() => router.push("/settings")}>
          <Text style={styles.settingsText}>⚙️ settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Image
            key={profilePhoto}
            source={{ uri: profilePhoto || PLACEHOLDER_50 }}
            style={styles.profilePicLarge}
          />
        </TouchableOpacity>
        <Text style={styles.title}>🔥 BlazeMates</Text>
      </View>

      <TouchableOpacity
        style={styles.profileBtn}
        onPress={() => router.push("/matches")}
      >
        <Text style={styles.profileBtnText}>💚 Your Matches</Text>
      </TouchableOpacity>

      {currentProfile ? (
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Image
            key={currentProfile?.id ?? "card"} // re-mount per person
            source={{
              uri:
                currentProfile?.image && currentProfile.image.trim().length > 10
                  ? currentProfile.image
                  : PLACEHOLDER_300,
            }}
            style={styles.image}
          />

          <View style={styles.row}>
            <Text style={styles.name}>
              {currentProfile.name}, {currentProfile.age}
              {userAge && userAge >= 21 && (
                <Text style={styles.verified}> ✅</Text>
              )}
            </Text>
            {renderLookingForTag(currentProfile.lookingFor)}
          </View>

          <Text style={styles.bio}>{currentProfile.bio}</Text>
          <Text style={styles.meta}>
            Strain: {currentProfile.strain} • Style: {currentProfile.style}
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.button,
                cooldownActive && { backgroundColor: "#555" },
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
            <Text style={{ color: "#ff5555" }}>
              ⏳ Slow down! You&apos;re swiping too fast.
            </Text>
          </Animated.View>
        </Animated.View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            😕 No users found yet. Check back soon!
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
    alignItems: "center",
    paddingTop: containerPaddingTop,
    paddingHorizontal: containerPaddingHorizontal,
  },
  settingsContainer: {
    alignSelf: "flex-start",
    marginBottom: isDesktop ? 10 : 8,
  },
  settingsText: {
    color: "#00FF7F",
    fontWeight: "bold",
    fontSize: settingsFontSize,
  },
  header: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: isDesktop ? 20 : 16,
    marginTop: isDesktop ? 10 : 0,
  },
  profilePicLarge: {
    width: profilePicSize,
    height: profilePicSize,
    borderRadius: profilePicSize / 2,
    borderColor: "#00FF7F",
    borderWidth: 2,
    marginBottom: isDesktop ? 8 : 6,
  },
  title: {
    fontSize: titleFontSize,
    color: "#00FF7F",
    fontWeight: "bold",
  },
  profileBtn: {
    backgroundColor: "#1f1f1f",
    borderRadius: isDesktop ? 25 : 20,
    paddingVertical: isDesktop ? 10 : 8,
    paddingHorizontal: isDesktop ? 20 : 16,
    marginBottom: isDesktop ? 20 : 16,
  },
  profileBtnText: { color: "#fff", fontSize: buttonFontSize },
  card: {
    backgroundColor: "#1e1e1e",
    width: cardWidth,
    maxWidth: 440,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#00FF7F",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5,
  },
  image: {
    width: Math.min(250, cardWidth * 0.7),
    height: Math.min(250, cardWidth * 0.7),
    borderRadius: 20,
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    marginRight: 10,
  },
  verified: { fontSize: 18, color: "#00FF7F" },
  bio: {
    fontSize: 16,
    color: "#ccc",
    marginVertical: 10,
    textAlign: "center",
  },
  meta: {
    fontSize: 14,
    color: "#aaa",
    marginBottom: 15,
  },
  row: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center",
  },
  button: {
    backgroundColor: "#00FF7F",
    padding: 14,
    borderRadius: 50,
    marginHorizontal: 20,
  },
  buttonText: { fontSize: 20 },
  lookingForTag: {
    backgroundColor: "#2e2e2e",
    color: "#00FF7F",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: "600",
    overflow: "hidden",
  },
  emptyState: { marginTop: isDesktop ? 80 : 60, alignItems: "center", paddingHorizontal: 20 },
  emptyText: { color: "#aaa", fontSize: isDesktop ? 16 : 15, textAlign: "center" },
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
    marginTop: 30,
    fontSize: 12,
    textAlign: "center",
    position: "absolute",
    bottom: 20,
  },
});

