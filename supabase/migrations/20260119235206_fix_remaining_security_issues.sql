/*
  # Fix Remaining Security Issues
  
  ## Overview
  This migration addresses additional security and performance issues identified by Supabase.
  
  ## Changes Made
  
  ### 1. Add Missing Foreign Key Indexes
  - Add indexes for all unindexed foreign keys to improve join performance
  - Affects: feed_posts, group_chats, group_messages, post_likes, smoke_sessions, user_achievements, user_challenge_progress
  
  ### 2. Remove Unused Indexes
  - Drop recently created indexes that are not being used
  - Affects: friendships, post_comments
  
  ### 3. Consolidate Multiple Permissive Policies
  - Merge overlapping policies on group_members table
  - Single policy per action type prevents policy confusion
  
  ## Impact
  - Improved foreign key query performance
  - Reduced index maintenance overhead
  - Simplified RLS policy evaluation
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- Index for feed_posts.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id 
  ON feed_posts(user_id);

-- Index for group_chats.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_group_chats_created_by 
  ON group_chats(created_by);

-- Index for group_chats.source_post_id foreign key
CREATE INDEX IF NOT EXISTS idx_group_chats_source_post_id_v2 
  ON group_chats(source_post_id);

-- Index for group_messages.sender_id foreign key
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id 
  ON group_messages(sender_id);

-- Index for post_likes.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id 
  ON post_likes(user_id);

-- Index for smoke_sessions.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_smoke_sessions_created_by 
  ON smoke_sessions(created_by);

-- Index for user_achievements.achievement_id foreign key
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id 
  ON user_achievements(achievement_id);

-- Index for user_challenge_progress.challenge_id foreign key
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_challenge_id 
  ON user_challenge_progress(challenge_id);

-- ============================================================================
-- 2. REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_friendships_requester_id;
DROP INDEX IF EXISTS idx_post_comments_user_id;

-- ============================================================================
-- 3. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES ON GROUP_MEMBERS
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Group creators can add any members" ON group_members;
DROP POLICY IF EXISTS "Users can join public groups" ON group_members;
DROP POLICY IF EXISTS "Group creators can remove any members" ON group_members;
DROP POLICY IF EXISTS "Users can leave any group" ON group_members;
DROP POLICY IF EXISTS "Users can view members of public groups" ON group_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON group_members;

-- Create single consolidated INSERT policy
CREATE POLICY "Users can manage group membership inserts"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can join public groups
    (user_id = (select auth.uid())
     AND EXISTS (
       SELECT 1 FROM group_chats
       WHERE id = group_members.group_id
       AND is_public = true
     ))
    OR
    -- Group creators can add any members
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE id = group_members.group_id
      AND created_by = (select auth.uid())
    )
  );

-- Create single consolidated DELETE policy
CREATE POLICY "Users can manage group membership deletes"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    -- Users can leave any group they're in
    user_id = (select auth.uid())
    OR
    -- Group creators can remove any members
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE id = group_members.group_id
      AND created_by = (select auth.uid())
    )
  );

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view group memberships"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own memberships
    user_id = (select auth.uid())
    OR
    -- Anyone can view members of public groups
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE id = group_members.group_id
      AND is_public = true
    )
    OR
    -- Group creators can view all members
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE id = group_members.group_id
      AND created_by = (select auth.uid())
    )
  );
