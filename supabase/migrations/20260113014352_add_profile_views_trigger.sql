/*
  # Add Trigger for Profile Views Analytics

  1. Purpose
    - Automatically update subscription_analytics when a profile view is inserted
    - Ensure real-time updates to total_profile_views count
  
  2. Changes
    - Create a trigger function that updates analytics after profile view insert
    - Add trigger on profile_views table for INSERT operations
*/

CREATE OR REPLACE FUNCTION trigger_update_profile_view_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE subscription_analytics sa
  SET 
    total_profile_views = (
      SELECT COUNT(*)
      FROM profile_views pv
      WHERE pv.viewed_user_id = NEW.viewed_user_id
    ),
    updated_at = now()
  WHERE sa.user_id = NEW.viewed_user_id
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.viewed_user_id
    AND u.subscription_tier IN ('pro', 'blaze_og', 'blaze_pro')
    AND u.subscription_status = 'active'
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_view_inserted ON profile_views;

CREATE TRIGGER on_profile_view_inserted
  AFTER INSERT ON profile_views
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_profile_view_analytics();
