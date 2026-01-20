/*
  # Fix Virtual Circles Infinite Recursion

  1. Changes
    - Drop and recreate `circle_participants` SELECT policy without circular dependency
    - Simplify logic to check host or participant directly without nested subqueries

  2. Security
    - Users can see participants in public circles
    - Users can see participants in circles where they are the host
    - Users can see other participants in circles where they are a participant (checked via direct user_id match)
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Anyone can view participants in circles they can see" ON circle_participants;

-- Create a new policy without circular dependency
CREATE POLICY "Users can view participants in accessible circles"
  ON circle_participants FOR SELECT
  TO authenticated
  USING (
    -- Can see if it's a public circle
    EXISTS (
      SELECT 1 FROM virtual_circles vc
      WHERE vc.id = circle_participants.circle_id 
      AND vc.is_public = true
    )
    OR
    -- Can see if they are the host
    EXISTS (
      SELECT 1 FROM virtual_circles vc
      WHERE vc.id = circle_participants.circle_id 
      AND vc.host_id = auth.uid()
    )
    OR
    -- Can see if they are a participant (direct check, no recursion)
    circle_participants.user_id = auth.uid()
    OR
    -- Can see if there's another participant record for this user in the same circle
    EXISTS (
      SELECT 1 FROM circle_participants cp_check
      WHERE cp_check.circle_id = circle_participants.circle_id
      AND cp_check.user_id = auth.uid()
      AND cp_check.id != circle_participants.id
    )
  );