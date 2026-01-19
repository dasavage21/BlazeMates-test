/*
  # Post Tags and Blaze Moments Feature

  ## Overview
  This migration adds hashtag support and 24-hour Blaze Moments to the feed system.

  ## Changes Made

  ### 1. Feed Posts Table Updates
  - Add `tags` column: Array of hashtags for categorizing posts
  - Add `is_moment` column: Boolean flag for 24-hour temporary posts
  - Add `expires_at` column: Timestamp when moments auto-delete
  - Add index on expires_at for efficient cleanup queries
  - Add index on tags using GIN for fast tag searches

  ### 2. Trending Tags Table
  - `tag`: The hashtag text (primary key)
  - `usage_count`: Number of times used this week
  - `last_used_at`: Most recent usage timestamp
  - `week_start`: Start of the tracking week for analytics

  ### 3. Automation
  - Trigger to update trending_tags when posts are created
  - Function to clean up expired Blaze Moments (call via cron)

  ## Available Tags
  - #Sesh - Smoke session posts
  - #Pickup - New strain/product acquisitions
  - #Chill - Relaxing moments
  - #420Friendly - Community-friendly content
  - #Events - Upcoming gatherings

  ## Security
  - RLS policies updated to handle moments visibility
  - Trending tags are publicly readable
*/

-- Add tags and moments support to feed_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feed_posts' AND column_name = 'tags'
  ) THEN
    ALTER TABLE feed_posts ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feed_posts' AND column_name = 'is_moment'
  ) THEN
    ALTER TABLE feed_posts ADD COLUMN is_moment boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feed_posts' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE feed_posts ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feed_posts_tags ON feed_posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_feed_posts_expires_at ON feed_posts (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_posts_is_moment ON feed_posts (is_moment) WHERE is_moment = true;

-- Create trending_tags table
CREATE TABLE IF NOT EXISTS trending_tags (
  tag text PRIMARY KEY,
  usage_count integer DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  week_start date DEFAULT date_trunc('week', now())::date
);

ALTER TABLE trending_tags ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read trending tags
CREATE POLICY "Anyone can view trending tags"
  ON trending_tags FOR SELECT
  TO authenticated
  USING (true);

-- Function to update trending tags when posts are created
CREATE OR REPLACE FUNCTION update_trending_tags()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  tag_item text;
  current_week date;
BEGIN
  IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
    current_week := date_trunc('week', now())::date;
    
    FOREACH tag_item IN ARRAY NEW.tags
    LOOP
      INSERT INTO trending_tags (tag, usage_count, last_used_at, week_start)
      VALUES (tag_item, 1, now(), current_week)
      ON CONFLICT (tag) DO UPDATE SET
        usage_count = CASE 
          WHEN trending_tags.week_start = current_week 
          THEN trending_tags.usage_count + 1
          ELSE 1
        END,
        last_used_at = now(),
        week_start = current_week;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for trending tags
DROP TRIGGER IF EXISTS trigger_update_trending_tags ON feed_posts;
CREATE TRIGGER trigger_update_trending_tags
  AFTER INSERT ON feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_trending_tags();

-- Function to delete expired Blaze Moments
CREATE OR REPLACE FUNCTION delete_expired_moments()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM feed_posts
  WHERE is_moment = true
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;

-- Update feed_posts RLS to hide expired moments
DROP POLICY IF EXISTS "Users can view non-blocked feed posts" ON feed_posts;
CREATE POLICY "Users can view non-blocked feed posts"
  ON feed_posts FOR SELECT
  TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = feed_posts.user_id)
         OR (blocker_id = feed_posts.user_id AND blocked_id = auth.uid())
    )
  );

-- Add check constraint to ensure moments have expiration
ALTER TABLE feed_posts DROP CONSTRAINT IF EXISTS check_moment_has_expiration;
ALTER TABLE feed_posts ADD CONSTRAINT check_moment_has_expiration
  CHECK (
    (is_moment = false) OR 
    (is_moment = true AND expires_at IS NOT NULL)
  );
