/*
  # Add Analytics Triggers for Likes and Passes

  1. Purpose
    - Automatically update subscription_analytics when likes or passes are created
    - Calculate swipe through rate and match likelihood in real-time
    - Ensure accurate performance metrics
  
  2. Changes
    - Create trigger function that updates analytics after likes/passes insert
    - Add trigger on likes table for INSERT operations
    - Add trigger on passes table for INSERT operations
    - Manually update analytics for existing users (only those in users table)
*/

-- Create trigger function for analytics updates
CREATE OR REPLACE FUNCTION trigger_update_swipe_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_swipes integer;
  v_total_likes_sent integer;
  v_total_likes_received integer;
  v_total_passes integer;
  v_swipe_rate numeric;
  v_match_score numeric;
  v_user_id uuid;
BEGIN
  -- Determine which user's analytics to update
  IF TG_TABLE_NAME = 'likes' THEN
    v_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'passes' THEN
    v_user_id := NEW.user_id;
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RETURN NEW;
  END IF;

  -- Count total likes sent by this user
  SELECT COUNT(*) INTO v_total_likes_sent
  FROM likes
  WHERE user_id = v_user_id;

  -- Count total likes received by this user
  SELECT COUNT(*) INTO v_total_likes_received
  FROM likes
  WHERE liked_user_id = v_user_id;

  -- Count total passes by this user
  SELECT COUNT(*) INTO v_total_passes
  FROM passes
  WHERE user_id = v_user_id;

  -- Calculate total swipes
  v_total_swipes := v_total_likes_sent + v_total_passes;

  -- Calculate swipe through rate (percentage of swipes that result in likes)
  IF v_total_swipes > 0 THEN
    v_swipe_rate := (v_total_likes_sent::numeric / v_total_swipes::numeric);
  ELSE
    v_swipe_rate := 0;
  END IF;

  -- Calculate match likelihood score (likes received / likes sent ratio)
  IF v_total_likes_sent > 0 THEN
    v_match_score := (v_total_likes_received::numeric / v_total_likes_sent::numeric);
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
    v_user_id,
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
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_like_inserted ON likes;
DROP TRIGGER IF EXISTS on_pass_inserted ON passes;

-- Create trigger on likes table
CREATE TRIGGER on_like_inserted
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_swipe_analytics();

-- Create trigger on passes table
CREATE TRIGGER on_pass_inserted
  AFTER INSERT ON passes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_swipe_analytics();

-- Update analytics for all existing users with activity (only valid users)
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT l.user_id 
    FROM likes l
    INNER JOIN users u ON l.user_id = u.id
    UNION
    SELECT DISTINCT p.user_id 
    FROM passes p
    INNER JOIN users u ON p.user_id = u.id
  LOOP
    -- Recalculate analytics for each user
    DECLARE
      v_total_swipes integer;
      v_total_likes_sent integer;
      v_total_likes_received integer;
      v_total_passes integer;
      v_swipe_rate numeric;
      v_match_score numeric;
    BEGIN
      SELECT COUNT(*) INTO v_total_likes_sent
      FROM likes
      WHERE user_id = user_record.user_id;

      SELECT COUNT(*) INTO v_total_likes_received
      FROM likes
      WHERE liked_user_id = user_record.user_id;

      SELECT COUNT(*) INTO v_total_passes
      FROM passes
      WHERE user_id = user_record.user_id;

      v_total_swipes := v_total_likes_sent + v_total_passes;

      IF v_total_swipes > 0 THEN
        v_swipe_rate := (v_total_likes_sent::numeric / v_total_swipes::numeric);
      ELSE
        v_swipe_rate := 0;
      END IF;

      IF v_total_likes_sent > 0 THEN
        v_match_score := (v_total_likes_received::numeric / v_total_likes_sent::numeric);
      ELSE
        v_match_score := 0;
      END IF;

      INSERT INTO subscription_analytics (
        user_id,
        swipe_through_rate,
        match_likelihood_score,
        total_swipes,
        total_likes_sent,
        total_likes_received,
        updated_at
      ) VALUES (
        user_record.user_id,
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
  END LOOP;
END $$;
