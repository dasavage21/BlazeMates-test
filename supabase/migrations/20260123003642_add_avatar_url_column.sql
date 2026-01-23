/*
  # Add avatar_url column to users table
  
  1. Changes
    - Add `avatar_url` column to users table as an alias/complement to existing image_url
    - Set default to NULL to allow existing records
  
  2. Notes
    - This column will be used for profile avatars in the live streaming and other features
    - Existing users will need to set this separately from image_url if needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url text;
    
    -- Copy existing image_url values to avatar_url for backwards compatibility
    UPDATE users SET avatar_url = image_url WHERE image_url IS NOT NULL;
  END IF;
END $$;