/*
  # Remove Duplicate Profile Views and Add Unique Constraint

  1. Purpose
    - Clean up duplicate profile view entries
    - Keep only the most recent view from each viewer to each viewed user
    - Add unique constraint to prevent future duplicates
    - Ensure accurate analytics by tracking unique views only
  
  2. Changes
    - Delete duplicate profile views (keep newest entry for each viewer-viewed pair)
    - Add unique constraint on (viewer_id, viewed_user_id)
    - Recalculate analytics after cleanup
*/

-- Delete duplicate profile views, keeping only the most recent one for each viewer-viewed pair
DELETE FROM profile_views
WHERE id NOT IN (
  SELECT DISTINCT ON (viewer_id, viewed_user_id) id
  FROM profile_views
  ORDER BY viewer_id, viewed_user_id, viewed_at DESC
);

-- Add unique constraint to prevent duplicate profile views
ALTER TABLE profile_views 
ADD CONSTRAINT profile_views_viewer_viewed_unique 
UNIQUE (viewer_id, viewed_user_id);

-- Recalculate all profile view analytics after cleanup
UPDATE subscription_analytics sa
SET 
  total_profile_views = (
    SELECT COUNT(*)
    FROM profile_views pv
    WHERE pv.viewed_user_id = sa.user_id
  ),
  updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = sa.user_id
  AND u.subscription_tier IN ('pro', 'blaze_og', 'blaze_pro')
  AND u.subscription_status = 'active'
);
