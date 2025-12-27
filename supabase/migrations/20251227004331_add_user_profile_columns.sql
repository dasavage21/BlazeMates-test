/*
  # Add User Profile Columns
  
  1. Changes
    - Add `name` column to users table (text)
    - Add `bio` column to users table (text)
    - Add `strain` column to users table (text)
    - Add `style` column to users table (text)
    - Add `looking_for` column to users table (text)
    - Add `image_url` column to users table (text)
  
  2. Notes
    - All columns are nullable to allow gradual profile completion
    - Existing RLS policies remain unchanged and apply to these columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users ADD COLUMN name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'bio'
  ) THEN
    ALTER TABLE users ADD COLUMN bio text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'strain'
  ) THEN
    ALTER TABLE users ADD COLUMN strain text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'style'
  ) THEN
    ALTER TABLE users ADD COLUMN style text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'looking_for'
  ) THEN
    ALTER TABLE users ADD COLUMN looking_for text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE users ADD COLUMN image_url text;
  END IF;
END $$;
