/*
  # Add SELECT policy for reports table

  1. Changes
    - Add policy allowing users to view their own submitted reports
    - This enables the .select() call after .insert() to work properly

  2. Security
    - Users can only see reports they submitted
    - Admin viewing requires service role (unchanged)
*/

CREATE POLICY "Users can view their own reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);