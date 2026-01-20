/*
  # Fix Virtual Circles Infinite Recursion - V2

  1. Changes
    - Simplify circle_participants SELECT policy to avoid all circular dependencies
    - Use only direct checks without nested circle_participants queries

  2. Security
    - Users can see participants in public circles (check virtual_circles.is_public)
    - Users can see participants if they are the host (check virtual_circles.host_id)
    - Users can see their own participant record (check circle_participants.user_id directly)
*/

-- Drop the policy we just created
DROP POLICY IF EXISTS "Users can view participants in accessible circles" ON circle_participants;

-- Create a simpler policy without ANY circular references
CREATE POLICY "Users can view participants in accessible circles"
  ON circle_participants FOR SELECT
  TO authenticated
  USING (
    -- Can see their own participant record
    user_id = auth.uid()
    OR
    -- Can see if the circle is public
    EXISTS (
      SELECT 1 FROM virtual_circles vc
      WHERE vc.id = circle_participants.circle_id 
      AND vc.is_public = true
    )
    OR
    -- Can see if they are the host of the circle
    EXISTS (
      SELECT 1 FROM virtual_circles vc
      WHERE vc.id = circle_participants.circle_id 
      AND vc.host_id = auth.uid()
    )
  );