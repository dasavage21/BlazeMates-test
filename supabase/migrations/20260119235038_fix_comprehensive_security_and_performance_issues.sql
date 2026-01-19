/*
  # Comprehensive Security and Performance Fixes
  
  ## Overview
  This migration addresses critical security and performance issues identified by Supabase security scan.
  
  ## Changes Made
  
  ### 1. Add Missing Foreign Key Indexes
  - Add index on `friendships(requester_id)` for FK performance
  - Add index on `post_comments(user_id)` for FK performance
  
  ### 2. Fix RLS Performance Issues
  - Wrap all `auth.uid()` calls with `(select auth.uid())` to prevent re-evaluation per row
  - Affects multiple tables: group_members, user_achievements, cultivation_guides, friendships, follows, user_challenge_progress, group_chats, feed_posts
  
  ### 3. Remove Unused Indexes
  - Drop indexes that have never been used to improve write performance
  
  ### 4. Consolidate Duplicate Policies
  - Merge overlapping SELECT policies into single policies
  - Prevents policy confusion and improves query planning
  
  ### 5. Fix Function Security
  - Add immutable search_path to `calculate_distance` function
  
  ## Impact
  - Significantly improved query performance for large datasets
  - Better security posture with proper RLS evaluation
  - Reduced index maintenance overhead
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id 
  ON friendships(requester_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_user_id 
  ON post_comments(user_id);

-- ============================================================================
-- 2. FIX RLS PERFORMANCE - GROUP_MEMBERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Group creators can add any members" ON group_members;
CREATE POLICY "Group creators can add any members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE id = group_members.group_id
      AND created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Group creators can remove any members" ON group_members;
CREATE POLICY "Group creators can remove any members"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE id = group_members.group_id
      AND created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view their own memberships" ON group_members;
CREATE POLICY "Users can view their own memberships"
  ON group_members FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can join public groups" ON group_members;
CREATE POLICY "Users can join public groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM group_chats
      WHERE id = group_members.group_id
      AND is_public = true
    )
  );

DROP POLICY IF EXISTS "Users can leave any group" ON group_members;
CREATE POLICY "Users can leave any group"
  ON group_members FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 3. FIX RLS PERFORMANCE - USER_ACHIEVEMENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "System can insert user achievements" ON user_achievements;
CREATE POLICY "System can insert user achievements"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 4. FIX RLS PERFORMANCE - CULTIVATION_GUIDES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Pro users can view all guides" ON cultivation_guides;
DROP POLICY IF EXISTS "Everyone can view free guides" ON cultivation_guides;

-- Consolidate into single SELECT policy
CREATE POLICY "Users can view accessible guides"
  ON cultivation_guides FOR SELECT
  TO authenticated
  USING (
    is_pro_only = false
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND subscription_tier IN ('blaze_pro', 'blaze_legend')
    )
  );

-- ============================================================================
-- 5. FIX RLS PERFORMANCE - FRIENDSHIPS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert friend requests" ON friendships;
CREATE POLICY "Users can insert friend requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update friendships they are involved in" ON friendships;
CREATE POLICY "Users can update friendships they are involved in"
  ON friendships FOR UPDATE
  TO authenticated
  USING (
    user_id_1 = (select auth.uid()) 
    OR user_id_2 = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete friendships they are involved in" ON friendships;
CREATE POLICY "Users can delete friendships they are involved in"
  ON friendships FOR DELETE
  TO authenticated
  USING (
    user_id_1 = (select auth.uid()) 
    OR user_id_2 = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can view friendships they are involved in" ON friendships;
CREATE POLICY "Users can view friendships they are involved in"
  ON friendships FOR SELECT
  TO authenticated
  USING (
    user_id_1 = (select auth.uid()) 
    OR user_id_2 = (select auth.uid())
  );

-- ============================================================================
-- 6. FIX RLS PERFORMANCE - FOLLOWS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own follows" ON follows;
CREATE POLICY "Users can insert their own follows"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own follows" ON follows;
CREATE POLICY "Users can delete their own follows"
  ON follows FOR DELETE
  TO authenticated
  USING (follower_id = (select auth.uid()));

-- ============================================================================
-- 7. FIX RLS PERFORMANCE - USER_CHALLENGE_PROGRESS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own challenge progress" ON user_challenge_progress;
CREATE POLICY "Users can view their own challenge progress"
  ON user_challenge_progress FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own challenge progress" ON user_challenge_progress;
CREATE POLICY "Users can insert their own challenge progress"
  ON user_challenge_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own challenge progress" ON user_challenge_progress;
CREATE POLICY "Users can update their own challenge progress"
  ON user_challenge_progress FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 8. FIX RLS PERFORMANCE - GROUP_CHATS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their created groups" ON group_chats;
DROP POLICY IF EXISTS "Anyone can view public groups" ON group_chats;

-- Consolidate into single SELECT policy
CREATE POLICY "Users can view accessible groups"
  ON group_chats FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = group_chats.id
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create groups" ON group_chats;
CREATE POLICY "Users can create groups"
  ON group_chats FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Creators can update their groups" ON group_chats;
CREATE POLICY "Creators can update their groups"
  ON group_chats FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Creators can delete their groups" ON group_chats;
CREATE POLICY "Creators can delete their groups"
  ON group_chats FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================================
-- 9. FIX RLS PERFORMANCE - FEED_POSTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view non-blocked feed posts" ON feed_posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON feed_posts;

-- Consolidate into single SELECT policy
CREATE POLICY "Users can view accessible posts"
  ON feed_posts FOR SELECT
  TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM blocks
      WHERE (blocker_id = (select auth.uid()) AND blocked_id = feed_posts.user_id)
         OR (blocker_id = feed_posts.user_id AND blocked_id = (select auth.uid()))
    )
  );

-- ============================================================================
-- 10. REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_cultivation_guides_pro;
DROP INDEX IF EXISTS idx_cultivation_guides_category;
DROP INDEX IF EXISTS idx_users_featured;
DROP INDEX IF EXISTS idx_user_achievements_user_id;
DROP INDEX IF EXISTS idx_user_achievements_achievement_id;
DROP INDEX IF EXISTS idx_post_likes_reaction_type;
DROP INDEX IF EXISTS idx_feed_posts_latitude;
DROP INDEX IF EXISTS idx_feed_posts_longitude;
DROP INDEX IF EXISTS idx_user_challenge_progress_user_id;
DROP INDEX IF EXISTS idx_user_challenge_progress_challenge_id;
DROP INDEX IF EXISTS idx_group_chats_source_post_id;
DROP INDEX IF EXISTS idx_feed_posts_tags;
DROP INDEX IF EXISTS idx_feed_posts_expires_at;
DROP INDEX IF EXISTS idx_feed_posts_is_moment;
DROP INDEX IF EXISTS friendships_status_idx;
DROP INDEX IF EXISTS friendships_created_at_idx;
DROP INDEX IF EXISTS follows_created_at_idx;
DROP INDEX IF EXISTS idx_feed_posts_user_id_fkey;
DROP INDEX IF EXISTS idx_group_chats_created_by_fkey;
DROP INDEX IF EXISTS idx_group_messages_sender_id_fkey;
DROP INDEX IF EXISTS idx_post_likes_user_id_fkey;
DROP INDEX IF EXISTS idx_smoke_sessions_created_by_fkey;

-- ============================================================================
-- 11. FIX FUNCTION SEARCH PATH
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  x double precision;
  y double precision;
BEGIN
  -- Simple Pythagorean distance approximation
  -- For more accuracy, use PostGIS or Haversine formula
  x := 69.1 * (lat2 - lat1);
  y := 69.1 * (lon2 - lon1) * cos(lat1 / 57.3);
  RETURN sqrt(x * x + y * y);
END;
$$;
