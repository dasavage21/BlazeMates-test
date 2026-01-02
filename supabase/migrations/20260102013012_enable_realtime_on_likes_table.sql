/*
  # Enable Realtime on Likes Table

  1. Changes
    - Enable realtime replication for the likes table
    - Set replica identity to FULL to include all column values in updates

  2. Purpose
    - Allow live updates when users like each other
    - Enable instant match notifications
    - Update matches screen in real-time when new likes are created
*/

-- Enable replica identity FULL so realtime includes all column values
ALTER TABLE public.likes REPLICA IDENTITY FULL;
