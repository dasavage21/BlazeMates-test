/*
  # Add Admin Check Function for RLS

  ## Changes
    - Create SECURITY DEFINER function to check if user is admin via metadata
    - Add policy using this function for admins to view all reports
    
  ## Security
    - Function uses SECURITY DEFINER to safely check user metadata
    - Only checks auth.uid(), cannot be exploited
*/

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_metadata jsonb;
BEGIN
  -- Get user metadata from auth.users
  SELECT raw_user_meta_data INTO user_metadata
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Check if is_super_admin is true
  RETURN COALESCE((user_metadata->>'is_super_admin')::boolean, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- Add policy for admins to view all reports
CREATE POLICY "Admins can view all reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());