/*
  # Add Instagram-Style Stories Feature

  ## Overview
  Implements Instagram-style stories that expire after 24 hours.

  ## New Tables
  
  ### `stories`
  - `id` (uuid, primary key) - Unique story identifier
  - `user_id` (uuid, foreign key) - Reference to users table
  - `image_url` (text) - URL to story image in storage
  - `created_at` (timestamptz) - When story was posted
  - `expires_at` (timestamptz) - When story expires (24h from creation)
  
  ### `story_views`
  - `id` (uuid, primary key) - Unique view identifier
  - `story_id` (uuid, foreign key) - Reference to stories table
  - `viewer_id` (uuid, foreign key) - User who viewed the story
  - `viewed_at` (timestamptz) - When story was viewed
  
  ## Storage
  - Creates `stories` bucket for story images with 24-hour lifecycle policy
  
  ## Security
  - Enable RLS on both tables
  - Users can create their own stories
  - Users can view stories from non-blocked users
  - Users can view their own story views
  - Only story owner can see who viewed their story
  
  ## Indexes
  - Index on user_id for fast story lookups
  - Index on expires_at for cleanup queries
  - Composite index on story_id and viewer_id for view tracking
*/

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Create story_views table
CREATE TABLE IF NOT EXISTS story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON story_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_story_views_composite ON story_views(story_id, viewer_id);

-- Enable RLS
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Stories policies
CREATE POLICY "Users can create own stories"
  ON stories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view non-expired stories from non-blocked users"
  ON stories FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = stories.user_id)
         OR (blocker_id = stories.user_id AND blocked_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own stories"
  ON stories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Story views policies
CREATE POLICY "Users can record story views"
  ON story_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can view their own story views"
  ON story_views FOR SELECT
  TO authenticated
  USING (auth.uid() = viewer_id);

CREATE POLICY "Story owners can see who viewed their stories"
  ON story_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = story_views.story_id
      AND stories.user_id = auth.uid()
    )
  );

-- Create storage bucket for stories
INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for stories bucket
CREATE POLICY "Users can upload own stories"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view stories"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'stories');

CREATE POLICY "Users can delete own stories"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'stories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Enable realtime for stories
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE story_views;