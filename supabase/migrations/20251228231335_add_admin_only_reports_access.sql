/*
  # Add Admin-Only Access to Reports

  1. Changes
    - Add RLS policy to allow only super admins to view all reports
    - Remove the existing general select policy for reports
    - Ensure only users with is_super_admin = true can access reports

  2. Security
    - Restricts report viewing to super admins only
    - Maintains data integrity and privacy
*/

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
DROP POLICY IF EXISTS "Allow users to view reports" ON reports;
DROP POLICY IF EXISTS "Users can read reports" ON reports;

-- Create admin-only select policy for reports
CREATE POLICY "Only super admins can view all reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.is_super_admin = true
    )
  );
