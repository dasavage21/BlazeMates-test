/*
  # Fix RLS Performance and Remove Unused Indexes

  1. RLS Performance Fixes
    - Update `passes` table policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth.uid() for each row, improving query performance

  2. Function Security Fixes
    - Add `SET search_path = ''` to functions to prevent search_path vulnerabilities
    - Affects: `check_and_reset_daily_swipes`, `increment_daily_swipes`

  3. Index Cleanup
    - Remove unused indexes:
      - `idx_users_last_active` (not used)
      - `idx_users_last_active_at` (not used)
      - `idx_passes_passed_user_id` (not used)

  4. Notes
    - Auth DB Connection Strategy issue must be fixed in Supabase dashboard settings
    - Change from fixed connection count to percentage-based allocation
*/

-- Drop and recreate RLS policies on passes table with optimized auth check
DROP POLICY IF EXISTS "Users can create own passes" ON passes;
DROP POLICY IF EXISTS "Users can view own passes" ON passes;

CREATE POLICY "Users can create own passes"
  ON passes
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own passes"
  ON passes
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix function search_path vulnerabilities
CREATE OR REPLACE FUNCTION check_and_reset_daily_swipes(p_user_id uuid)
RETURNS TABLE(swipes_remaining integer, is_premium boolean) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
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
  FROM public.users
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
    UPDATE public.users
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

CREATE OR REPLACE FUNCTION increment_daily_swipes(p_user_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET daily_swipes_count = COALESCE(daily_swipes_count, 0) + 1
  WHERE id = p_user_id;
END;
$$;

-- Remove unused indexes
DROP INDEX IF EXISTS idx_users_last_active;
DROP INDEX IF EXISTS idx_users_last_active_at;
DROP INDEX IF EXISTS idx_passes_passed_user_id;