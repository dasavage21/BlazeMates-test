// supabaseClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zedfmjwqbikwynwqtylu.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZGZtandxYmlrd3lud3F0eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNTU2MjksImV4cCI6MjA2OTkzMTYyOX0.NlX3kyLve4-W_Y0zE0Or9Jl2k_1rZL_JdQdlPKvnCOg';

export const SUPABASE_PROJECT_REF = SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] : '';

const isServer = typeof window === 'undefined';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
