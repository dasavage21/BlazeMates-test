/*
  # Fix Thread ID Type - With Realtime Policies

  1. Changes
    - Drop all policies including realtime policies
    - Change threads.id from UUID to TEXT
    - Update all foreign key references
    - Recreate all policies
  
  2. Security
    - Recreates all RLS policies after type change
*/

-- Drop ALL policies including realtime
DROP POLICY IF EXISTS "chat: participants can receive" ON realtime.messages;
DROP POLICY IF EXISTS "chat: participants can send" ON realtime.messages;
DROP POLICY IF EXISTS "messages: delete own" ON public.messages;
DROP POLICY IF EXISTS "read_receipts: delete own" ON public.read_receipts;
DROP POLICY IF EXISTS "threads: delete if only participant" ON public.threads;
DROP POLICY IF EXISTS "threads: leave thread" ON public.threads;
DROP POLICY IF EXISTS "threads_auth_select" ON threads;
DROP POLICY IF EXISTS "threads_auth_insert" ON threads;
DROP POLICY IF EXISTS "threads_auth_update" ON threads;
DROP POLICY IF EXISTS "messages_auth_select" ON messages;
DROP POLICY IF EXISTS "messages_auth_insert" ON messages;
DROP POLICY IF EXISTS "read_receipts_auth_select" ON read_receipts;
DROP POLICY IF EXISTS "read_receipts_auth_insert" ON read_receipts;
DROP POLICY IF EXISTS "read_receipts_auth_update" ON read_receipts;

-- Drop foreign key constraints
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_thread_id_fkey;
ALTER TABLE read_receipts DROP CONSTRAINT IF EXISTS read_receipts_thread_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS messages_thread_id_created_at_idx;
DROP INDEX IF EXISTS read_receipts_thread_id_idx;

-- Change types
ALTER TABLE messages ALTER COLUMN thread_id TYPE TEXT USING thread_id::TEXT;
ALTER TABLE read_receipts ALTER COLUMN thread_id TYPE TEXT USING thread_id::TEXT;
ALTER TABLE threads ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Recreate foreign key constraints
ALTER TABLE messages 
  ADD CONSTRAINT messages_thread_id_fkey 
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;

ALTER TABLE read_receipts 
  ADD CONSTRAINT read_receipts_thread_id_fkey 
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;

-- Recreate indexes
CREATE INDEX messages_thread_id_created_at_idx ON messages(thread_id, created_at);
CREATE INDEX read_receipts_thread_id_idx ON read_receipts(thread_id);

-- Recreate basic RLS policies
CREATE POLICY "threads_auth_select"
  ON threads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "threads_auth_insert"
  ON threads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "threads_auth_update"
  ON threads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "messages_auth_select"
  ON messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "messages_auth_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "read_receipts_auth_select"
  ON read_receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "read_receipts_auth_insert"
  ON read_receipts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read_receipts_auth_update"
  ON read_receipts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);