// supabaseClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

<<<<<<< HEAD
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
=======
// ✅ EXACTLY this format — no trailing characters
const SUPABASE_URL = 'https://zedfmjwqbikwynwqtylu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_u5yP7adQhrGJ5YF9dGiDUw_p4MvjS5n';
>>>>>>> c290e03 (WIP: local edits (privacy page, delete-user fn, supabase client))

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


