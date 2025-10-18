// supabaseClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zedfmjwqbikwynwqtylu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_u5yP7adQhrGJ5YF9dGiDUw_p4MvjS5n';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: {
      getItem: (k) => AsyncStorage.getItem(k),
      setItem: (k, v) => AsyncStorage.setItem(k, v),
      removeItem: (k) => AsyncStorage.removeItem(k),
    },
    autoRefreshToken: true,
  },
});
