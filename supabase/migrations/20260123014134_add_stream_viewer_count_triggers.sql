/*
  # Add Stream Viewer Count Auto-Update Triggers

  1. Purpose
    - Automatically update live_streams.viewer_count when viewers join or leave
    - Count only active viewers (where left_at IS NULL)
    - Ensure real-time accurate viewer counts

  2. Changes
    - Create function to recalculate viewer count for a stream
    - Add trigger on stream_viewers INSERT to increment count
    - Add trigger on stream_viewers UPDATE to recalculate count when viewer leaves
    - Add trigger on stream_viewers DELETE to decrement count

  3. How it works
    - When user joins: viewer_count increases
    - When user leaves (left_at is set): viewer_count decreases
    - Count is always accurate based on active viewers only
*/

-- Function to update viewer count for a specific stream
CREATE OR REPLACE FUNCTION update_stream_viewer_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the viewer count based on active viewers (left_at IS NULL)
  UPDATE live_streams
  SET
    viewer_count = (
      SELECT COUNT(*)
      FROM stream_viewers
      WHERE stream_id = COALESCE(NEW.stream_id, OLD.stream_id)
      AND left_at IS NULL
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.stream_id, OLD.stream_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_stream_viewer_joined ON stream_viewers;
DROP TRIGGER IF EXISTS on_stream_viewer_updated ON stream_viewers;
DROP TRIGGER IF EXISTS on_stream_viewer_deleted ON stream_viewers;

-- Trigger for when a viewer joins (INSERT)
CREATE TRIGGER on_stream_viewer_joined
  AFTER INSERT ON stream_viewers
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_viewer_count();

-- Trigger for when a viewer leaves or record is updated (UPDATE)
CREATE TRIGGER on_stream_viewer_updated
  AFTER UPDATE ON stream_viewers
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_viewer_count();

-- Trigger for when a viewer record is deleted (DELETE)
CREATE TRIGGER on_stream_viewer_deleted
  AFTER DELETE ON stream_viewers
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_viewer_count();

-- Recalculate viewer counts for all active streams
UPDATE live_streams
SET viewer_count = (
  SELECT COUNT(*)
  FROM stream_viewers
  WHERE stream_viewers.stream_id = live_streams.id
  AND stream_viewers.left_at IS NULL
)
WHERE is_active = true;