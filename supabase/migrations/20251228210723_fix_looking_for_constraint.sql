/*
  # Fix looking_for Constraint to Allow NULL

  1. Changes
    - Drop existing looking_for constraint
    - Add new constraint that allows NULL or valid values

  2. Important Notes
    - NULL is allowed since looking_for is set after signup
    - Only validates non-NULL values must be 'smoke', 'hookup', or 'both'
*/

-- Drop existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_looking_for_check;

-- Add new constraint that allows NULL
ALTER TABLE public.users 
  ADD CONSTRAINT users_looking_for_check 
  CHECK (looking_for IS NULL OR looking_for = ANY (ARRAY['smoke'::text, 'hookup'::text, 'both'::text]));
