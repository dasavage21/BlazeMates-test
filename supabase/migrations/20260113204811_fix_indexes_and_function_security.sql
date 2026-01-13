/*
  # Fix Security and Performance Issues

  ## Changes
  
  ### 1. Add Missing Foreign Key Index
  - Add index on `post_comments.user_id` for better query performance
  
  ### 2. Remove Unused Indexes
  These indexes were never used and waste storage space and slow down writes:
  - Drop `idx_group_chats_created_by`
  - Drop `idx_group_messages_sender_id`
  - Drop `idx_smoke_sessions_created_by`
  - Drop `idx_feed_posts_user_id`
  - Drop `idx_feed_posts_created_at`
  - Drop `idx_post_likes_post_id`
  - Drop `idx_post_likes_user_id`
  - Drop `idx_post_comments_post_id`
  - Drop `idx_post_comments_created_at`
  
  ### 3. Fix Function Security
  - Ensure `is_event_creator` has immutable search_path set
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_post_comments_user_id 
  ON public.post_comments(user_id);

-- ============================================================================
-- 2. Remove Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_group_chats_created_by;
DROP INDEX IF EXISTS idx_group_messages_sender_id;
DROP INDEX IF EXISTS idx_smoke_sessions_created_by;
DROP INDEX IF EXISTS idx_feed_posts_user_id;
DROP INDEX IF EXISTS idx_feed_posts_created_at;
DROP INDEX IF EXISTS idx_post_likes_post_id;
DROP INDEX IF EXISTS idx_post_likes_user_id;
DROP INDEX IF EXISTS idx_post_comments_post_id;
DROP INDEX IF EXISTS idx_post_comments_created_at;

-- ============================================================================
-- 3. Fix Function Security (Ensure SET search_path)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_event_creator(event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM smoke_sessions
    WHERE id = event_id
    AND created_by = auth.uid()
  );
END;
$$;
