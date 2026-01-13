/*
  # Simplify Group Members SELECT Policy
  
  ## Changes
  - Drop the complex SELECT policy on group_members that uses is_group_member
  - Create a simpler policy that directly checks membership without recursion
  
  ## Security
  - Users can view members of public groups
  - Users can view members of groups they belong to
*/

-- Drop the existing complex policy
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;

-- Create a simpler policy without recursion
CREATE POLICY "Users can view members of their groups"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    -- Can view members of public groups
    group_id IN (SELECT id FROM public.group_chats WHERE is_public = true)
    -- Or can view members if they are in the group (direct check without function)
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2 
      WHERE gm2.group_id = group_members.group_id 
      AND gm2.user_id = auth.uid()
    )
  );
