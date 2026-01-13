/*
  # Fix Security and Performance Issues

  1. RLS Policy Optimization
    - Fix policies that re-evaluate auth functions for each row
    - Replace `auth.uid()` with `(select auth.uid())` for better performance
    - Affected policies:
      - subscription_analytics: "Users can insert own analytics"
      - profile_views: "Users can view their own profile view history"
      - profile_views: "Users can create profile views"
  
  2. Remove Unused Indexes
    - Drop `idx_users_profile_reminder` (not being used)
    - Drop `idx_users_incomplete_profiles` (not being used)
    - Drop `idx_users_boost_active` (not being used)
  
  3. Fix Function Search Path
    - Add `SET search_path = public` to check_and_reset_daily_swipes function
    - This prevents role mutable search_path security issue
*/

-- ============================================
-- 1. Fix RLS Policies
-- ============================================

-- Fix subscription_analytics INSERT policy
DROP POLICY IF EXISTS "Users can insert own analytics" ON subscription_analytics;

CREATE POLICY "Users can insert own analytics"
  ON subscription_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Fix profile_views SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile view history" ON profile_views;

CREATE POLICY "Users can view their own profile view history"
  ON profile_views
  FOR SELECT
  TO authenticated
  USING (
    viewed_user_id = (select auth.uid())
    AND (
      SELECT subscription_tier FROM users WHERE id = (select auth.uid())
    ) IN ('pro', 'blaze_og', 'blaze_pro')
    AND (
      SELECT subscription_status FROM users WHERE id = (select auth.uid())
    ) = 'active'
  );

-- Fix profile_views INSERT policy
DROP POLICY IF EXISTS "Users can create profile views" ON profile_views;

CREATE POLICY "Users can create profile views"
  ON profile_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_id = (select auth.uid())
    AND viewer_id != viewed_user_id
  );

-- ============================================
-- 2. Remove Unused Indexes
-- ============================================

DROP INDEX IF EXISTS idx_users_profile_reminder;
DROP INDEX IF EXISTS idx_users_incomplete_profiles;
DROP INDEX IF EXISTS idx_users_boost_active;

-- ============================================
-- 3. Fix Function Search Path
-- ============================================

-- Recreate check_and_reset_daily_swipes function with proper search_path
CREATE OR REPLACE FUNCTION check_and_reset_daily_swipes(p_user_id uuid)
RETURNS TABLE(swipes_remaining integer, is_premium boolean) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
