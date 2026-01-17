/*
  # Add Missing Activity Point Triggers
  
  1. New Triggers
    - Award 5 points when user follows someone (on `follows` INSERT)
    - Award 15 points when user creates a post (on `feed_posts` INSERT)
    - Award 5 points to post author when someone likes their post (on `post_likes` INSERT)
  
  2. Point System Updates
    - Follow someone: 5 points
    - Create a post: 15 points
    - Someone likes your post: 5 points
*/

-- Trigger function to award points when following someone
CREATE OR REPLACE FUNCTION award_points_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award 5 points to the user doing the following
  PERFORM award_activity_points(NEW.follower_id, 5, 'follow_user');
  RETURN NEW;
END;
$$;

-- Trigger function to award points when creating a post
CREATE OR REPLACE FUNCTION award_points_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award 15 points for creating a post
  PERFORM award_activity_points(NEW.user_id, 15, 'create_post');
  RETURN NEW;
END;
$$;

-- Trigger function to award points when post gets liked
CREATE OR REPLACE FUNCTION award_points_on_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
BEGIN
  -- Get the post author's ID
  SELECT user_id INTO v_post_author_id
  FROM feed_posts
  WHERE id = NEW.post_id;
  
  -- Award 5 points to the post author for receiving a like
  IF v_post_author_id IS NOT NULL THEN
    PERFORM award_activity_points(v_post_author_id, 5, 'post_liked');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_award_points_on_follow ON follows;
CREATE TRIGGER trigger_award_points_on_follow
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_follow();

DROP TRIGGER IF EXISTS trigger_award_points_on_post ON feed_posts;
CREATE TRIGGER trigger_award_points_on_post
  AFTER INSERT ON feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_post();

DROP TRIGGER IF EXISTS trigger_award_points_on_post_like ON post_likes;
CREATE TRIGGER trigger_award_points_on_post_like
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_post_like();
