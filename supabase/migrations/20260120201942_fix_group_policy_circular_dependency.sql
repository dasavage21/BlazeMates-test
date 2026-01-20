/*
  # Fix Circular Dependency in Group Policies

  1. Problem
    - group_chats SELECT policy checks group_members (EXISTS subquery)
    - group_members SELECT policy checks group_chats.is_public (EXISTS subquery)
    - This creates infinite recursion when querying public groups

  2. Solution
    - Create a SECURITY DEFINER function to check if a group is public
    - This function bypasses RLS, breaking the circular dependency
    - Update group_members policy to use this function

  3. Changes
    - Create is_group_public() security definer function
    - Update group_members SELECT policy to use this function
*/

-- Create a security definer function to check if a group is public
-- This bypasses RLS and breaks the circular dependency
CREATE OR REPLACE FUNCTION is_group_public(group_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT is_public FROM group_chats WHERE id = group_id_param;
$$;

-- Drop the current group_members SELECT policy
DROP POLICY IF EXISTS "Users can view group memberships" ON group_members;

-- Recreate with the security definer function to avoid circular dependency
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
    -- The group is public (uses security definer function to avoid recursion)
    is_group_public(group_members.group_id) = true
  );
