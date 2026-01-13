/*
  # Blaze Level Gamification System

  1. New Columns
    - `activity_points` (integer) - Tracks user engagement points
    - `last_login_date` (date) - Tracks daily login streaks
    - `login_streak` (integer) - Current consecutive login days

  2. Functions
    - `calculate_blaze_level(points)` - Calculates level from activity points
    - `update_user_blaze_level(user_id)` - Updates user's blaze level based on points
    - `award_activity_points(user_id, points, reason)` - Awards points to user

  3. Triggers
    - Award points when users send messages
    - Award points when users get matches (mutual likes)
    - Award points when users receive likes

  4. Point System
    - Daily login: 10 points
    - Sending message: 5 points
    - Getting a match: 20 points
    - Receiving a like: 2 points
    - Level formula: floor(sqrt(points / 50)) + 1
*/

-- Add activity tracking columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'activity_points'
  ) THEN
    ALTER TABLE users ADD COLUMN activity_points integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login_date'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'login_streak'
  ) THEN
    ALTER TABLE users ADD COLUMN login_streak integer DEFAULT 0;
  END IF;
END $$;

-- Function to calculate blaze level from activity points
CREATE OR REPLACE FUNCTION calculate_blaze_level(points integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Level formula: floor(sqrt(points / 50)) + 1
  -- Level 1: 0-49 points
  -- Level 2: 50-199 points
  -- Level 3: 200-449 points
  -- Level 4: 450-799 points, etc.
  RETURN floor(sqrt(points::numeric / 50)) + 1;
END;
$$;

-- Function to update user's blaze level
CREATE OR REPLACE FUNCTION update_user_blaze_level(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
  v_new_level integer;
BEGIN
  -- Get current activity points
  SELECT activity_points INTO v_points
  FROM users
  WHERE id = p_user_id;

  -- Calculate new level
  v_new_level := calculate_blaze_level(v_points);

  -- Update user's level
  UPDATE users
  SET blaze_level = v_new_level
  WHERE id = p_user_id;
END;
$$;

-- Function to award activity points
CREATE OR REPLACE FUNCTION award_activity_points(
  p_user_id uuid,
  p_points integer,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add points to user
  UPDATE users
  SET activity_points = activity_points + p_points
  WHERE id = p_user_id;

  -- Update blaze level
  PERFORM update_user_blaze_level(p_user_id);
END;
$$;

-- Trigger function to award points when messages are sent
CREATE OR REPLACE FUNCTION award_points_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award 5 points for sending a message
  PERFORM award_activity_points(NEW.user_id, 5, 'message_sent');
  RETURN NEW;
END;
$$;

-- Trigger function to award points when matches occur
CREATE OR REPLACE FUNCTION award_points_on_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_match boolean;
BEGIN
  -- Check if this like creates a match (mutual like)
  SELECT EXISTS (
    SELECT 1 FROM likes
    WHERE user_id = NEW.liked_user_id
    AND liked_user_id = NEW.user_id
  ) INTO v_is_match;

  IF v_is_match THEN
    -- Award 20 points to both users for getting a match
    PERFORM award_activity_points(NEW.user_id, 20, 'match_created');
    PERFORM award_activity_points(NEW.liked_user_id, 20, 'match_created');
  ELSE
    -- Award 2 points to the liked user for receiving a like
    PERFORM award_activity_points(NEW.liked_user_id, 2, 'like_received');
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_award_points_on_message ON messages;
CREATE TRIGGER trigger_award_points_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_message();

DROP TRIGGER IF EXISTS trigger_award_points_on_match ON likes;
CREATE TRIGGER trigger_award_points_on_match
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_match();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_activity_points ON users(activity_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_blaze_level ON users(blaze_level DESC);