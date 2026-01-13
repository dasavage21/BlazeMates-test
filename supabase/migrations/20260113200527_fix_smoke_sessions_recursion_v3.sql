/*
  # Fix Infinite Recursion in smoke_sessions - Version 3

  ## Problem
  The cross-table checks between `smoke_sessions` and `session_attendees` cause 
  infinite recursion because RLS policies create circular dependencies.

  ## Solution
  Use security definer functions to bypass RLS for cross-table checks and 
  ensure all old policies are dropped before creating new ones.

  ## Changes
  - Drop ALL existing policies on both tables
  - Create security definer helper functions
  - Recreate simple policies using helper functions
*/

-- Drop ALL policies on smoke_sessions
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'smoke_sessions') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.smoke_sessions';
    END LOOP;
END $$;

-- Drop ALL policies on session_attendees
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'session_attendees') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.session_attendees';
    END LOOP;
END $$;

-- Helper function to check if user created an event (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_event_creator(event_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.smoke_sessions 
    WHERE id = event_id AND created_by = user_id
  );
$$;

-- Helper function to check if event is public (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_event_public(event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_public FROM public.smoke_sessions WHERE id = event_id),
    false
  );
$$;

-- Recreate smoke_sessions policies without cross-table checks
CREATE POLICY "Users can view public events or their own"
  ON public.smoke_sessions
  FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create events"
  ON public.smoke_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Event creators can update their events"
  ON public.smoke_sessions
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Event creators can delete their events"
  ON public.smoke_sessions
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Recreate session_attendees policies using helper functions
CREATE POLICY "Users can view attendees of public events or events they created"
  ON public.session_attendees
  FOR SELECT
  TO authenticated
  USING (
    public.is_event_public(session_id) = true
    OR public.is_event_creator(session_id, auth.uid()) = true
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can RSVP to events"
  ON public.session_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their RSVP"
  ON public.session_attendees
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their RSVP"
  ON public.session_attendees
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
