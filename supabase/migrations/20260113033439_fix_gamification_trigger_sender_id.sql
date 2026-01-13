/*
  # Fix Gamification Trigger - Use sender_id Instead of user_id

  1. Changes
    - Update `award_points_on_message()` trigger function to use `sender_id` instead of `user_id`
    - The messages table has `sender_id`, not `user_id`
  
  2. Security
    - No security changes, only fixing column reference
*/

-- Fix trigger function to use sender_id instead of user_id
CREATE OR REPLACE FUNCTION award_points_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award 5 points for sending a message (use sender_id, not user_id)
  IF NEW.sender_id IS NOT NULL THEN
    PERFORM award_activity_points(NEW.sender_id, 5, 'message_sent');
  END IF;
  RETURN NEW;
END;
$$;
