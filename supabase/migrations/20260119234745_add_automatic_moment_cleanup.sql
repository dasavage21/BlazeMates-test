/*
  # Automatic Blaze Moments Cleanup
  
  ## Overview
  Sets up automatic deletion of expired 24-hour Blaze Moments using pg_cron.
  
  ## Changes Made
  
  1. Enable pg_cron extension for scheduled jobs
  2. Schedule hourly cleanup job to delete expired moments
  3. Ensures database doesn't accumulate expired moment data
  
  ## How It Works
  - Every hour, the `delete_expired_moments()` function runs
  - Permanently removes posts where `is_moment = true` AND `expires_at < now()`
  - Keeps database clean and reduces storage
  
  ## Notes
  - Moments are already hidden via RLS after expiration
  - This ensures they're also physically deleted from the database
*/

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly cleanup of expired Blaze Moments
-- Runs every hour at minute 0 (00:00, 01:00, 02:00, etc.)
SELECT cron.schedule(
  'delete-expired-moments',           -- job name
  '0 * * * *',                        -- cron expression: every hour
  $$SELECT delete_expired_moments()$$ -- SQL to execute
);
