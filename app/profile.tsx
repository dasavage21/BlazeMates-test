// © 2025 Benjamin Hawk. All rights reserved.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

export default function ProfileScreen() {
  const router = useRouter();
  const [age, setAge] = useState<number | null>(null);
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    strain: "",
    style: "",
    lookingFor: "",
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      let localAge: number | null = null;

      const stored = await AsyncStorage.getItem("userProfile");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProfile(parsed);
        if (parsed?.age !== null && parsed?.age !== undefined) {
          const parsedAge = Number(parsed.age);
          if (!Number.isNaN(parsedAge)) {
            localAge = parsedAge;
            setAge(parsedAge);
          }
        }
      }

      const storedAge = await AsyncStorage.getItem("userAge");
      if (storedAge) {
        const parsedAge = parseInt(storedAge);
        if (!Number.isNaN(parsedAge)) {
          localAge = parsedAge;
          setAge(parsedAge);
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const { data, error } = await supabase
          .from("users")
          .select("age, name, bio, strain, style, looking_for, image_url")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) {
          if (data.age !== null && data.age !== undefined) {
            setAge(data.age);
          } else if (localAge !== null) {
            await supabase
              .from("users")
              .update({ age: localAge })
              .eq("id", userId);
            setAge(localAge);
          }

          setProfile({
            name: data.name || "",
            bio: data.bio || "",
            strain: data.strain || "",
            style: data.style || "",
            lookingFor: data.looking_for || "",
          });
          if (data.image_url) {
            setProfileImage(data.image_url);
          }
        }
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const stored = await AsyncStorage.getItem("userProfile");
        if (stored) {
          const data = JSON.parse(stored);
          setProfileImage(data.profileImage ?? null);
        }
      })();
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={{ uri: profileImage || "https://via.placeholder.com/250" }}
        style={styles.avatar}
      />

      <Text style={styles.name}>
        {profile.name || "BlazeMate"}
        {age !== null && age >= 21 && (
          <Text style={styles.verified}> ✅ Verified</Text>
        )}
      </Text>

      <Text style={styles.ageText}>
        Age: {age !== null ? age : "Loading..."}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name: {profile.name || "Not set"}</Text>
        <Text style={styles.label}>Bio: {profile.bio || "Not set"}</Text>
        <Text style={styles.label}>Strain: {profile.strain || "Not set"}</Text>
        <Text style={styles.label}>Style: {profile.style || "Not set"}</Text>
        <Text style={styles.label}>
          Looking For:{" "}
          {profile.lookingFor === "smoke"
            ? "🌿 Just Wanna Smoke"
            : profile.lookingFor === "hookup"
            ? "🍑 Just Looking to Hook Up"
            : profile.lookingFor === "both"
            ? "🌿+🍑 Both"
            : "Not set"}
        </Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push("/profile-edit")}
        >
          <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
        </TouchableOpacity>
      </View>
      

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/swipe")}
      >
        <Text style={styles.buttonText}>🔥 Back to Swiping</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    backgroundColor: "#121212",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 20,
    borderColor: "#00FF7F",
    borderWidth: 2,
  },
  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
  },
  verified: {
    fontSize: 18,
    color: "#00FF7F",
    marginLeft: 6,
  },
  ageText: {
    fontSize: 18,
    color: "#ccc",
    marginBottom: 10,
  },
  bio: {
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
    marginHorizontal: 30,
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#00FF7F",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 10,
  },
  buttonText: {
    color: "#121212",
    fontWeight: "600",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#1f1f1f",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    marginBottom: 30,
    shadowColor: "#00FF7F",
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  label: {
    color: "#eee",
    fontSize: 16,
    marginBottom: 6,
  },
  editButton: {
    backgroundColor: "#00FF7F",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 25,
    marginTop: 15,
    alignSelf: "center",
  },
  editButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 15,
  },
});
