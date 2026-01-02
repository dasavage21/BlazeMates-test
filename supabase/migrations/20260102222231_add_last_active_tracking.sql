/*
  # Add Last Active Tracking

  1. Changes
    - Add `last_active_at` column to users table
    - Set default to current timestamp
    - Create index for efficient active user queries

  2. Purpose
    - Track when users were last active in the app
    - Enable "who's active" feature for likes tab
    - Show active status only for users who liked you
*/

-- Add last_active_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN last_active_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create index for efficient active user queries
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON public.users(last_active_at);

-- Update existing users to have a last_active_at timestamp
UPDATE public.users SET last_active_at = now() WHERE last_active_at IS NULL;
