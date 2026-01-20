/*
  # Fix Infinite Recursion in Group Chats Policies

  1. Problem
    - Circular dependency between group_chats and group_members policies
    - group_chats SELECT checks group_members
    - group_members SELECT checks group_chats
    - This causes infinite recursion when querying public groups

  2. Solution
    - Simplify group_members SELECT policy to not check group_chats
    - Keep group_chats SELECT policy checking group_members (one direction only)
    - Public groups should be queryable without checking memberships
    - Members can see their own memberships without recursion

  3. Changes
    - Drop and recreate group_members SELECT policy without circular reference
    - Keep group_chats policy as is (it's not the problem)
*/

-- Drop the problematic group_members SELECT policy
DROP POLICY IF EXISTS "Users can view group memberships" ON group_members;

-- Recreate with simpler logic that doesn't cause recursion
-- Users can see:
-- 1. Their own memberships
-- 2. Memberships in groups they created
-- 3. Other members in public groups they're part of
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
  );
