/*
  # Fix Virtual Circles SELECT Policy

  1. Changes
    - Drop and recreate `virtual_circles` SELECT policy without checking circle_participants
    - Only allow users to see public circles or circles they host
    - Participants will need to look up circles by room_code or other means

  2. Security
    - Users can see all public circles
    - Users can see circles they host
    - Removed circular dependency with circle_participants table
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Anyone can view public active circles" ON virtual_circles;

-- Create a new policy without circular dependency
CREATE POLICY "Users can view public circles or their own"
  ON virtual_circles FOR SELECT
  TO authenticated
  USING (
    is_public = true 
    OR host_id = auth.uid()
  );