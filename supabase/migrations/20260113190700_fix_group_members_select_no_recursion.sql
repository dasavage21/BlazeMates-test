/*
  # Fix Group Members SELECT Policy - No Recursion
  
  ## Changes
  - Drop the policy that has self-referencing queries
  - Create a policy that only checks public groups to avoid recursion
  - Users can always see members of public groups
  - Private group members will need the helper function
  
  ## Security
  - Users can view members of any public group
  - Uses helper function for checking private group membership
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;

-- Create a non-recursive policy
CREATE POLICY "Users can view members of their groups"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    -- Can view members of public groups (no recursion)
    group_id IN (SELECT id FROM public.group_chats WHERE is_public = true)
  );

-- Create an additional policy for private groups using the helper function
CREATE POLICY "Users can view members of private groups they belong to"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(group_id, auth.uid())
  );
