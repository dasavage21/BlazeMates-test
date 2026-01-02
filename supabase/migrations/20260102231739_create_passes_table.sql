/*
  # Create passes table for tracking left swipes

  1. New Tables
    - `passes`
      - `id` (uuid, primary key) - Unique identifier for each pass
      - `user_id` (uuid) - ID of user who swiped left
      - `passed_user_id` (uuid) - ID of user who was swiped left on
      - `created_at` (timestamptz) - When the pass occurred

  2. Security
    - Enable RLS on `passes` table
    - Add policy for users to insert their own passes
    - Add policy for users to view their own passes

  3. Indexes
    - Add index on user_id for fast lookups
    - Add unique constraint on (user_id, passed_user_id) to prevent duplicates
*/

-- Create passes table
CREATE TABLE IF NOT EXISTS passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  passed_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, passed_user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_passes_user_id ON passes(user_id);
CREATE INDEX IF NOT EXISTS idx_passes_passed_user_id ON passes(passed_user_id);

-- Enable RLS
ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own passes
CREATE POLICY "Users can create own passes"
  ON passes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own passes
CREATE POLICY "Users can view own passes"
  ON passes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);