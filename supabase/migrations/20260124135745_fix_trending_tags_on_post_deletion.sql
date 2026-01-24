/*
  # Fix Trending Tags on Post Deletion

  ## Overview
  Updates trending tag counts when posts are deleted to maintain accurate counts.

  ## Changes
  1. Creates a trigger to decrement trending tag counts when posts are deleted
  2. Ensures tag counts never go below zero
  3. Removes tags that reach zero usage

  ## Security
  - Function uses SECURITY DEFINER with proper search_path
*/

-- Function to update trending tags when posts are deleted
CREATE OR REPLACE FUNCTION decrement_trending_tags()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  tag_item text;
  current_week date;
BEGIN
  IF OLD.tags IS NOT NULL AND array_length(OLD.tags, 1) > 0 THEN
    current_week := date_trunc('week', now())::date;
    
    FOREACH tag_item IN ARRAY OLD.tags
    LOOP
      -- Decrement the usage count if it's from the current week
      UPDATE trending_tags
      SET usage_count = GREATEST(usage_count - 1, 0)
      WHERE tag = tag_item AND week_start = current_week;
      
      -- Remove tag if usage count reaches 0
      DELETE FROM trending_tags
      WHERE tag = tag_item AND usage_count = 0;
    END LOOP;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger for post deletion
DROP TRIGGER IF EXISTS trigger_decrement_trending_tags ON feed_posts;
CREATE TRIGGER trigger_decrement_trending_tags
  AFTER DELETE ON feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION decrement_trending_tags();