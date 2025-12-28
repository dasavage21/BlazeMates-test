/*
  # Add User Suspension and Automated Report Handling

  1. Changes to Users Table
    - `is_suspended` (boolean) - Whether the user is currently suspended
    - `suspended_at` (timestamptz) - When the user was suspended
    - `suspension_reason` (text) - Reason for suspension
    - `report_count` (integer) - Cached count of reports against this user

  2. Automated Actions
    - Function to count reports and auto-suspend users
    - Trigger that runs after a new report is created
    - Users are auto-suspended after reaching 3 reports

  3. Security
    - Only authenticated users can view non-suspended users
    - Suspended users cannot access most features
    - Add policy to hide suspended users from discovery
*/

-- Add suspension fields to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_suspended boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN suspended_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'suspension_reason'
  ) THEN
    ALTER TABLE public.users ADD COLUMN suspension_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'report_count'
  ) THEN
    ALTER TABLE public.users ADD COLUMN report_count integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Create function to handle report automation
CREATE OR REPLACE FUNCTION public.handle_new_report()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  current_report_count integer;
  suspension_threshold integer := 3;
BEGIN
  -- Update the report count for the reported user
  UPDATE public.users
  SET report_count = report_count + 1
  WHERE id = NEW.reported_id
  RETURNING report_count INTO current_report_count;

  -- Auto-suspend if threshold reached
  IF current_report_count >= suspension_threshold THEN
    UPDATE public.users
    SET 
      is_suspended = true,
      suspended_at = now(),
      suspension_reason = 'Automatic suspension: Multiple user reports (' || current_report_count || ' reports)'
    WHERE id = NEW.reported_id
    AND is_suspended = false;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new reports
DROP TRIGGER IF EXISTS on_report_created ON public.reports;
CREATE TRIGGER on_report_created
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_report();

-- Add index for suspended users
CREATE INDEX IF NOT EXISTS idx_users_is_suspended ON public.users(is_suspended);

-- Update existing users RLS policies to exclude suspended users from discovery
DROP POLICY IF EXISTS "Users can view other users profiles" ON public.users;
CREATE POLICY "Users can view other users profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR (is_suspended = false)
  );