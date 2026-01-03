/*
  # Add Daily Swipe Limit Tracking

  1. Changes to Users Table
    - `daily_swipes_count` (integer) - Count of swipes today (likes + passes)
    - `daily_swipes_reset_at` (timestamptz) - When the daily count resets

  2. Notes
    - Free users: 50 swipes per day
    - Premium users (blaze_og): Unlimited swipes
    - Counter resets at midnight UTC

  3. Function
    - `check_and_reset_daily_swipes()` - Resets counter if needed before checking limit
*/

-- Add daily swipe tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_swipes_count integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_swipes_reset_at timestamptz DEFAULT now();

-- Function to check and reset daily swipes if needed
CREATE OR REPLACE FUNCTION check_and_reset_daily_swipes(p_user_id uuid)
RETURNS TABLE(swipes_remaining integer, is_premium boolean) AS $$
DECLARE
  v_user RECORD;
  v_swipes_remaining integer;
  v_is_premium boolean;
  v_daily_limit integer := 50;
BEGIN
  -- Get user subscription and swipe data
  SELECT 
    subscription_tier,
    subscription_status,
    daily_swipes_count,
    daily_swipes_reset_at
  INTO v_user
  FROM users
  WHERE id = p_user_id;

  -- Check if user is premium
  v_is_premium := (
    v_user.subscription_tier = 'blaze_og' 
    AND v_user.subscription_status = 'active'
  );

  -- If premium, return unlimited (-1)
  IF v_is_premium THEN
    RETURN QUERY SELECT -1, true;
    RETURN;
  END IF;

  -- Check if we need to reset the counter (new day)
  IF v_user.daily_swipes_reset_at IS NULL 
     OR v_user.daily_swipes_reset_at < CURRENT_DATE THEN
    -- Reset counter for new day
    UPDATE users
    SET 
      daily_swipes_count = 0,
      daily_swipes_reset_at = CURRENT_DATE + interval '1 day'
    WHERE id = p_user_id;
    
    v_swipes_remaining := v_daily_limit;
  ELSE
    -- Calculate remaining swipes
    v_swipes_remaining := v_daily_limit - COALESCE(v_user.daily_swipes_count, 0);
    IF v_swipes_remaining < 0 THEN
      v_swipes_remaining := 0;
    END IF;
  END IF;

  RETURN QUERY SELECT v_swipes_remaining, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment daily swipe count
CREATE OR REPLACE FUNCTION increment_daily_swipes(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET daily_swipes_count = COALESCE(daily_swipes_count, 0) + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;