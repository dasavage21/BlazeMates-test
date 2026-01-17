/*
  # Fix Message Trigger Column Name

  1. Issue
    - The trigger function `award_points_on_message()` references `NEW.user_id`
    - But the messages table has `sender_id` not `user_id`
    - This causes the trigger to fail silently when messages are sent

  2. Fix
    - Update the trigger function to use `NEW.sender_id` instead
    - This will allow users to earn 5 points for each message sent
*/

-- Fix the trigger function to use the correct column name
CREATE OR REPLACE FUNCTION award_points_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award 5 points for sending a message
  -- Use sender_id instead of user_id (messages table uses sender_id)
  PERFORM award_activity_points(NEW.sender_id, 5, 'message_sent');
  RETURN NEW;
END;
$$;