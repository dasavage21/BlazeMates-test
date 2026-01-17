import { supabase } from '../supabaseClient';

let lastUpdateTime = 0;
let updateInProgress: Promise<void> | null = null;
const UPDATE_INTERVAL = 5 * 60 * 1000;

let dailyLoginChecked = false;

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

export async function trackDailyLogin(): Promise<{
  success: boolean;
  pointsAwarded: number;
  streak: number;
  message: string;
}> {
  if (dailyLoginChecked) {
    return {
      success: false,
      pointsAwarded: 0,
      streak: 0,
      message: 'Daily login already checked this session',
    };
  }

  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      return {
        success: false,
        pointsAwarded: 0,
        streak: 0,
        message: 'User not authenticated',
      };
    }

    const { data, error } = await supabase.rpc('track_daily_login', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to track daily login:', error);
      return {
        success: false,
        pointsAwarded: 0,
        streak: 0,
        message: 'Failed to track login',
      };
    }

    dailyLoginChecked = true;

    return {
      success: true,
      pointsAwarded: data.points_awarded || 0,
      streak: data.streak || 0,
      message: data.message || 'Login tracked',
    };
  } catch (error) {
    console.error('Failed to track daily login:', error);
    return {
      success: false,
      pointsAwarded: 0,
      streak: 0,
      message: 'Error tracking login',
    };
  }
}

export function resetDailyLoginCheck() {
  dailyLoginChecked = false;
}
