/*
  # Create Site Status Table

  1. New Tables
    - `site_status`
      - `id` (integer, primary key) - always 1, singleton pattern
      - `enabled` (boolean) - whether the status banner is shown
      - `message` (text) - the message to display
      - `type` (text) - banner type: warning, info, or error
      - `updated_at` (timestamp) - last update time
  
  2. Security
    - Enable RLS on `site_status` table
    - Add policy for public read access (anyone can view status)
    - No update policy for now (can be updated directly via database)
  
  3. Initial Data
    - Insert default row with enabled=false

  Notes:
    - To enable the banner, run: UPDATE site_status SET enabled = true WHERE id = 1;
    - To change message: UPDATE site_status SET message = 'Your message' WHERE id = 1;
    - To change type: UPDATE site_status SET type = 'warning' WHERE id = 1; (options: warning, info, error)
*/

CREATE TABLE IF NOT EXISTS site_status (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean DEFAULT false,
  message text DEFAULT 'We are currently experiencing technical difficulties. Please check back soon.',
  type text DEFAULT 'warning' CHECK (type IN ('warning', 'info', 'error')),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT site_status_singleton CHECK (id = 1)
);

ALTER TABLE site_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site status"
  ON site_status
  FOR SELECT
  USING (true);

INSERT INTO site_status (id, enabled, message, type)
VALUES (1, false, 'We are currently experiencing technical difficulties. Please check back soon.', 'warning')
ON CONFLICT (id) DO NOTHING;