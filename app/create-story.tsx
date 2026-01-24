import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabaseClient';
import { Camera, Image as ImageIcon, X, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CreateStory() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      setError(null);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        setError('Please allow access to your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      setError(null);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        setError('Please allow camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      setError('Failed to take photo. Please try again.');
    }
  };

  const uploadStory = async () => {
    if (!selectedImage) return;

    setUploading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to post stories');
        setUploading(false);
        return;
      }

      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const fileExt = selectedImage.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          image_url: publicUrl,
        });

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error(`Failed to save story: ${insertError.message}`);
      }

      router.back();
    } catch (error: any) {
      console.error('Error uploading story:', error);
      setError(error.message || 'Failed to post story. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!selectedImage ? (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
              <X size={28} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Story</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={takePhoto}>
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.optionGradient}
              >
                <Camera size={40} color="#fff" />
                <Text style={styles.optionText}>Take Photo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionButton} onPress={pickImage}>
              <LinearGradient
                colors={['#2196F3', '#1976D2']}
                style={styles.optionGradient}
              >
                <ImageIcon size={40} color="#fff" />
                <Text style={styles.optionText}>Choose from Gallery</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Stories disappear after 24 hours</Text>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />

          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent']}
            style={styles.topGradient}
          />

          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={() => setSelectedImage(null)}
              style={styles.backButton}
            >
              <X size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={uploadStory}
              style={styles.postButton}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Check size={28} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.uploadingText}>Posting your story...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => setError(null)}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  optionButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  optionGradient: {
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 24,
    alignItems: 'center',
  },
  infoText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  previewImage: {
    flex: 1,
    backgroundColor: '#000',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  previewHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  postButton: {
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    minWidth: 48,
    alignItems: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    marginTop: 16,
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: '#c62828',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  dismissButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissButtonText: {
    color: '#c62828',
    fontWeight: '600',
  },
});
