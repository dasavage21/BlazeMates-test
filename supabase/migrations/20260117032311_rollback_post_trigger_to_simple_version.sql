/*
  # Rollback Post Trigger to Simple Version
  
  1. Changes
    - Simplify award_points_on_post trigger
    - Remove complex logic that might be causing issues
    - Keep point farming protection but simplify implementation
  
  2. Security
    - Maintain data integrity
    - Keep farming protection
*/

-- Simplify the trigger - just award points normally
CREATE OR REPLACE FUNCTION award_points_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award points and track in one go
  INSERT INTO post_points_awarded (post_id)
  VALUES (NEW.id)
  ON CONFLICT (post_id) DO NOTHING;
  
  -- Only award if insert succeeded (wasn't a duplicate)
  IF FOUND THEN
    PERFORM award_activity_points(NEW.user_id, 15, 'create_post');
  END IF;
  
  RETURN NEW;
END;
$$;
