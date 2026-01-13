/*
  # Fix Infinite Recursion in Group Chats RLS Policies

  ## Changes
  - Drop existing circular RLS policies on group_chats and group_members
  - Create security definer helper functions to check membership
  - Recreate RLS policies using helper functions to avoid recursion

  ## Security
  - Helper functions use SECURITY DEFINER to bypass RLS when checking membership
  - All policies still enforce proper access control
  - No data leakage, just improved query structure
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view public groups" ON public.group_chats;
DROP POLICY IF EXISTS "Group admins can update their groups" ON public.group_chats;
DROP POLICY IF EXISTS "Group admins can delete their groups" ON public.group_chats;
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

-- Create security definer function to check if user is a group member
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- Create security definer function to check if user is a group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

-- Recreate group_chats policies without circular references
CREATE POLICY "Users can view public groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (
    is_public = true 
    OR created_by = auth.uid()
    OR public.is_group_member(id, auth.uid())
  );

CREATE POLICY "Group admins can update their groups"
  ON public.group_chats
  FOR UPDATE
  TO authenticated
  USING (public.is_group_admin(id, auth.uid()))
  WITH CHECK (public.is_group_admin(id, auth.uid()));

CREATE POLICY "Group admins can delete their groups"
  ON public.group_chats
  FOR DELETE
  TO authenticated
  USING (public.is_group_admin(id, auth.uid()));

-- Recreate group_members policies without circular references
CREATE POLICY "Users can view members of their groups"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(group_id, auth.uid())
    OR group_id IN (SELECT id FROM public.group_chats WHERE is_public = true)
  );

CREATE POLICY "Users can leave groups"
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_group_admin(group_id, auth.uid())
  );
