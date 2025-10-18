// lib/avatarSync.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';


const PENDING_KEY = 'pendingAvatarUri';

export async function syncPendingAvatarIfAuthed() {
  const pendingUri = await AsyncStorage.getItem(PENDING_KEY);
  if (!pendingUri) return;

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return; // still logged out; keep it queued

  // ✅ No FileSystem / base64 — just hand RN file object to Supabase
  const file = {
    uri: pendingUri,        // e.g. file:///data/user/.../camera.jpg
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as any;

  const path = `${user.id}/avatar.jpg`; // not "avatars/<uid>/..."
const { error: uploadErr } = await supabase
  .storage
  .from('avatars')
  .upload(path, file, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600'
  });
  if (uploadErr) {
    console.warn('avatar upload failed:', uploadErr);
    return; // keep it pending; we’ll try again next launch
  }

  // Get public URL and update row
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: dbErr } = await supabase
    .from('users')
    .update({ image_url: publicUrl })
    .eq('id', user.id);

  if (dbErr) {
    console.warn('user image update failed:', dbErr);
    return;
  }

  // reflect locally
  const profile = JSON.parse((await AsyncStorage.getItem('userProfile')) || '{}');
  profile.profileImage = publicUrl;
  await AsyncStorage.setItem('userProfile', JSON.stringify(profile));

  // clear the queued file
  await AsyncStorage.removeItem(PENDING_KEY);
}
