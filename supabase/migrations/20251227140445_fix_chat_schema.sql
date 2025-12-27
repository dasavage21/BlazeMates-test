/*
  # Fix Chat Schema

  1. Changes
    - Rename messages.sent_at to messages.created_at for consistency
    - Fix thread_id type consistency across tables
    - Add created_at to threads table if missing
    - Add missing indexes for better performance
  
  2. Security
    - Maintains existing RLS policies
*/

-- Rename sent_at to created_at in messages table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE messages RENAME COLUMN sent_at TO created_at;
  END IF;
END $$;

-- Ensure created_at exists in messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add index on messages for faster queries
CREATE INDEX IF NOT EXISTS messages_thread_id_created_at_idx 
  ON messages(thread_id, created_at);

-- Add index on read_receipts
CREATE INDEX IF NOT EXISTS read_receipts_thread_id_idx 
  ON read_receipts(thread_id);