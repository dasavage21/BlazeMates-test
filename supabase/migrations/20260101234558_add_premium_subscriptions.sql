/*
  # Add Premium Subscriptions System

  1. Changes to Users Table
    - `subscription_tier` (text) - free, blaze_og
    - `subscription_status` (text) - active, canceled, expired
    - `subscription_expires_at` (timestamptz) - when subscription ends
    - `super_likes_remaining` (integer) - monthly super likes count
    - `super_likes_reset_at` (timestamptz) - when super likes reset

  2. New Tables
    - `subscription_analytics`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `swipe_through_rate` (numeric) - percentage of profiles swiped on
      - `match_likelihood_score` (numeric) - predicted match success rate
      - `total_swipes` (integer)
      - `total_likes_sent` (integer)
      - `total_likes_received` (integer)
      - `updated_at` (timestamptz)

    - `super_likes`
      - `id` (uuid, primary key)
      - `from_user_id` (uuid, foreign key to users)
      - `to_user_id` (uuid, foreign key to users)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on new tables
    - Add policies for authenticated users to manage their own data
*/

-- Add subscription fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'blaze_og'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'expired'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS super_likes_remaining integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS super_likes_reset_at timestamptz;

-- Create subscription analytics table
CREATE TABLE IF NOT EXISTS subscription_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  swipe_through_rate numeric DEFAULT 0,
  match_likelihood_score numeric DEFAULT 0,
  total_swipes integer DEFAULT 0,
  total_likes_sent integer DEFAULT 0,
  total_likes_received integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics"
  ON subscription_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create super likes table
CREATE TABLE IF NOT EXISTS super_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  to_user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

ALTER TABLE super_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view super likes sent to them"
  ON super_likes FOR SELECT
  TO authenticated
  USING (auth.uid() = to_user_id);

CREATE POLICY "Users can send super likes"
  ON super_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can delete own super likes"
  ON super_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id);

-- Function to reset super likes monthly
CREATE OR REPLACE FUNCTION reset_super_likes()
RETURNS void AS $$
BEGIN
  UPDATE users
  SET 
    super_likes_remaining = CASE 
      WHEN subscription_tier = 'blaze_og' THEN 10
      ELSE 0
    END,
    super_likes_reset_at = now() + interval '30 days'
  WHERE 
    subscription_tier = 'blaze_og' 
    AND subscription_status = 'active'
    AND (super_likes_reset_at IS NULL OR super_likes_reset_at <= now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update analytics
CREATE OR REPLACE FUNCTION update_user_analytics(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_total_swipes integer;
  v_total_likes_sent integer;
  v_total_likes_received integer;
  v_swipe_rate numeric;
  v_match_score numeric;
BEGIN
  -- Count total likes sent
  SELECT COUNT(*) INTO v_total_likes_sent
  FROM likes
  WHERE liker_id = p_user_id;

  -- Count total likes received
  SELECT COUNT(*) INTO v_total_likes_received
  FROM likes
  WHERE liked_id = p_user_id;

  -- Estimate total swipes (likes are a subset of swipes)
  v_total_swipes := v_total_likes_sent * 2;

  -- Calculate swipe through rate
  IF v_total_swipes > 0 THEN
    v_swipe_rate := (v_total_likes_sent::numeric / v_total_swipes::numeric) * 100;
  ELSE
    v_swipe_rate := 0;
  END IF;

  -- Calculate match likelihood score
  IF v_total_likes_sent > 0 THEN
    v_match_score := (v_total_likes_received::numeric / GREATEST(v_total_likes_sent, 1)::numeric) * 100;
  ELSE
    v_match_score := 0;
  END IF;

  -- Insert or update analytics
  INSERT INTO subscription_analytics (
    user_id,
    swipe_through_rate,
    match_likelihood_score,
    total_swipes,
    total_likes_sent,
    total_likes_received,
    updated_at
  ) VALUES (
    p_user_id,
    v_swipe_rate,
    v_match_score,
    v_total_swipes,
    v_total_likes_sent,
    v_total_likes_received,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    swipe_through_rate = EXCLUDED.swipe_through_rate,
    match_likelihood_score = EXCLUDED.match_likelihood_score,
    total_swipes = EXCLUDED.total_swipes,
    total_likes_sent = EXCLUDED.total_likes_sent,
    total_likes_received = EXCLUDED.total_likes_received,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for subscription updates
ALTER PUBLICATION supabase_realtime ADD TABLE super_likes;
