/*
  # Fix Group Members Policy for Public Groups

  1. Problem
    - Users cannot view member counts in public groups
    - Current policy only allows viewing:
      a) Your own memberships
      b) Memberships in groups you created
    - But the app needs to display member counts for ALL public groups

  2. Solution
    - Update group_members SELECT policy to allow viewing memberships in public groups
    - This doesn't create circular dependency because:
      a) group_chats.is_public is a simple boolean column check
      b) No EXISTS subquery back to group_members

  3. Changes
    - Drop and recreate group_members SELECT policy with public group support
*/

-- Drop the current policy
DROP POLICY IF EXISTS "Users can view group memberships" ON group_members;

-- Recreate with public group support
-- Users can see:
-- 1. Their own memberships
-- 2. Memberships in groups they created
-- 3. ALL memberships in public groups (for member counts)
CREATE POLICY "Users can view group memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (
    -- User is viewing their own membership
    user_id = auth.uid()
    OR
    -- User created the group
    EXISTS (
      SELECT 1 FROM group_chats 
      WHERE group_chats.id = group_members.group_id 
      AND group_chats.created_by = auth.uid()
    )
    OR
    -- The group is public (allows viewing member counts)
    EXISTS (
      SELECT 1 FROM group_chats 
      WHERE group_chats.id = group_members.group_id 
      AND group_chats.is_public = true
    )
  );
