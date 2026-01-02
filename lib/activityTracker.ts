import { supabase } from '../supabaseClient';

let lastUpdateTime = 0;
let updateInProgress: Promise<void> | null = null;
const UPDATE_INTERVAL = 5 * 60 * 1000;

export async function updateUserActivity(): Promise<void> {
  const now = Date.now();

  if (now - lastUpdateTime < UPDATE_INTERVAL) {
    return;
  }

  if (updateInProgress) {
    return updateInProgress;
  }

  const performUpdate = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);

      if (!error) {
        lastUpdateTime = now;
      }
    } catch (error) {
      console.error('Failed to update user activity:', error);
    } finally {
      updateInProgress = null;
    }
  };

  updateInProgress = performUpdate();
  return updateInProgress;
}
