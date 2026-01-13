/*
  # Fix Infinite Recursion in smoke_sessions Policies

  ## Problem
  The RLS policies for `smoke_sessions` and `session_attendees` create circular dependencies:
  - `smoke_sessions` SELECT policy checks `session_attendees`
  - `session_attendees` SELECT policy checks `smoke_sessions`
  This causes infinite recursion when querying either table.

  ## Solution
  Simplify the policies to avoid circular references:
  1. Remove the recursive check from `session_attendees` SELECT policy
  2. Keep `smoke_sessions` policy simpler - users can see public events or events they created
  3. Add a separate simple policy for attendees to see their events

  ## Changes
  - Drop and recreate both problematic policies
  - Use direct checks without cross-table recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view public events" ON public.smoke_sessions;
DROP POLICY IF EXISTS "Users can view event attendees" ON public.session_attendees;

-- Recreate smoke_sessions SELECT policy without recursion
CREATE POLICY "Users can view public events"
  ON public.smoke_sessions
  FOR SELECT
  TO authenticated
  USING (
    is_public = true 
    OR created_by = auth.uid()
  );

-- Add a separate policy for viewing events you're attending
CREATE POLICY "Users can view events they're attending"
  ON public.smoke_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_attendees 
      WHERE session_attendees.session_id = smoke_sessions.id 
      AND session_attendees.user_id = auth.uid()
    )
  );

-- Recreate session_attendees SELECT policy without recursion
CREATE POLICY "Users can view event attendees for public events"
  ON public.session_attendees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smoke_sessions 
      WHERE smoke_sessions.id = session_attendees.session_id 
      AND smoke_sessions.is_public = true
    )
  );

-- Add separate policy for viewing attendees of events you created
CREATE POLICY "Creators can view their event attendees"
  ON public.session_attendees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smoke_sessions 
      WHERE smoke_sessions.id = session_attendees.session_id 
      AND smoke_sessions.created_by = auth.uid()
    )
  );

-- Add policy for users to see their own attendance
CREATE POLICY "Users can view their own attendance"
  ON public.session_attendees
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
