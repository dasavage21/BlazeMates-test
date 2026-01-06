/*
  # Add subscription tier support for Blaze+ and Blaze Pro

  1. Changes
    - Update subscription_tier constraint to support 'plus' and 'pro' tiers
    - Remove 'blaze_og' tier (legacy tier name)
    - Add proper tier names: 'free', 'plus', 'pro'
  
  2. Security
    - No changes to RLS policies
*/

DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'users' 
    AND constraint_name = 'users_subscription_tier_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_subscription_tier_check;
  END IF;
END $$;

-- Add new constraint with plus and pro tiers
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check 
  CHECK (subscription_tier IN ('free', 'plus', 'pro'));