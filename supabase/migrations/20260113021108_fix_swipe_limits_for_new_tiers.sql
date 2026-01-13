/*
  # Fix Swipe Limits for New Subscription Tiers

  1. Purpose
    - Update check_and_reset_daily_swipes function to recognize 'plus' and 'pro' tiers
    - Previously only checked for 'blaze_og' which was deprecated
    - Both 'plus' and 'pro' users should get unlimited swipes
  
  2. Changes
    - Update the premium check to include 'plus' and 'pro' tiers
    - Remove reference to deprecated 'blaze_og' tier
  
  3. Tier Benefits
    - Free: 50 swipes per day
    - Plus: Unlimited swipes
    - Pro: Unlimited swipes (plus additional features)
*/

-- Update function to recognize new tier names
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

  -- Check if user is premium (Plus or Pro tier with active subscription)
  v_is_premium := (
    v_user.subscription_tier IN ('plus', 'pro')
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
