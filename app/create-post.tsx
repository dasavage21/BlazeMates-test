import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../supabaseClient";
import { X, ImageIcon } from "lucide-react-native";

const screenWidth = Dimensions.get("window").width;
const isSmallPhone = screenWidth <= 390;
const isDesktop = screenWidth >= 768;

export default function CreatePostScreen() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library to upload images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setUploading(true);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        throw new Error("User not authenticated");
      }

      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      let fileData: Blob | File;

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        fileData = await response.blob();
      } else {
        const response = await fetch(uri);
        fileData = await response.blob();
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, fileData, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(uploadData.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert("Error", "Please enter some content for your post.");
      return;
    }

    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        Alert.alert("Error", "You must be logged in to create a post.");
        return;
      }

      let imageUrl: string | null = null;

      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
        if (!imageUrl) {
          Alert.alert("Warning", "Failed to upload image, but your post will be created without it.");
        }
      }

      const { error } = await supabase.from("feed_posts").insert({
        user_id: userId,
        content: content.trim(),
        image_url: imageUrl,
      });

      if (error) {
        console.error("Error creating post:", error);
        Alert.alert("Error", "Failed to create post. Please try again.");
        return;
      }

      router.replace("/feed");
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closeButton}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Post</Text>
            <TouchableOpacity
              onPress={handlePost}
              disabled={loading || uploading || !content.trim()}
              style={[
                styles.postButton,
                (loading || uploading || !content.trim()) && styles.postButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#121212" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.contentSection}>
            <TextInput
              style={styles.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#666"
              multiline
              numberOfLines={8}
              value={content}
              onChangeText={setContent}
              maxLength={500}
              autoFocus
            />

            <Text style={styles.characterCount}>
              {content.length} / 500
            </Text>

            {imageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(null)}
                >
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.imageButton}
              onPress={pickImage}
              disabled={uploading}
            >
              <ImageIcon size={24} color="#00FF7F" />
              <Text style={styles.imageButtonText}>
                {imageUri ? "Change Image" : "Add Image"}
              </Text>
            </TouchableOpacity>

            {uploading && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#00FF7F" />
                <Text style={styles.uploadingText}>Uploading image...</Text>
              </View>
            )}
          </View>
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
  },
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  postButton: {
    backgroundColor: "#00FF7F",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },
  postButtonDisabled: {
    backgroundColor: "#2a2a2a",
    opacity: 0.5,
  },
  postButtonText: {
    color: "#121212",
    fontWeight: "700",
    fontSize: 15,
  },
  contentSection: {
    padding: 20,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  textInput: {
    fontSize: 16,
    color: "#fff",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  characterCount: {
    fontSize: 13,
    color: "#666",
    textAlign: "right",
    marginTop: 8,
    marginBottom: 20,
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 20,
  },
  imagePreview: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    resizeMode: "cover",
  },
  removeImageButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    padding: 8,
  },
  imageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#00FF7F",
  },
  imageButtonText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 16,
    padding: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
  },
  uploadingText: {
    color: "#00FF7F",
    fontSize: 14,
    fontWeight: "500",
  },
});
