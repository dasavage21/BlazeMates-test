/*
  # Add Automatic Blaze Level Update Trigger

  1. New Trigger Function
    - `update_user_blaze_level()` - Automatically recalculates blaze_level when activity_points change
    
  2. Trigger
    - Fires BEFORE UPDATE on users table
    - Only when activity_points column changes
    - Automatically sets blaze_level to calculated value
    
  3. Fixes
    - Ensures blaze_level always matches activity_points
    - No manual updates needed
    - Real-time level progression
*/

-- Function to automatically update blaze_level when activity_points change
CREATE OR REPLACE FUNCTION update_user_blaze_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically calculate and set blaze_level based on activity_points
  NEW.blaze_level := calculate_blaze_level(COALESCE(NEW.activity_points, 0));
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_blaze_level ON users;

-- Create trigger to auto-update blaze_level
CREATE TRIGGER trigger_update_blaze_level
  BEFORE INSERT OR UPDATE OF activity_points
  ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_blaze_level();

-- Backfill existing users to correct their blaze_level
UPDATE users
SET blaze_level = calculate_blaze_level(COALESCE(activity_points, 0))
WHERE blaze_level != calculate_blaze_level(COALESCE(activity_points, 0));
