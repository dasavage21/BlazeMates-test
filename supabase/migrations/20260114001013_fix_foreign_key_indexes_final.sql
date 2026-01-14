/*
  # Fix Foreign Key Indexes and Security Issues - Final

  ## Changes
  
  ### 1. Add Missing Foreign Key Indexes
  These indexes are critical for query performance on foreign key lookups:
  - Add index on `feed_posts.user_id`
  - Add index on `group_chats.created_by`
  - Add index on `group_messages.sender_id`
  - Add index on `post_comments.post_id`
  - Add index on `post_likes.user_id`
  - Add index on `smoke_sessions.created_by`
  
  ### 2. Remove Unused Index
  - Drop `idx_post_comments_user_id` (not being used)
  
  ### 3. Fix Function Security
  - Recreate `is_event_creator` with properly immutable search_path
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Indexes
-- ============================================================================

-- These indexes improve JOIN performance and foreign key constraint checks
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id_fkey 
  ON public.feed_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_group_chats_created_by_fkey 
  ON public.group_chats(created_by);

CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id_fkey 
  ON public.group_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id_fkey 
  ON public.post_comments(post_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_id_fkey 
  ON public.post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_smoke_sessions_created_by_fkey 
  ON public.smoke_sessions(created_by);

-- ============================================================================
-- 2. Remove Unused Index
-- ============================================================================

DROP INDEX IF EXISTS idx_post_comments_user_id;

-- ============================================================================
-- 3. Fix Function Security with Immutable search_path
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.is_event_creator(uuid);

-- Recreate with proper security settings
-- Using empty search_path and fully qualified table names for security
CREATE FUNCTION public.is_event_creator(event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.smoke_sessions
    WHERE smoke_sessions.id = is_event_creator.event_id
    AND smoke_sessions.created_by = (SELECT auth.uid())
  );
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_event_creator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_creator(uuid) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.is_event_creator(uuid) IS 
  'Checks if the current user is the creator of a smoke session. Uses fully qualified names and empty search_path for security.';
