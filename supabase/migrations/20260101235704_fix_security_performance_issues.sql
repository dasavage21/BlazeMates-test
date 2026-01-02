/*
  # Fix Security and Performance Issues

  1. Indexes
    - Add missing index on `super_likes.to_user_id` foreign key
    - Remove unused indexes:
      - `idx_reports_status` (not being used)
      - `idx_users_is_suspended` (not being used)
      - `idx_messages_thread_id` (not being used)

  2. RLS Policy Optimization
    - Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation for each row, improving query performance

  3. Consolidate Multiple Permissive Policies
    - Merge duplicate SELECT policies on `likes`, `reports`, and `users` tables

  4. Function Security
    - Fix search_path for `reset_super_likes` and `update_user_analytics`
    - Set explicit search_path to prevent security vulnerabilities
*/

-- =====================================================
-- PART 1: Add missing index and remove unused indexes
-- =====================================================

-- Add index for super_likes foreign key
CREATE INDEX IF NOT EXISTS idx_super_likes_to_user_id 
  ON super_likes(to_user_id);

-- Remove unused indexes
DROP INDEX IF EXISTS idx_reports_status;
DROP INDEX IF EXISTS idx_users_is_suspended;
DROP INDEX IF EXISTS idx_messages_thread_id;

-- =====================================================
-- PART 2: Fix RLS Policies - Messages Table
-- =====================================================

DROP POLICY IF EXISTS "messages_auth_insert" ON messages;

CREATE POLICY "messages_auth_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = sender_id);

-- =====================================================
-- PART 3: Fix RLS Policies - Read Receipts Table
-- =====================================================

DROP POLICY IF EXISTS "read_receipts_auth_insert" ON read_receipts;
DROP POLICY IF EXISTS "read_receipts_auth_update" ON read_receipts;

CREATE POLICY "read_receipts_auth_insert"
  ON read_receipts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "read_receipts_auth_update"
  ON read_receipts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- =====================================================
-- PART 4: Fix RLS Policies - Likes Table (Consolidate)
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own likes" ON likes;
DROP POLICY IF EXISTS "Users can view likes where they are liked" ON likes;
DROP POLICY IF EXISTS "Users can create their own likes" ON likes;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view relevant likes"
  ON likes FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id OR 
    (select auth.uid()) = liked_user_id
  );

-- Create optimized INSERT policy
CREATE POLICY "Users can create their own likes"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- =====================================================
-- PART 5: Fix RLS Policies - Users Table (Consolidate)
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can delete own profile" ON users;
DROP POLICY IF EXISTS "Users can view other users profiles" ON users;
DROP POLICY IF EXISTS "Users can read all profiles" ON users;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    NOT is_suspended OR 
    (select auth.uid()) = id
  );

-- Create optimized INSERT policy
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Create optimized UPDATE policy
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Create optimized DELETE policy
CREATE POLICY "Users can delete own profile"
  ON users FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = id);

-- =====================================================
-- PART 6: Fix RLS Policies - Blocks Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own blocks" ON blocks;
DROP POLICY IF EXISTS "Users can create their own blocks" ON blocks;
DROP POLICY IF EXISTS "Users can delete their own blocks" ON blocks;

CREATE POLICY "Users can view their own blocks"
  ON blocks FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = blocker_id);

CREATE POLICY "Users can create their own blocks"
  ON blocks FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = blocker_id);

CREATE POLICY "Users can delete their own blocks"
  ON blocks FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = blocker_id);

-- =====================================================
-- PART 7: Fix RLS Policies - Reports Table (Consolidate)
-- =====================================================

DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own submitted reports" ON reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON reports;

-- Create optimized INSERT policy
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_id);

-- Create consolidated SELECT policy (combines admin and user checks)
CREATE POLICY "Users can view relevant reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = reporter_id OR
    (select is_current_user_admin()) = true
  );

-- =====================================================
-- PART 8: Fix RLS Policies - Subscription Analytics
-- =====================================================

DROP POLICY IF EXISTS "Users can view own analytics" ON subscription_analytics;

CREATE POLICY "Users can view own analytics"
  ON subscription_analytics FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- PART 9: Fix RLS Policies - Super Likes
-- =====================================================

DROP POLICY IF EXISTS "Users can view super likes sent to them" ON super_likes;
DROP POLICY IF EXISTS "Users can send super likes" ON super_likes;
DROP POLICY IF EXISTS "Users can delete own super likes" ON super_likes;

CREATE POLICY "Users can view super likes sent to them"
  ON super_likes FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = to_user_id);

CREATE POLICY "Users can send super likes"
  ON super_likes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = from_user_id);

CREATE POLICY "Users can delete own super likes"
  ON super_likes FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = from_user_id);

-- =====================================================
-- PART 10: Fix Function Search Paths
-- =====================================================

-- Drop and recreate reset_super_likes with explicit search_path
DROP FUNCTION IF EXISTS reset_super_likes();

CREATE OR REPLACE FUNCTION reset_super_likes()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE users
  SET 
    super_likes_remaining = CASE 
      WHEN subscription_tier = 'blaze_og' THEN 10
      ELSE 0
    END,
    super_likes_reset_at = now() + interval '30 days'
  WHERE 
    subscription_tier = 'blaze_og' 
    AND subscription_status = 'active'
    AND (super_likes_reset_at IS NULL OR super_likes_reset_at <= now());
END;
$$;

-- Drop and recreate update_user_analytics with explicit search_path
DROP FUNCTION IF EXISTS update_user_analytics(uuid);

CREATE OR REPLACE FUNCTION update_user_analytics(p_user_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_swipes integer;
  v_total_likes_sent integer;
  v_total_likes_received integer;
  v_swipe_rate numeric;
  v_match_score numeric;
BEGIN
  SELECT COUNT(*) INTO v_total_likes_sent
  FROM likes
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_total_likes_received
  FROM likes
  WHERE liked_user_id = p_user_id;

  v_total_swipes := v_total_likes_sent * 2;

  IF v_total_swipes > 0 THEN
    v_swipe_rate := (v_total_likes_sent::numeric / v_total_swipes::numeric) * 100;
  ELSE
    v_swipe_rate := 0;
  END IF;

  IF v_total_likes_sent > 0 THEN
    v_match_score := (v_total_likes_received::numeric / GREATEST(v_total_likes_sent, 1)::numeric) * 100;
  ELSE
    v_match_score := 0;
  END IF;

  INSERT INTO subscription_analytics (
    user_id,
    swipe_through_rate,
    match_likelihood_score,
    total_swipes,
    total_likes_sent,
    total_likes_received,
    updated_at
  ) VALUES (
    p_user_id,
    v_swipe_rate,
    v_match_score,
    v_total_swipes,
    v_total_likes_sent,
    v_total_likes_received,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    swipe_through_rate = EXCLUDED.swipe_through_rate,
    match_likelihood_score = EXCLUDED.match_likelihood_score,
    total_swipes = EXCLUDED.total_swipes,
    total_likes_sent = EXCLUDED.total_likes_sent,
    total_likes_received = EXCLUDED.total_likes_received,
    updated_at = now();
END;
$$;
