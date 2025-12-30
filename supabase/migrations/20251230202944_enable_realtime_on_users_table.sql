/*
  # Enable Realtime on Users Table

  1. Changes
    - Enable realtime replication for the users table
    - Set replica identity to FULL to include all column values in updates
    
  2. Purpose
    - Allows clients to receive real-time updates when user profiles change
    - Enables live updates in the swipe screen when users modify their name, bio, etc.
    
  3. Security
    - Realtime respects existing RLS policies
    - Only authenticated users can receive updates (per existing SELECT policy)
*/

-- Enable replica identity FULL so realtime includes all column values
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- Add users table to the realtime publication
DO $$
BEGIN
  -- Check if the table is already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;
