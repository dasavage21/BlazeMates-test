import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const style = document.createElement("style");
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        input:focus, textarea:focus {
          border-color: #00FF7F !important;
          box-shadow: 0 0 0 3px rgba(0, 255, 127, 0.1) !important;
        }

        button:hover {
          transform: translateY(-1px);
        }

        button:active {
          transform: translateY(0);
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

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
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#555"
                multiline
                numberOfLines={8}
                value={content}
                onChangeText={setContent}
                maxLength={500}
                autoFocus
              />
            </View>

            <Text style={[
              styles.characterCount,
              content.length > 450 && styles.characterCountWarning,
              content.length === 500 && styles.characterCountLimit,
            ]}>
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
    backgroundColor: "#0a0a0a",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: isDesktop ? 24 : 16,
    paddingVertical: isDesktop ? 20 : 16,
    backgroundColor: "#141414",
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
    ...(Platform.OS === "web" && {
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
    }),
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s",
    }),
  },
  headerTitle: {
    fontSize: isDesktop ? 20 : 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  postButton: {
    backgroundColor: "#00FF7F",
    paddingHorizontal: isDesktop ? 28 : 24,
    paddingVertical: isDesktop ? 10 : 9,
    borderRadius: 24,
    minWidth: isDesktop ? 90 : 80,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s",
      boxShadow: "0 2px 12px rgba(0, 255, 127, 0.3)",
    }),
  },
  postButtonDisabled: {
    backgroundColor: "#1f1f1f",
    opacity: 0.4,
    ...(Platform.OS === "web" && {
      cursor: "not-allowed",
      boxShadow: "none",
    }),
  },
  postButtonText: {
    color: "#0a0a0a",
    fontWeight: "700",
    fontSize: isDesktop ? 16 : 15,
    letterSpacing: 0.3,
  },
  contentSection: {
    padding: isDesktop ? 32 : 20,
    maxWidth: isDesktop ? 680 : "100%",
    width: "100%",
    alignSelf: "center",
  },
  inputWrapper: {},
  textInput: {
    fontSize: isDesktop ? 17 : 16,
    color: "#ffffff",
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: isDesktop ? 20 : 18,
    minHeight: isDesktop ? 280 : 220,
    textAlignVertical: "top",
    borderWidth: 2,
    borderColor: "#1f1f1f",
    lineHeight: isDesktop ? 26 : 24,
    ...(Platform.OS === "web" && {
      outlineStyle: "none",
      transition: "all 0.2s",
    }),
  },
  characterCount: {
    fontSize: isDesktop ? 14 : 13,
    color: "#666666",
    textAlign: "right",
    marginTop: 10,
    marginBottom: 24,
    fontWeight: "500",
  },
  characterCountWarning: {
    color: "#FFA500",
    fontWeight: "600",
  },
  characterCountLimit: {
    color: "#FF4444",
    fontWeight: "700",
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    ...(Platform.OS === "web" && {
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
    }),
  },
  imagePreview: {
    width: "100%",
    height: isDesktop ? 380 : 300,
    resizeMode: "cover",
  },
  removeImageButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 24,
    padding: 10,
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s",
      backdropFilter: "blur(8px)",
    }),
  },
  imageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#141414",
    padding: isDesktop ? 20 : 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#00FF7F",
    ...(Platform.OS === "web" && {
      cursor: "pointer",
      transition: "all 0.2s",
      boxShadow: "0 4px 16px rgba(0, 255, 127, 0.15)",
    }),
  },
  imageButtonText: {
    color: "#00FF7F",
    fontSize: isDesktop ? 17 : 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 20,
    padding: isDesktop ? 16 : 14,
    backgroundColor: "rgba(0, 255, 127, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 127, 0.2)",
  },
  uploadingText: {
    color: "#00FF7F",
    fontSize: isDesktop ? 15 : 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
