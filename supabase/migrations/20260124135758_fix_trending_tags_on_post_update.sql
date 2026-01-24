/*
  # Fix Trending Tags on Post Update

  ## Overview
  Updates trending tag counts when post tags are changed to maintain accurate counts.

  ## Changes
  1. Creates a trigger to handle tag changes when posts are updated
  2. Decrements old tags and increments new tags
  3. Ensures tag counts stay accurate

  ## Security
  - Function uses SECURITY DEFINER with proper search_path
*/

-- Function to update trending tags when post tags are modified
CREATE OR REPLACE FUNCTION update_trending_tags_on_edit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  tag_item text;
  current_week date;
  old_tags text[];
  new_tags text[];
BEGIN
  current_week := date_trunc('week', now())::date;
  old_tags := COALESCE(OLD.tags, '{}');
  new_tags := COALESCE(NEW.tags, '{}');
  
  -- Only process if tags actually changed
  IF old_tags != new_tags THEN
    -- Decrement old tags that are no longer present
    FOREACH tag_item IN ARRAY old_tags
    LOOP
      IF NOT (tag_item = ANY(new_tags)) THEN
        UPDATE trending_tags
        SET usage_count = GREATEST(usage_count - 1, 0)
        WHERE tag = tag_item AND week_start = current_week;
        
        DELETE FROM trending_tags
        WHERE tag = tag_item AND usage_count = 0;
      END IF;
    END LOOP;
    
    -- Increment new tags that weren't present before
    FOREACH tag_item IN ARRAY new_tags
    LOOP
      IF NOT (tag_item = ANY(old_tags)) THEN
        INSERT INTO trending_tags (tag, usage_count, last_used_at, week_start)
        VALUES (tag_item, 1, now(), current_week)
        ON CONFLICT (tag) DO UPDATE SET
          usage_count = CASE 
            WHEN trending_tags.week_start = current_week 
            THEN trending_tags.usage_count + 1
            ELSE 1
          END,
          last_used_at = now(),
          week_start = current_week;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for post updates
DROP TRIGGER IF EXISTS trigger_update_trending_tags_on_edit ON feed_posts;
CREATE TRIGGER trigger_update_trending_tags_on_edit
  AFTER UPDATE ON feed_posts
  FOR EACH ROW
  WHEN (OLD.tags IS DISTINCT FROM NEW.tags)
  EXECUTE FUNCTION update_trending_tags_on_edit();