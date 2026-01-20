/*
  # Break Circular Dependency in Group Chats Policy

  1. Problem
    - group_chats SELECT policy checks group_members table
    - group_members SELECT policy checks group_chats table
    - This creates infinite recursion even with security definer function

  2. Solution
    - Simplify group_chats SELECT policy to NOT reference group_members
    - Public groups: viewable by all authenticated users
    - Private groups: only viewable by creator
    - Member-based access will be handled in application layer by joining tables

  3. Changes
    - Drop and recreate group_chats SELECT policy without group_members reference
*/

-- Drop the existing policy that causes circular dependency
DROP POLICY IF EXISTS "Users can view accessible groups" ON group_chats;

-- Create simplified policy without group_members reference
CREATE POLICY "Users can view accessible groups"
  ON group_chats
  FOR SELECT
  TO authenticated
  USING (
    -- Public groups are visible to everyone
    is_public = true
    OR
    -- Private groups only visible to creator
    created_by = auth.uid()
  );

-- Note: To see private groups where user is a member (but not creator),
-- the application should query group_members first to get group_ids,
-- then fetch those specific groups by ID
