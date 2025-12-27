/*
  # Create Likes/Swipes Table

  1. New Tables
    - `likes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - person who liked
      - `liked_user_id` (uuid, references users table) - person who was liked
      - `created_at` (timestamp)
      - Unique constraint on (user_id, liked_user_id) to prevent duplicate likes

  2. Security
    - Enable RLS on `likes` table
    - Users can read their own likes
    - Users can create their own likes
    - Users cannot delete or update likes
*/

CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  liked_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, liked_user_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own likes"
  ON likes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own likes"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_liked_user_id ON likes(liked_user_id);