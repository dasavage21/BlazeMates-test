/*
  # Add Daily Login Tracking

  1. New Function
    - `track_daily_login(user_id)` - Awards 10 points for daily login and tracks streak
  
  2. Logic
    - Check if user already logged in today (based on last_login_date)
    - If not logged in today:
      - Award 10 points
      - Update last_login_date to today
      - Update login_streak (increment if consecutive day, reset if gap)
    - If already logged in today, do nothing
  
  3. Streak Logic
    - If last login was yesterday: increment streak
    - If last login was today: no change
    - If last login was more than 1 day ago: reset streak to 1
    - If no previous login: set streak to 1
*/

-- Function to track daily login and award points
CREATE OR REPLACE FUNCTION track_daily_login(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_login_date date;
  v_current_streak integer;
  v_today date := CURRENT_DATE;
  v_points_awarded integer := 0;
  v_new_streak integer;
BEGIN
  -- Get current login info
  SELECT last_login_date, login_streak
  INTO v_last_login_date, v_current_streak
  FROM users
  WHERE id = p_user_id;

  -- If user doesn't exist, return early
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'points_awarded', 0,
      'already_logged_in_today', false,
      'streak', 0,
      'message', 'User not found'
    );
  END IF;

  -- Check if already logged in today
  IF v_last_login_date = v_today THEN
    RETURN jsonb_build_object(
      'points_awarded', 0,
      'already_logged_in_today', true,
      'streak', COALESCE(v_current_streak, 0),
      'message', 'Already logged in today'
    );
  END IF;

  -- Award 10 points for daily login
  v_points_awarded := 10;
  PERFORM award_activity_points(p_user_id, v_points_awarded, 'daily_login');

  -- Calculate new streak
  IF v_last_login_date IS NULL THEN
    -- First time login
    v_new_streak := 1;
  ELSIF v_last_login_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day login - increment streak
    v_new_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    -- Gap in logins - reset streak
    v_new_streak := 1;
  END IF;

  -- Update last login date and streak
  UPDATE users
  SET 
    last_login_date = v_today,
    login_streak = v_new_streak
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'points_awarded', v_points_awarded,
    'already_logged_in_today', false,
    'streak', v_new_streak,
    'message', 'Daily login bonus awarded'
  );
END;
$$;