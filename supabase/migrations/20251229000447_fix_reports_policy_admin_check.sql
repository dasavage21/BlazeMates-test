/*
  # Fix Reports Policy Admin Check

  ## Changes
    - Remove policy that queries auth.users directly (causes permission denied)
    - Keep only the policy for users to view their own reports
    - Admin viewing will need to be handled separately if needed
    
  ## Security
    - Users can only view reports they submitted (reporter_id = auth.uid())
    - RLS policies cannot query auth.users table
*/

-- Drop the problematic super admin policy
DROP POLICY IF EXISTS "Super admins can view all reports" ON reports;

-- The "Users can view their own submitted reports" policy remains and is sufficient
-- Admins should use service role or a backend function to view all reports