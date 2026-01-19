/*
  # Update Reaction Types for Posts

  1. Changes
    - Migrate existing 'like' reactions to 'fire' reactions
    - Replace existing reaction types constraint with new set: smoke, fire, funny, chill
    - Update the constraint to allow only these four reaction types
  
  2. Security
    - No changes to RLS policies
*/

-- First, migrate any existing reactions to the new types
-- Convert 'like' and 'love' to 'fire'
-- Convert 'celebrate' and 'support' to 'chill'
UPDATE post_likes SET reaction_type = 'fire' 
WHERE reaction_type IN ('like', 'love', 'celebrate');

UPDATE post_likes SET reaction_type = 'chill' 
WHERE reaction_type = 'support';

-- Drop the old constraint
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_reaction_type_check;

-- Add new constraint with the new reaction types
ALTER TABLE post_likes ADD CONSTRAINT post_likes_reaction_type_check 
  CHECK (reaction_type = ANY (ARRAY['smoke'::text, 'fire'::text, 'funny'::text, 'chill'::text]));