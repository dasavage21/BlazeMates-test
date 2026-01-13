/*
  # Add INSERT policy for subscription_analytics

  1. Changes
    - Add INSERT policy to allow users to create their own analytics row
    - This enables Pro users to automatically initialize their analytics when first viewing the page
  
  2. Security
    - Users can only insert their own analytics row (user_id must match auth.uid())
    - Policy is restrictive and validates ownership
*/

CREATE POLICY "Users can insert own analytics"
  ON subscription_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);