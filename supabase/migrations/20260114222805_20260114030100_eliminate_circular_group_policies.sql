/*
  # Eliminate All Circular Dependencies Between Group Tables

  ## Problem
  - group_chats policies query group_members
  - group_members policies query group_chats
  - This creates circular dependency causing infinite recursion

  ## Solution
  - group_chats policies will NEVER query group_members
  - group_members policies CAN query group_chats (one-way dependency only)
  - Use application-level logic for private group membership checks

  ## Security
  - Public groups visible to all authenticated users
  - Private groups only visible to creator
  - Members can be managed through application logic
*/

-- Drop all group_chats SELECT policies
DROP POLICY IF EXISTS "Users can view public groups" ON public.group_chats;
DROP POLICY IF EXISTS "Users can view their groups" ON public.group_chats;

-- Create simple, non-recursive group_chats policies
-- Public groups are visible to everyone
CREATE POLICY "Authenticated users can view public groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Creators can always view their own groups
CREATE POLICY "Creators can view their groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- For viewing private groups you're a member of, 
-- we'll handle this at the application level by joining the tables

-- Keep other group_chats policies simple
DROP POLICY IF EXISTS "Group admins can update their groups" ON public.group_chats;
DROP POLICY IF EXISTS "Group admins can delete their groups" ON public.group_chats;

CREATE POLICY "Creators can update their groups"
  ON public.group_chats
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can delete their groups"
  ON public.group_chats
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());