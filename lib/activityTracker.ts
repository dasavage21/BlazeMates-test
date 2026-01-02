import { supabase } from '../supabaseClient';

let lastUpdateTime = 0;
const UPDATE_INTERVAL = 5 * 60 * 1000;

export async function updateUserActivity() {
  const now = Date.now();

  if (now - lastUpdateTime < UPDATE_INTERVAL) {
    return;
  }

  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      return;
    }

    await supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);

    lastUpdateTime = now;
  } catch (error) {
    console.error('Failed to update user activity:', error);
  }
}
