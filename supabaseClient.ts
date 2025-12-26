// supabaseClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://zedfmjwqbikwynwqtylu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_u5yP7adQhrGJ5YF9dGiDUw_p4MvjS5n';
export const SUPABASE_PROJECT_REF = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];

const isBrowser = typeof window !== 'undefined';

const storage = isBrowser ? {
  getItem: (k: string) => AsyncStorage.getItem(k),
  setItem: (k: string, v: string) => AsyncStorage.setItem(k, v),
  removeItem: (k: string) => AsyncStorage.removeItem(k),
} : undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: isBrowser,
    storage: storage,
    autoRefreshToken: true,
  },
});
