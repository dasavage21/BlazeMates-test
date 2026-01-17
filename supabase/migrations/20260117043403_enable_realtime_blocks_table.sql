/*
  # Enable Realtime on Blocks Table

  1. Changes
    - Enable realtime replication for the blocks table
    - Set REPLICA IDENTITY to FULL for better realtime support

  2. Why
    - When a user blocks another user, their posts should disappear immediately
    - FULL replica identity helps with realtime subscriptions
*/

-- Enable realtime for blocks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
  END IF;
END $$;

-- Set replica identity to FULL for better realtime support
ALTER TABLE blocks REPLICA IDENTITY FULL;
