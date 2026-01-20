/*
  # Add Live Streaming Feature

  1. New Tables
    - `live_streams`
      - `id` (uuid, primary key)
      - `title` (text) - Stream title
      - `description` (text) - Stream description
      - `streamer_id` (uuid) - User who is streaming
      - `is_active` (boolean) - Whether stream is currently live
      - `viewer_count` (integer) - Current number of viewers
      - `started_at` (timestamptz) - When stream started
      - `ended_at` (timestamptz) - When stream ended
      - `stream_key` (text) - Unique key for streaming
      - `thumbnail_url` (text) - Optional thumbnail
      - `category` (text) - 'smoke_session' or 'grow_update'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `stream_viewers`
      - `id` (uuid, primary key)
      - `stream_id` (uuid) - Reference to live_streams
      - `user_id` (uuid) - Viewer
      - `joined_at` (timestamptz)
      - `left_at` (timestamptz)

    - `stream_chat_messages`
      - `id` (uuid, primary key)
      - `stream_id` (uuid)
      - `user_id` (uuid)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Streamers can manage their streams
    - Anyone can view active streams
*/

-- Create live_streams table
CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  streamer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  viewer_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  stream_key text UNIQUE DEFAULT gen_random_uuid()::text,
  thumbnail_url text,
  category text CHECK (category IN ('smoke_session', 'grow_update', 'general')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stream_viewers table
CREATE TABLE IF NOT EXISTS stream_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  UNIQUE(stream_id, user_id)
);

-- Create stream_chat_messages table
CREATE TABLE IF NOT EXISTS stream_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_live_streams_streamer ON live_streams(streamer_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_active ON live_streams(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_chat_stream ON stream_chat_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_chat_created ON stream_chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for live_streams
CREATE POLICY "Anyone can view active streams"
  ON live_streams FOR SELECT
  TO authenticated
  USING (is_active = true OR streamer_id = auth.uid());

CREATE POLICY "Users can create their own streams"
  ON live_streams FOR INSERT
  TO authenticated
  WITH CHECK (streamer_id = auth.uid());

CREATE POLICY "Streamers can update their own streams"
  ON live_streams FOR UPDATE
  TO authenticated
  USING (streamer_id = auth.uid())
  WITH CHECK (streamer_id = auth.uid());

CREATE POLICY "Streamers can delete their own streams"
  ON live_streams FOR DELETE
  TO authenticated
  USING (streamer_id = auth.uid());

-- RLS Policies for stream_viewers
CREATE POLICY "Anyone can view stream viewers"
  ON stream_viewers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join streams"
  ON stream_viewers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their viewer record"
  ON stream_viewers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for stream_chat_messages
CREATE POLICY "Anyone can view stream chat"
  ON stream_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can send chat messages"
  ON stream_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON stream_chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE stream_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE stream_chat_messages;
