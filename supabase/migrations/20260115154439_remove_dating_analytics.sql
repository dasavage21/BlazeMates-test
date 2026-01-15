/*
  # Remove Dating Analytics

  1. Changes
    - Removes swipe-related analytics columns from subscription_analytics table
    - These metrics were part of the dating functionality which has been removed
    - Columns being removed:
      - total_swipes: No longer relevant
      - swipe_through_rate: No longer relevant
      - match_likelihood_score: No longer relevant
  
  2. Notes
    - Community engagement metrics (profile views, likes given/received) are retained
    - These can be repurposed for community engagement tracking
*/

-- Remove dating-specific analytics columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_analytics' AND column_name = 'total_swipes'
  ) THEN
    ALTER TABLE subscription_analytics DROP COLUMN total_swipes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_analytics' AND column_name = 'swipe_through_rate'
  ) THEN
    ALTER TABLE subscription_analytics DROP COLUMN swipe_through_rate;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_analytics' AND column_name = 'match_likelihood_score'
  ) THEN
    ALTER TABLE subscription_analytics DROP COLUMN match_likelihood_score;
  END IF;
END $$;
