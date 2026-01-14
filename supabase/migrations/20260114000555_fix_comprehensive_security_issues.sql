/*
  # Fix Comprehensive Security and Performance Issues

  ## Changes
  
  ### 1. Add Missing Foreign Key Index
  - Add index on `post_comments.user_id` for better query performance
  
  ### 2. Remove All Unused Indexes
  These indexes were created but never used, wasting storage and slowing writes:
  - Drop `idx_feed_posts_user_id`
  - Drop `idx_group_chats_created_by`
  - Drop `idx_group_messages_sender_id`
  - Drop `idx_post_comments_post_id`
  - Drop `idx_post_likes_user_id`
  - Drop `idx_smoke_sessions_created_by`
  - Drop `idx_feed_posts_created_at`
  - Drop `idx_post_likes_post_id_user_id`
  - Drop `idx_post_comments_post_id_created_at`
  
  ### 3. Fix RLS Policies for Performance
  Replace `auth.uid()` with `(select auth.uid())` to prevent re-evaluation per row
  
  ### 4. Remove Duplicate Permissive Policies
  Consolidate multiple policies that do the same thing
  
  ### 5. Fix Function Security
  Ensure `is_event_creator` has proper immutable search_path
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_post_comments_user_id 
  ON public.post_comments(user_id);

-- ============================================================================
-- 2. Remove All Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_feed_posts_user_id;
DROP INDEX IF EXISTS idx_group_chats_created_by;
DROP INDEX IF EXISTS idx_group_messages_sender_id;
DROP INDEX IF EXISTS idx_post_comments_post_id;
DROP INDEX IF EXISTS idx_post_likes_user_id;
DROP INDEX IF EXISTS idx_smoke_sessions_created_by;
DROP INDEX IF EXISTS idx_feed_posts_created_at;
DROP INDEX IF EXISTS idx_post_likes_post_id_user_id;
DROP INDEX IF EXISTS idx_post_comments_post_id_created_at;

-- ============================================================================
-- 3. Remove Duplicate Policies
-- ============================================================================

-- Feed Posts - Remove old duplicate policies
DROP POLICY IF EXISTS "Users can create posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.feed_posts;

-- Post Likes - Remove old duplicate policies
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can remove own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;

-- Post Comments - Remove old duplicate policies
DROP POLICY IF EXISTS "Users can comment on posts" ON public.post_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;

-- ============================================================================
-- 4. Create Optimized RLS Policies with (select auth.uid())
-- ============================================================================

-- Feed Posts Policies
CREATE POLICY "Users can create posts"
  ON public.feed_posts
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own posts"
  ON public.feed_posts
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.feed_posts
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Post Likes Policies
CREATE POLICY "Users can like posts"
  ON public.post_likes
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can remove own likes"
  ON public.post_likes
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Post Comments Policies
CREATE POLICY "Users can comment on posts"
  ON public.post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own comments"
  ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.post_comments
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 5. Fix Function Security - Create as SQL function with immutable search_path
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_event_creator(uuid);

CREATE FUNCTION public.is_event_creator(event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.smoke_sessions
    WHERE id = event_id
    AND created_by = (SELECT auth.uid())
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_event_creator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_creator(uuid) TO anon;
