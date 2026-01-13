/*
  # Remove Profile Boost Feature

  ## Changes
  
  This migration removes the profile boost feature that was designed for dating apps.
  Since BlazeMates is now a cannabis community platform (not a dating app), 
  profile boosting doesn't make sense.

  ### Columns Removed
  - `boost_active_until` (timestamptz) - when boost expires
  - `last_boost_used_at` (timestamptz) - when user last activated boost

  ## Note
  
  We're keeping these columns in the database for now but will drop them in a future migration
  after ensuring no code references them. This is a safe, non-destructive approach.
*/

-- Note: Not dropping columns yet to avoid breaking any code that might reference them
-- We'll drop them in a future migration after confirming all references are removed
-- For now, they'll just remain unused

-- Add a comment to document that these columns are deprecated
COMMENT ON COLUMN public.users.boost_active_until IS 'DEPRECATED - Profile boost feature removed';
COMMENT ON COLUMN public.users.last_boost_used_at IS 'DEPRECATED - Profile boost feature removed';
