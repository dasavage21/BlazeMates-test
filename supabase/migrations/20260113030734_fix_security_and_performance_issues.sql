/*
  # Fix Security and Performance Issues

  1. Security Fixes
    - Fix mutable search_path for `calculate_blaze_level` function
    - Make search_path immutable by adding SET clause

  2. Performance Improvements
    - Remove unused indexes that are not being queried
    - `idx_users_activity_points` - not used in any queries
    - `idx_users_blaze_level` - not used in any queries
    - These indexes slow down write operations without providing query benefits

  3. Notes
    - Indexes were created for potential future use but are not currently needed
    - Can be recreated later if specific query patterns require them
*/

-- Drop unused indexes to improve write performance
DROP INDEX IF EXISTS idx_users_activity_points;
DROP INDEX IF EXISTS idx_users_blaze_level;

-- Fix mutable search_path security issue
CREATE OR REPLACE FUNCTION calculate_blaze_level(points integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Level formula: floor(sqrt(points / 50)) + 1
  -- Level 1: 0-49 points
  -- Level 2: 50-199 points
  -- Level 3: 200-449 points
  -- Level 4: 450-799 points, etc.
  RETURN floor(sqrt(points::numeric / 50)) + 1;
END;
$$;