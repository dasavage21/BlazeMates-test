/*
  # Fix Performance and Security Issues

  ## Changes
  
  1. Foreign Key Indexes
    - Add index on `messages.thread_id` to optimize foreign key queries
  
  2. RLS Policy Optimization (profiles table)
    - Replace `auth.uid()` with `(SELECT auth.uid())` in all policies
    - Prevents re-evaluation of auth function for each row
    - Policies: insert own profile, read own profile, update own profile, delete own profile
  
  3. Remove Duplicate Policies (user_sessions table)
    - Drop redundant policies: own_row_select, own_row_update, own_row_upsert
    - Keep: user_can_select_own_session, user_can_update_own_session, user_can_insert_own_session
  
  4. Remove Unused Indexes
    - Drop idx_profiles_id (redundant with primary key)
    - Drop idx_threads_user_ids_gin (not used in queries)
    - Drop idx_user_sessions_user_id (redundant with primary key)
    - Drop idx_users_id (redundant with primary key)
  
  5. Recreate Views
    - Ensure active_users_15m and active_users_15m_count don't have SECURITY DEFINER
  
  ## Performance Impact
  - Foreign key index improves join performance on messages table
  - Optimized RLS policies reduce function calls by 10-100x for large result sets
  - Removing unused indexes reduces storage and write overhead
  - Consolidated policies are easier to maintain
*/

-- 1. Add index for foreign key on messages.thread_id
CREATE INDEX IF NOT EXISTS idx_messages_thread_id 
ON public.messages(thread_id);

-- 2. Drop duplicate policies on user_sessions
DROP POLICY IF EXISTS "own_row_select" ON public.user_sessions;
DROP POLICY IF EXISTS "own_row_update" ON public.user_sessions;
DROP POLICY IF EXISTS "own_row_upsert" ON public.user_sessions;

-- 3. Recreate profiles policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles: user can delete own row" ON public.profiles;

CREATE POLICY "insert own profile"
  ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "read own profile"
  ON public.profiles
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "update own profile"
  ON public.profiles
  FOR UPDATE
  TO public
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles: user can delete own row"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- 4. Drop unused indexes
DROP INDEX IF EXISTS public.idx_profiles_id;
DROP INDEX IF EXISTS public.idx_threads_user_ids_gin;
DROP INDEX IF EXISTS public.idx_user_sessions_user_id;
DROP INDEX IF EXISTS public.idx_users_id;

-- 5. Recreate views without SECURITY DEFINER (for safety)
DROP VIEW IF EXISTS public.active_users_15m CASCADE;
DROP VIEW IF EXISTS public.active_users_15m_count CASCADE;

CREATE VIEW public.active_users_15m AS
SELECT user_id, last_seen
FROM public.user_sessions
WHERE last_seen > (now() - interval '15 minutes');

CREATE VIEW public.active_users_15m_count AS
SELECT count(*) AS count
FROM public.user_sessions
WHERE last_seen > (now() - interval '15 minutes');