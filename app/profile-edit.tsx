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
      <View style={styles.header}>
        <Text style={styles.title}>Edit Your Profile</Text>
        <Text style={styles.subtitle}>
          {syncing ? "Syncing photo..." : "Update your information"}
        </Text>
      </View>

      <View style={styles.photoSection}>
        <View style={styles.photoFrame}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>No Photo</Text>
            </View>
          )}
          {uploading && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator size="large" color="#00FF7F" />
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.photoButton} onPress={openCamera}>
          <Text style={styles.photoButtonText}>
            {Platform.OS === "web" ? "Choose Photo" : "Take Photo"}
          </Text>
        </TouchableOpacity>

        {hasCamPermission === false && (
          <Text style={styles.permissionWarning}>
            Camera permission needed
          </Text>
        )}
      </View>

      <View style={styles.formSection}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Display Name *</Text>
          <TextInput
            placeholder="Enter your name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            maxLength={50}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>About You</Text>
          <TextInput
            placeholder="Tell people about yourself..."
            placeholderTextColor="#666"
            value={bio}
            onChangeText={setBio}
            maxLength={500}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.charCount}>{bio.length}/500</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Favorite Strain</Text>
          <TextInput
            placeholder="e.g., Blue Dream, OG Kush..."
            placeholderTextColor="#666"
            value={strain}
            onChangeText={setStrain}
            maxLength={50}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Blaze Style</Text>
          <TextInput
            placeholder="e.g., Joint, Bong, Vape..."
            placeholderTextColor="#666"
            value={style}
            onChangeText={setStyle}
            maxLength={50}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Looking For</Text>
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
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#121212" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0f0f0f",
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    letterSpacing: 0.2,
  },
  photoSection: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  photoFrame: {
    position: "relative",
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  profileImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: "#00FF7F",
  },
  placeholderImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#1f1f1f",
    borderWidth: 3,
    borderColor: "#333",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  photoButton: {
    backgroundColor: "#1f1f1f",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#00FF7F",
  },
  photoButtonText: {
    color: "#00FF7F",
    fontWeight: "600",
    fontSize: 15,
  },
  permissionWarning: {
    color: "#ff6b6b",
    fontSize: 13,
    marginTop: 12,
  },
  formSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  fieldGroup: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: 16,
  },
  charCount: {
    fontSize: 13,
    color: "#666",
    textAlign: "right",
    marginTop: 6,
  },
  pickerContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    overflow: "hidden",
  },
  picker: {
    color: "#fff",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  saveButton: {
    backgroundColor: "#00FF7F",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00FF7F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
