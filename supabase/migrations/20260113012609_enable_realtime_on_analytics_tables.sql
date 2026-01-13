/*
  # Enable Realtime on Analytics Tables

  1. Changes
    - Enable realtime replication for subscription_analytics table
    - Enable realtime replication for profile_views table
    - Set replica identity to FULL for both tables

  2. Purpose
    - Allow live updates on the analytics page when stats change
    - Enable real-time profile view tracking
    - Update analytics instantly as users interact with the app
*/

ALTER TABLE public.subscription_analytics REPLICA IDENTITY FULL;
ALTER TABLE public.profile_views REPLICA IDENTITY FULL;
