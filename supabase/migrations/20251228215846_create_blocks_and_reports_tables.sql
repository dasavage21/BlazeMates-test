/*
  # Create Blocks and Reports Tables

  1. New Tables
    - blocks
      - id (uuid, primary key) - Unique identifier for the block
      - blocker_id (uuid) - User who is blocking
      - blocked_id (uuid) - User who is being blocked
      - created_at (timestamptz) - When the block was created
      - Unique constraint on (blocker_id, blocked_id) to prevent duplicates
    
    - reports
      - id (uuid, primary key) - Unique identifier for the report
      - reporter_id (uuid) - User who is reporting
      - reported_id (uuid) - User who is being reported
      - reason (text) - Reason for the report
      - context (text, nullable) - Additional context or details
      - status (text) - Status of the report (pending, reviewed, resolved)
      - created_at (timestamptz) - When the report was created

  2. Security
    - Enable RLS on both tables
    - Users can only create their own blocks and reports
    - Users can view their own blocks
    - Only service role can view reports (admin only)
    
  3. Indexes
    - Index on blocker_id for fast lookup of who a user has blocked
    - Index on blocked_id to check if a user is blocked by someone
    - Index on reporter_id for user report history
*/

-- Create blocks table
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
  ON public.blocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create their own blocks"
  ON public.blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks"
  ON public.blocks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON public.blocks(blocked_id);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  context text,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now(),
  CHECK (reporter_id != reported_id),
  CHECK (status IN ('pending', 'reviewed', 'resolved'))
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON public.reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);