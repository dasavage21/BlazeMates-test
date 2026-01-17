/*
  # Fix Post Like Point Farming
  
  1. New Table
    - `post_like_points_awarded` - Tracks which user+post combinations have received points
      - Prevents point farming by unliking/reliking the same post
  
  2. Changes
    - Update `award_points_on_post_like` trigger to check history before awarding points
    - Only award points the FIRST time a user likes a specific post (ever)
  
  3. Security
    - Enable RLS on new table
    - Only system can insert/update (via trigger)
*/

-- Create table to track which likes have been awarded points
CREATE TABLE IF NOT EXISTS post_like_points_awarded (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  awarded_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- Enable RLS (only system can modify via triggers)
ALTER TABLE post_like_points_awarded ENABLE ROW LEVEL SECURITY;

-- No policies needed - only triggers can insert
CREATE POLICY "No direct access"
  ON post_like_points_awarded FOR ALL
  TO authenticated
  USING (false);

-- Update trigger to prevent point farming
CREATE OR REPLACE FUNCTION award_points_on_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_already_awarded boolean;
BEGIN
  -- Get the post author's ID
  SELECT user_id INTO v_post_author_id
  FROM feed_posts
  WHERE id = NEW.post_id;
  
  -- Check if points were already awarded for this user+post combo
  SELECT EXISTS (
    SELECT 1 FROM post_like_points_awarded
    WHERE user_id = NEW.user_id AND post_id = NEW.post_id
  ) INTO v_already_awarded;
  
  -- Only award points if this is the first time EVER this user liked this post
  IF v_post_author_id IS NOT NULL AND NOT v_already_awarded THEN
    PERFORM award_activity_points(v_post_author_id, 5, 'post_liked');
    
    -- Mark that points have been awarded for this combination
    INSERT INTO post_like_points_awarded (user_id, post_id)
    VALUES (NEW.user_id, NEW.post_id)
    ON CONFLICT (user_id, post_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_award_points_on_post_like ON post_likes;
CREATE TRIGGER trigger_award_points_on_post_like
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_post_like();

-- Populate existing likes into the history table to prevent retroactive farming
INSERT INTO post_like_points_awarded (user_id, post_id, awarded_at)
SELECT user_id, post_id, created_at
FROM post_likes
ON CONFLICT (user_id, post_id) DO NOTHING;
