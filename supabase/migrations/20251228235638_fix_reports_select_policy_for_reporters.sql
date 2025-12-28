/*
  # Fix Reports SELECT Policy for Reporters

  ## Changes
    - Add new policy allowing users to SELECT their own submitted reports
    - Keep existing policy for super admins to view all reports
    
  ## Security
    - Users can only view reports they submitted (reporter_id = auth.uid())
    - Super admins can still view all reports
*/

-- Drop the restrictive admin-only SELECT policy
DROP POLICY IF EXISTS "Only super admins can view all reports" ON reports;

-- Allow users to view their own reports
CREATE POLICY "Users can view their own submitted reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Allow super admins to view all reports
CREATE POLICY "Super admins can view all reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_super_admin FROM auth.users WHERE id = auth.uid()) = true
  );