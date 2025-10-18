// © 2025 Benjamin Hawk. All rights reserved.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
const scale = screenWidth / 490;
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
  // Removed unused avatarVer state
  const [skipCount, setSkipCount] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);

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
      // local state
      const ageStored = await AsyncStorage.getItem("userAge");
      if (ageStored) setUserAge(parseInt(ageStored));

      const profileData = await AsyncStorage.getItem("userProfile");
      let userLookingFor: Looking = "both";
      if (profileData) {
        const parsed = JSON.parse(profileData);
        userLookingFor = (parsed.lookingFor as Looking) || "both";
        if (parsed.profileImage) setProfilePhoto(parsed.profileImage);
      }

      const myUserId = await AsyncStorage.getItem("userId");

      // fetch users
      const { data, error } = await supabase
        .from("users")
        .select("id,name,age,bio,strain,style,looking_for,image_url");

      if (error) {
        console.error("Failed to fetch users:", error);
        setProfiles([]);
        setIndex(0);
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
        .filter(
          (p) =>
            userLookingFor === "both" ||
            p.lookingFor === userLookingFor ||
            p.lookingFor === "both"
        );

      setProfiles(filtered);
      setIndex(0);
    };

    init();
  }, []);

  useEffect(() => {
    loadHeaderPhoto();
  }, [loadHeaderPhoto]);

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
    else router.push({ pathname: "/chat", params: { threadId: "global-chat" } });
  };

  const handleSwipeRight = () => {
    const current = profiles[index];
    if (!current) return;

    if (!likedUsers.includes(current.id)) {
      setLikedUsers((prev) => [...prev, current.id]);
      // demo "match" flow (replace with real mutual matching later)
      router.push(`/match?matchId=${current.id}`);
      return;
    }

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ position: "absolute", left: -100, top: 0, zIndex: 2 }}>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Text
              style={{
                color: "#00FF7F",
                fontWeight: "bold",
                fontSize: 16,
                margin: 10,
              }}
            >
              ⚙️ settings
            </Text>
          </TouchableOpacity>
        </View>
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
        onPress={() => router.push({ pathname: "/chat", params: { threadId: "global-chat" } })}
      >
        <Text style={styles.profileBtnText}>💬 Chat</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    alignItems: "center",
    paddingTop: Math.round(60 * scale),
    paddingHorizontal: Math.round(20 * scale),
  },
  header: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Math.round(20 * scale),
    marginTop: Math.round(10 * scale),
  },
  profilePicLarge: {
    width: Math.round(90 * scale),
    height: Math.round(90 * scale),
    borderRadius: Math.round(45 * scale),
    borderColor: "#00FF7F",
    borderWidth: 2,
    marginBottom: Math.round(8 * scale),
  },
  title: {
    fontSize: Math.round(26 * scale),
    color: "#00FF7F",
    fontWeight: "bold",
  },
  profileBtn: {
    backgroundColor: "#1f1f1f",
    borderRadius: Math.round(25 * scale),
    paddingVertical: Math.round(10 * scale),
    paddingHorizontal: Math.round(20 * scale),
    marginBottom: Math.round(20 * scale),
  },
  profileBtnText: { color: "#fff", fontSize: Math.round(16 * scale) },
  card: {
    backgroundColor: "#1e1e1e",
    width: screenWidth * 0.9,
    borderRadius: Math.round(20 * scale),
    padding: Math.round(20 * scale),
    alignItems: "center",
    shadowColor: "#00FF7F",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: Math.round(10 * scale),
    elevation: 5,
  },
  image: {
    width: Math.min(250 * scale, screenWidth * 0.7),
    height: Math.min(250 * scale, screenWidth * 0.7),
    borderRadius: Math.round(20 * scale),
    marginBottom: Math.round(15 * scale),
  },
  name: {
    fontSize: Math.round(24 * scale),
    fontWeight: "600",
    color: "#fff",
    marginRight: 10,
  },
  verified: { fontSize: Math.round(18 * scale), color: "#00FF7F" },
  bio: {
    fontSize: Math.round(16 * scale),
    color: "#ccc",
    marginVertical: Math.round(10 * scale),
    textAlign: "center",
  },
  meta: {
    fontSize: Math.round(14 * scale),
    color: "#aaa",
    marginBottom: Math.round(15 * scale),
  },
  row: {
    flexDirection: "row",
    marginTop: Math.round(10 * scale),
    alignItems: "center",
  },
  button: {
    backgroundColor: "#00FF7F",
    padding: Math.round(14 * scale),
    borderRadius: Math.round(50 * scale),
    marginHorizontal: Math.round(20 * scale),
  },
  buttonText: { fontSize: Math.round(20 * scale) },
  lookingForTag: {
    backgroundColor: "#2e2e2e",
    color: "#00FF7F",
    paddingVertical: Math.round(6 * scale),
    paddingHorizontal: Math.round(14 * scale),
    borderRadius: Math.round(20 * scale),
    fontSize: Math.round(13 * scale),
    fontWeight: "600",
    overflow: "hidden",
  },
  emptyState: { marginTop: Math.round(80 * scale), alignItems: "center" },
  emptyText: { color: "#aaa", fontSize: Math.round(16 * scale) },
});

