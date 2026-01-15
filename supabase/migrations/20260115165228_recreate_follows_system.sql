/*
  # Recreate Follows System

  1. New Tables
    - `follows`
      - `id` (uuid, primary key)
      - `follower_id` (uuid, references users) - person doing the following
      - `followed_id` (uuid, references users) - person being followed
      - `created_at` (timestamptz)
      - Unique constraint on (follower_id, followed_id) to prevent duplicate follows

  2. Security
    - Enable RLS on `follows` table
    - Users can insert their own follows (where follower_id = auth.uid())
    - Users can delete their own follows (where follower_id = auth.uid())
    - Users can view follows where they are either the follower or followed
    - Add indexes for performance on follower_id and followed_id

  3. Columns Added to Users Table
    - `follower_count` (integer, default 0) - count of followers
    - `following_count` (integer, default 0) - count of users they follow

  4. Functions
    - Trigger to automatically update follower/following counts
*/

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT follows_unique UNIQUE (follower_id, followed_id),
  CONSTRAINT no_self_follow CHECK (follower_id != followed_id)
);

-- Add follower/following counts to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'follower_count'
  ) THEN
    ALTER TABLE users ADD COLUMN follower_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'following_count'
  ) THEN
    ALTER TABLE users ADD COLUMN following_count integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_followed_id_idx ON follows(followed_id);
CREATE INDEX IF NOT EXISTS follows_created_at_idx ON follows(created_at DESC);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own follows" ON follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON follows;
DROP POLICY IF EXISTS "Users can view follows they are involved in" ON follows;

-- RLS Policies for follows table
CREATE POLICY "Users can insert their own follows"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

CREATE POLICY "Users can view follows they are involved in"
  ON follows FOR SELECT
  TO authenticated
  USING (
    auth.uid() = follower_id OR 
    auth.uid() = followed_id
  );

-- Function to update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following count for follower
    UPDATE users 
    SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
    
    -- Increment follower count for followed user
    UPDATE users 
    SET follower_count = follower_count + 1 
    WHERE id = NEW.followed_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement following count for follower
    UPDATE users 
    SET following_count = GREATEST(following_count - 1, 0)
    WHERE id = OLD.follower_id;
    
    -- Decrement follower count for followed user
    UPDATE users 
    SET follower_count = GREATEST(follower_count - 1, 0)
    WHERE id = OLD.followed_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger for follow counts
DROP TRIGGER IF EXISTS update_follow_counts_trigger ON follows;
CREATE TRIGGER update_follow_counts_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- Enable realtime for follows table
ALTER PUBLICATION supabase_realtime ADD TABLE follows;