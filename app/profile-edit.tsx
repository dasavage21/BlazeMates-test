// app/profile-edit.tsx
// © 2025 Benjamin Hawk. All rights reserved.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { Camera } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../supabaseClient";
import { handleRefreshTokenError } from "../lib/authSession";
import { mergeUserRow } from "../lib/userStore";
type Looking = "smoke" | "hookup" | "both";
const PENDING_KEY = "pendingAvatarUri";
const PROFILE_KEY = "userProfile";

export default function ProfileEditScreen() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri?: string }>();

  // form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [strain, setStrain] = useState("");
  const [style, setStyle] = useState("");
  const [lookingFor, setLookingFor] = useState<Looking>("smoke");
  const [age, setAge] = useState<number | null>(null);

  // image can be a public URL (after upload) or a local file:// for preview
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [hasCamPermission, setHasCamPermission] = useState<boolean | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);

  /** Upload a local file:// uri to Storage and update users.image_url. */
  const uploadAvatarAndSave = useCallback(async (localUri: string) => {
    setProfileImage(localUri);
    setUploading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData?.user;
      if (!user) {
        const existing = JSON.parse(
          (await AsyncStorage.getItem(PROFILE_KEY)) || "{}"
        );
        await AsyncStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({ ...existing, profileImage: localUri })
        );
        await AsyncStorage.setItem(PENDING_KEY, localUri);
        DeviceEventEmitter.emit("avatar-updated", {
          url: localUri,
          ts: Date.now(),
        });
        Alert.alert("Saved locally", "Sign in to sync your photo.");
        return;
      }

      const path = `${user.id}/avatar.jpg`;

      let bytes: Uint8Array;

      if (Platform.OS === "web") {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      } else {
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      }

      let { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, bytes, {
          upsert: true,
          cacheControl: "3600",
          contentType: "image/jpeg",
        });

      if (uploadErr?.message?.includes("The resource already exists")) {
        const { error: updateErr } = await supabase.storage
          .from("avatars")
          .update(path, bytes, {
            cacheControl: "3600",
            contentType: "image/jpeg",
          });
        if (updateErr) throw updateErr;
        uploadErr = null;
      }
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: dbErr } = await supabase
        .from("users")
        .update({ image_url: publicUrl })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      const displayUrl = `${publicUrl}?t=${Date.now()}`;
      const existing = JSON.parse(
        (await AsyncStorage.getItem(PROFILE_KEY)) || "{}"
      );
      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ ...existing, profileImage: displayUrl })
      );
      await AsyncStorage.removeItem(PENDING_KEY);
      setProfileImage(displayUrl);

      DeviceEventEmitter.emit("avatar-updated", {
        url: publicUrl,
        ts: Date.now(),
      });
    } catch (error) {
      const handled = await handleRefreshTokenError(error);
      if (handled) {
        Alert.alert(
          "Session expired",
          "Please sign in again to sync your photo."
        );
        return;
      }
      console.warn("uploadAvatarAndSave error", error);
      const message =
        (error as { message?: string })?.message ??
        "Something went wrong uploading your photo.";
      Alert.alert("Error", message);
    } finally {
      setUploading(false);
    }
  }, [setProfileImage]);

  /** If user is authed and a local avatar was queued earlier, sync it now. */
  const syncPendingAvatarIfAuthed = useCallback(async () => {
    try {
      const pending = await AsyncStorage.getItem(PENDING_KEY);
      if (!pending) return;

      const { data } = await supabase.auth.getSession();
      if (!data?.session) return;

      setSyncing(true);
      await uploadAvatarAndSave(pending);
    } catch (e) {
      const handled = await handleRefreshTokenError(e);
      if (!handled) {
        console.warn("Pending avatar sync failed", e);
      } else {
        Alert.alert("Session expired", "Please sign in again to finish syncing.");
      }
    } finally {
      setSyncing(false);
    }
  }, [uploadAvatarAndSave]);

  // If we returned from /camera with a new photo
  useEffect(() => {
    if (photoUri) {
      // Only upload and update via your helper
      uploadAvatarAndSave(photoUri);
    }
  }, [photoUri, uploadAvatarAndSave]);

  // Load profile + ask for camera permission + attempt pending sync
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem("userProfile");
        if (stored) {
          const data = JSON.parse(stored);
          setName(data.name ?? "");
          setBio(data.bio ?? "");
          setStrain(data.strain ?? "");
          setStyle(data.style ?? "");
          setLookingFor((data.lookingFor as Looking) ?? "smoke");
          setProfileImage(data.profileImage ?? null);
        }
      } catch (e) {
        console.warn("Failed to load profile", e);
      }

      try {
        const storedAge = await AsyncStorage.getItem("userAge");
        if (storedAge) {
          const parsedAge = parseInt(storedAge, 10);
          if (!Number.isNaN(parsedAge)) {
            setAge(parsedAge);
          }
        }
      } catch (e) {
        console.warn("Failed to load stored age", e);
      }

      try {
        const { data: authInfo } = await supabase.auth.getUser();
        const authedUser = authInfo?.user;
        if (authedUser) {
          const { data: userRow, error } = await supabase
            .from("users")
            .select("age")
            .eq("id", authedUser.id)
            .maybeSingle();
          if (!error && userRow?.age !== null && userRow?.age !== undefined) {
            const remoteAge = Number(userRow.age);
            if (!Number.isNaN(remoteAge)) {
              setAge(remoteAge);
              await AsyncStorage.setItem("userAge", remoteAge.toString());
            }
          } else if (!error && (userRow?.age === null || userRow?.age === undefined) && age !== null) {
            await supabase
              .from("users")
              .update({ age })
              .eq("id", authedUser.id);
          }
        }
      } catch (e) {
        const handled = await handleRefreshTokenError(e);
        if (!handled) {
          console.warn("Failed to refresh age from Supabase", e);
        } else {
          Alert.alert("Session expired", "Please sign in again to refresh data.");
        }
      }

      try {
        if (Platform.OS === "web") {
          setHasCamPermission(true);
        } else {
          const { status } = await Camera.requestCameraPermissionsAsync();
          setHasCamPermission(status === "granted");
        }
      } catch {
        setHasCamPermission(false);
      }

      // Try to synchronize any queued local photo
      syncPendingAvatarIfAuthed();
    };
    init();
  }, [syncPendingAvatarIfAuthed]);

  // Focus effect to update profile image from storage
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

  const openCamera = () => {
    if (!hasCamPermission) {
      Alert.alert(
        "Permission required",
        "Enable camera access in Settings to take a profile photo."
      );
      return;
    }
    router.push("/camera"); // navigates to app/camera.tsx
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Name is required!");
      return;
    }

    setSaving(true);

    try {
      // Always store a local copy
      const newProfile = {
        name,
        bio,
        strain,
        style,
        lookingFor,
        profileImage,
        age,
      };
      await AsyncStorage.setItem("userProfile", JSON.stringify(newProfile));
      if (age !== null) {
        await AsyncStorage.setItem("userAge", age.toString());
      }

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const authedUser = authData?.user;

        if (!authedUser) {
          Alert.alert(
            "Saved locally",
            "Sign in to sync your profile to the cloud."
          );
        } else {
          const { error } = await mergeUserRow(supabase, authedUser.id, {
            name,
            bio,
            strain,
            style,
            looking_for: lookingFor,
            age: age ?? null,
            image_url: profileImage ?? null,
          });

          if (error) {
            console.error(error);
            Alert.alert(
              "Saved locally",
              "Online save failed (will retry later)."
            );
          } else {
            Alert.alert("Saved!", "Your profile has been updated.");
          }
        }
      } catch (error) {
        const handled = await handleRefreshTokenError(error);
        if (handled) {
          Alert.alert(
            "Session expired",
            "Please sign in again to save online."
          );
        } else {
          console.error(error);
          Alert.alert(
            "Saved locally",
            "Online save failed (will retry later)."
          );
        }
      }

      router.replace("/profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        Edit Your Profile{syncing ? " (syncing photo…) " : ""}
      </Text>

      {profileImage && (
        <Image
          source={{ uri: profileImage }}
          style={{
            width: 150,
            height: 150,
            borderRadius: 75,
            marginBottom: 20,
          }}
        />
      )}

      {uploading && (
        <View style={styles.uploadRow}>
          <ActivityIndicator size="small" color="#00FF7F" />
          <Text style={styles.uploadLabel}>Uploading photo...</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={openCamera}
      >
        <Text style={styles.buttonSecondaryText}>
          {Platform.OS === "web" ? "📷 Choose Photo" : "📷 Take / Update Photo"}
        </Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Name"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TextInput
        placeholder="Bio"
        placeholderTextColor="#888"
        value={bio}
        onChangeText={setBio}
        style={[styles.input, { height: 80 }]}
        multiline
      />
      <TextInput
        placeholder="Favorite Strain"
        placeholderTextColor="#888"
        value={strain}
        onChangeText={setStrain}
        style={styles.input}
      />
      <TextInput
        placeholder="Blaze Style"
        placeholderTextColor="#888"
        value={style}
        onChangeText={setStyle}
        style={styles.input}
      />

      <Text style={styles.label}>Looking For:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={lookingFor}
          onValueChange={(value: Looking) => setLookingFor(value)}
          style={styles.picker}
          dropdownIconColor="#00FF7F"
        >
          <Picker.Item label="🌿 Just Wanna Smoke" value="smoke" />
          <Picker.Item label="🍑 Just Looking to Hook Up" value="hookup" />
          <Picker.Item label="🌿+🍑 Both" value="both" />
        </Picker>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={saveProfile}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? "Saving…" : "💾 Save Changes"}
        </Text>
      </TouchableOpacity>

      {hasCamPermission === false && (
        <Text style={{ color: "#ff7777", marginTop: 12 }}>
          Camera permission denied. You can enable it in system settings.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#121212",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#00FF7F",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    backgroundColor: "#1f1f1f",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  label: {
    alignSelf: "flex-start",
    color: "#ccc",
    fontSize: 16,
    marginBottom: 6,
  },
  pickerContainer: {
    width: "100%",
    backgroundColor: "#1f1f1f",
    borderRadius: 10,
    marginBottom: 20,
  },
  picker: { color: "#fff", width: "100%" },
  button: {
    backgroundColor: "#00FF7F",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 10,
    alignItems: "center",
    width: "100%",
  },
  buttonText: { color: "#121212", fontWeight: "bold", fontSize: 16 },
  secondaryButton: { backgroundColor: "#1f1f1f" },
  buttonSecondaryText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  uploadLabel: {
    color: "#ccc",
    marginLeft: 8,
  },
});
