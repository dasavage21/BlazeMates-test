/*
  # Fix Messages ID Default

  1. Changes
    - Add default gen_random_uuid() to messages.id column
  
  2. Security
    - No changes to RLS policies
*/

-- Add default UUID generation to messages.id
ALTER TABLE messages 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();