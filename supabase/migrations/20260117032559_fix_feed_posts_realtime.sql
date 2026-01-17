/*
  # Fix Feed Posts Realtime
  
  1. Changes
    - Set REPLICA IDENTITY to FULL for better realtime support
    - This ensures all column values are included in realtime events
  
  2. Why
    - Posts are not showing up in realtime
    - FULL replica identity helps with realtime subscriptions
*/

-- Set replica identity to FULL for better realtime support
ALTER TABLE feed_posts REPLICA IDENTITY FULL;
ALTER TABLE post_likes REPLICA IDENTITY FULL;
ALTER TABLE post_comments REPLICA IDENTITY FULL;
