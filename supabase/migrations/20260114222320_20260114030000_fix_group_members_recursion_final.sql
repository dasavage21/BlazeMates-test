/*
  # Fix Group Members Infinite Recursion - Final Solution

  ## Problem
  - RLS policies on group_members call is_group_member function
  - is_group_member queries group_members table
  - This creates infinite recursion even with SECURITY DEFINER

  ## Solution
  - Remove ALL policies from group_members that call helper functions
  - Use only direct, non-recursive checks
  - Allow users to see their own memberships
  - Allow users to see members of public groups

  ## Security
  - Users can only see their own memberships
  - Users can see members of public groups
  - Group admins can manage members through application logic
*/

-- Drop ALL existing policies on group_members to start fresh
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can view members of private groups they belong to" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;

-- Simple non-recursive policy: users can view their own memberships
CREATE POLICY "Users can view their own memberships"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Non-recursive policy: users can view members of public groups
CREATE POLICY "Users can view public group members"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE group_chats.id = group_members.group_id
      AND group_chats.is_public = true
    )
  );

-- Users can insert themselves into public groups
CREATE POLICY "Users can join public groups"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE id = group_id
      AND is_public = true
    )
  );

-- Users can remove themselves from any group
CREATE POLICY "Users can leave groups"
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Group creators can add members (checked via group_chats.created_by)
CREATE POLICY "Group creators can add members"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE id = group_id
      AND created_by = auth.uid()
    )
  );

-- Group creators can remove members
CREATE POLICY "Group creators can remove members"
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE id = group_id
      AND created_by = auth.uid()
    )
  );

-- Now fix group_chats policies to not use the problematic helper function
DROP POLICY IF EXISTS "Users can view public groups" ON public.group_chats;

-- Recreate without calling is_group_member (which causes recursion)
CREATE POLICY "Users can view public groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR created_by = auth.uid()
  );

-- Allow users to see groups they are members of (checked through direct query)
CREATE POLICY "Users can view their groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );