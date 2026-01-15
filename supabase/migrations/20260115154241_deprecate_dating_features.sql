/*
  # Deprecate Dating Features

  1. Changes
    - Adds comments to likes and passes tables noting they are deprecated
    - These tables are no longer used for dating/matching functionality
    - The app has been transformed into a cannabis community platform
    - Tables are retained for historical data but no new records should be created
  
  2. Notes
    - No data is deleted to preserve user history
    - Future versions may archive or remove these tables entirely
*/

-- Add comments to deprecated tables
COMMENT ON TABLE likes IS 'DEPRECATED: This table is no longer used. The app has been transformed from a dating platform to a cannabis community platform.';
COMMENT ON TABLE passes IS 'DEPRECATED: This table is no longer used. The app has been transformed from a dating platform to a cannabis community platform.';
