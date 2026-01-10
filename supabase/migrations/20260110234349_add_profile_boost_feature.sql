/*
  # Add Profile Boost Feature

  1. New Columns
    - `boost_active_until` (timestamptz) - When the current boost expires (24 hours from activation)
    - `last_boost_used_at` (timestamptz) - When the user last activated a boost (for cooldown tracking)
  
  2. Changes
    - Add columns to users table to track boost status
    - Create index on boost_active_until for efficient sorting in swipe queries
  
  3. Security
    - Existing RLS policies apply to these columns
  
  4. Notes
    - Boosts last 24 hours once activated
    - Blaze+ users can boost once per week (7 days cooldown)
    - Blaze Pro users can boost daily (1 day cooldown)
    - Boosted profiles appear first in swipe feed
*/

DO $$
BEGIN
  -- Add boost_active_until column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'boost_active_until'
  ) THEN
    ALTER TABLE users ADD COLUMN boost_active_until timestamptz DEFAULT NULL;
  END IF;

  -- Add last_boost_used_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_boost_used_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_boost_used_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Create index for efficient boost sorting in swipe queries
CREATE INDEX IF NOT EXISTS idx_users_boost_active 
ON users (boost_active_until DESC NULLS LAST);