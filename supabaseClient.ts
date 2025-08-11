import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zedfmjwqbikwynwqtylu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XFegu_WzCwj-pgFg7db0bQ_B9DM4Vz8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


