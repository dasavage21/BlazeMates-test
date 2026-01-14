/*
  # Complete Policy Cleanup for Group Tables

  ## Problem
  - Still getting infinite recursion in group_chats
  - May have conflicting or duplicate policies

  ## Solution
  - Drop ALL policies on both tables
  - Recreate only essential, non-recursive policies
  - Ensure one-way dependency: group_members can reference group_chats, but not vice versa

  ## Security
  - Minimal policies for basic functionality
  - No circular dependencies
*/

-- Drop ALL policies on both tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'group_chats') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.group_chats';
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'group_members') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.group_members';
    END LOOP;
END $$;

-- GROUP_CHATS POLICIES (NO references to group_members allowed!)
CREATE POLICY "Anyone can view public groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can view their created groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create groups"
  ON public.group_chats
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

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

-- GROUP_MEMBERS POLICIES (can reference group_chats - one-way only)
CREATE POLICY "Users can view their own memberships"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view members of public groups"
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

CREATE POLICY "Users can leave any group"
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Group creators can add any members"
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

CREATE POLICY "Group creators can remove any members"
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