/*
  # Fix Security and Performance Issues

  ## Changes
  
  ### 1. Add Missing Foreign Key Indexes
  - Add index on `group_chats.created_by`
  - Add index on `group_messages.sender_id`
  - Add index on `smoke_sessions.created_by`
  
  ### 2. Optimize RLS Policies (Auth Function Initialization)
  Replace `auth.<function>()` with `(select auth.<function>())` to prevent re-evaluation per row
  - Fix policies on `group_members`
  - Fix policies on `smoke_sessions`
  - Fix policies on `session_attendees`
  - Fix policies on `group_messages`
  - Fix policies on `group_chats`
  
  ### 3. Remove Unused Indexes
  - Drop unused indexes on `users` table
  - Drop unused index on `smoke_sessions` table
  
  ### 4. Fix Duplicate Policies
  - Remove duplicate SELECT policy on `group_members`
  
  ### 5. Fix Function Search Paths
  - Fix `is_event_creator` function
  - Fix `is_event_public` function
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_group_chats_created_by 
  ON public.group_chats(created_by);

CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id 
  ON public.group_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_smoke_sessions_created_by 
  ON public.smoke_sessions(created_by);

-- ============================================================================
-- 2. Remove Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_users_experience_level;
DROP INDEX IF EXISTS idx_users_cultivation_interest;
DROP INDEX IF EXISTS idx_users_preferred_strains;
DROP INDEX IF EXISTS idx_users_consumption_methods;
DROP INDEX IF EXISTS idx_users_interests;
DROP INDEX IF EXISTS idx_smoke_sessions_scheduled;

-- ============================================================================
-- 3. Fix Duplicate SELECT Policy on group_members (Drop the duplicate first)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;

-- ============================================================================
-- 4. Optimize RLS Policies - group_members
-- ============================================================================

DROP POLICY IF EXISTS "Users can view members of private groups they belong to" ON public.group_members;
CREATE POLICY "Users can view members of private groups they belong to"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;
CREATE POLICY "Users can leave groups"
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 5. Optimize RLS Policies - smoke_sessions
-- ============================================================================

DROP POLICY IF EXISTS "Users can view public events or their own" ON public.smoke_sessions;
CREATE POLICY "Users can view public events or their own"
  ON public.smoke_sessions
  FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create events" ON public.smoke_sessions;
CREATE POLICY "Users can create events"
  ON public.smoke_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Event creators can update their events" ON public.smoke_sessions;
CREATE POLICY "Event creators can update their events"
  ON public.smoke_sessions
  FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Event creators can delete their events" ON public.smoke_sessions;
CREATE POLICY "Event creators can delete their events"
  ON public.smoke_sessions
  FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================================
-- 6. Optimize RLS Policies - session_attendees
-- ============================================================================

DROP POLICY IF EXISTS "Users can view attendees of public events or events they create" ON public.session_attendees;
CREATE POLICY "Users can view attendees of public events or events they create"
  ON public.session_attendees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM smoke_sessions
      WHERE smoke_sessions.id = session_attendees.session_id
      AND (smoke_sessions.is_public = true OR smoke_sessions.created_by = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can RSVP to events" ON public.session_attendees;
CREATE POLICY "Users can RSVP to events"
  ON public.session_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their RSVP" ON public.session_attendees;
CREATE POLICY "Users can update their RSVP"
  ON public.session_attendees
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can remove their RSVP" ON public.session_attendees;
CREATE POLICY "Users can remove their RSVP"
  ON public.session_attendees
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 7. Optimize RLS Policies - group_messages
-- ============================================================================

DROP POLICY IF EXISTS "Group members can view messages" ON public.group_messages;
CREATE POLICY "Group members can view messages"
  ON public.group_messages
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Group members can send messages" ON public.group_messages;
CREATE POLICY "Group members can send messages"
  ON public.group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())
    AND group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 8. Optimize RLS Policies - group_chats
-- ============================================================================

DROP POLICY IF EXISTS "Users can view public groups" ON public.group_chats;
CREATE POLICY "Users can view public groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (
    is_public = true 
    OR EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = group_chats.id 
      AND group_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create groups" ON public.group_chats;
CREATE POLICY "Users can create groups"
  ON public.group_chats
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Group admins can update their groups" ON public.group_chats;
CREATE POLICY "Group admins can update their groups"
  ON public.group_chats
  FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Group admins can delete their groups" ON public.group_chats;
CREATE POLICY "Group admins can delete their groups"
  ON public.group_chats
  FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================================
-- 9. Fix Function Search Paths (after policies are updated)
-- ============================================================================

-- Recreate is_event_creator with proper security
CREATE OR REPLACE FUNCTION public.is_event_creator(event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM smoke_sessions
    WHERE id = event_id
    AND created_by = auth.uid()
  );
END;
$$;

-- Recreate is_event_public with proper security
CREATE OR REPLACE FUNCTION public.is_event_public(event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM smoke_sessions
    WHERE id = event_id
    AND is_public = true
  );
END;
$$;
