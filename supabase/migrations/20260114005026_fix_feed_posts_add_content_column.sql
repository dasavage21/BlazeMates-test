/*
  # Fix feed_posts table structure

  ## Changes
  
  ### 1. Update feed_posts table
  - Add `content` column for post text
  - Make image_url nullable (posts can have text only or text + image)
  - Keep caption for backward compatibility temporarily
  
  ### 2. Data Migration
  - Copy existing caption data to content column if any exists
*/

-- Add content column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feed_posts' AND column_name = 'content'
  ) THEN
    ALTER TABLE feed_posts ADD COLUMN content text DEFAULT '';
  END IF;
END $$;

-- Make image_url nullable if it isn't already
DO $$
BEGIN
  ALTER TABLE feed_posts ALTER COLUMN image_url DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Copy caption data to content if content is empty
UPDATE feed_posts 
SET content = COALESCE(caption, '') 
WHERE content = '' OR content IS NULL;

-- Add constraint to ensure either content or image_url exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'feed_posts_content_or_image_required'
  ) THEN
    ALTER TABLE feed_posts 
    ADD CONSTRAINT feed_posts_content_or_image_required 
    CHECK (
      (content IS NOT NULL AND length(trim(content)) > 0) OR 
      (image_url IS NOT NULL AND length(trim(image_url)) > 0)
    );
  END IF;
END $$;
