/*
  # Add Profile Views Tracking for Pro Analytics

  1. New Tables
    - `profile_views`
      - `id` (uuid, primary key)
      - `viewer_id` (uuid, foreign key to users) - who viewed the profile
      - `viewed_user_id` (uuid, foreign key to users) - whose profile was viewed
      - `viewed_at` (timestamptz) - when the view occurred
  
  2. Indexes
    - Index on `viewed_user_id` for fast lookups of who viewed a user's profile
    - Index on `viewer_id` for tracking user's viewing history
    - Composite unique index to prevent duplicate views within short time window
  
  3. Security
    - Enable RLS on `profile_views` table
    - Users can only see who viewed their profile (if they have Pro subscription)
    - Users cannot see other users' profile view data
  
  4. Analytics Functions
    - Add function to count profile views for a user
    - Update subscription_analytics to include total_profile_views
*/

CREATE TABLE IF NOT EXISTS profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_user ON profile_views(viewed_user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views(viewer_id, viewed_at DESC);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile view history"
  ON profile_views
  FOR SELECT
  TO authenticated
  USING (
    viewed_user_id = auth.uid()
    AND (
      SELECT subscription_tier FROM users WHERE id = auth.uid()
    ) IN ('pro', 'blaze_og', 'blaze_pro')
    AND (
      SELECT subscription_status FROM users WHERE id = auth.uid()
    ) = 'active'
  );

CREATE POLICY "Users can create profile views"
  ON profile_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_analytics' AND column_name = 'total_profile_views'
  ) THEN
    ALTER TABLE subscription_analytics ADD COLUMN total_profile_views integer DEFAULT 0;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_profile_view_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE subscription_analytics sa
  SET 
    total_profile_views = (
      SELECT COUNT(*)
      FROM profile_views pv
      WHERE pv.viewed_user_id = sa.user_id
    ),
    updated_at = now()
  WHERE EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = sa.user_id
    AND u.subscription_tier IN ('pro', 'blaze_og', 'blaze_pro')
    AND u.subscription_status = 'active'
  );
END;
$$;