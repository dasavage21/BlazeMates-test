/*
  # Fix Foreign Key Indexes and Security Issues

  ## Changes
  
  ### 1. Add Missing Foreign Key Indexes
  Foreign keys without indexes cause poor query performance on joins and lookups:
  - Add index on `feed_posts.user_id`
  - Add index on `group_chats.created_by`
  - Add index on `group_messages.sender_id`
  - Add index on `post_comments.post_id`
  - Add index on `post_likes.user_id`
  - Add index on `smoke_sessions.created_by`
  
  ### 2. Remove Unused Index
  - Drop `idx_post_comments_user_id` (not being used by any queries)
  
  ### 3. Fix Function Security
  - Recreate `is_event_creator` with proper immutable search_path
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id 
  ON public.feed_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_group_chats_created_by 
  ON public.group_chats(created_by);

CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id 
  ON public.group_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id 
  ON public.post_comments(post_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_id 
  ON public.post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_smoke_sessions_created_by 
  ON public.smoke_sessions(created_by);

-- ============================================================================
-- 2. Remove Unused Index
-- ============================================================================

DROP INDEX IF EXISTS idx_post_comments_user_id;

-- ============================================================================
-- 3. Fix Function Security with Immutable search_path
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_event_creator(uuid);

CREATE FUNCTION public.is_event_creator(event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM smoke_sessions
    WHERE id = event_id
    AND created_by = auth.uid()
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_event_creator(uuid) TO authenticated;
