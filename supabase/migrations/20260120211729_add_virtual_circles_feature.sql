/*
  # Add Virtual Smoke Circles Feature

  1. New Tables
    - `virtual_circles`
      - `id` (uuid, primary key)
      - `name` (text) - Circle name
      - `description` (text)
      - `host_id` (uuid) - Circle host
      - `is_public` (boolean) - Public or private
      - `is_active` (boolean) - Currently active
      - `max_participants` (integer) - Max 8 people
      - `room_code` (text) - Unique join code
      - `created_at` (timestamptz)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz)

    - `circle_participants`
      - `id` (uuid, primary key)
      - `circle_id` (uuid)
      - `user_id` (uuid)
      - `joined_at` (timestamptz)
      - `left_at` (timestamptz)
      - `is_video_on` (boolean)
      - `is_audio_on` (boolean)

    - `circle_chat_messages`
      - `id` (uuid, primary key)
      - `circle_id` (uuid)
      - `user_id` (uuid)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Host can manage their circles
    - Participants can view and interact
*/

-- Create virtual_circles table
CREATE TABLE IF NOT EXISTS virtual_circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public boolean DEFAULT false,
  is_active boolean DEFAULT true,
  max_participants integer DEFAULT 8 CHECK (max_participants <= 8 AND max_participants > 0),
  room_code text UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- Create circle_participants table
CREATE TABLE IF NOT EXISTS circle_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES virtual_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  is_video_on boolean DEFAULT true,
  is_audio_on boolean DEFAULT true,
  UNIQUE(circle_id, user_id)
);

-- Create circle_chat_messages table
CREATE TABLE IF NOT EXISTS circle_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES virtual_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_virtual_circles_host ON virtual_circles(host_id);
CREATE INDEX IF NOT EXISTS idx_virtual_circles_active ON virtual_circles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_virtual_circles_public ON virtual_circles(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_circle_participants_circle ON circle_participants(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_chat_circle ON circle_chat_messages(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_chat_created ON circle_chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE virtual_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for virtual_circles
CREATE POLICY "Anyone can view public active circles"
  ON virtual_circles FOR SELECT
  TO authenticated
  USING (
    is_public = true 
    OR host_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM circle_participants 
      WHERE circle_participants.circle_id = virtual_circles.id 
      AND circle_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create circles"
  ON virtual_circles FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can update their circles"
  ON virtual_circles FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can delete their circles"
  ON virtual_circles FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

-- RLS Policies for circle_participants
CREATE POLICY "Anyone can view participants in circles they can see"
  ON circle_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM virtual_circles 
      WHERE virtual_circles.id = circle_participants.circle_id 
      AND (
        virtual_circles.is_public = true 
        OR virtual_circles.host_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM circle_participants cp2
          WHERE cp2.circle_id = virtual_circles.id 
          AND cp2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can join circles"
  ON circle_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their participant status"
  ON circle_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave circles"
  ON circle_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for circle_chat_messages
CREATE POLICY "Participants can view circle chat"
  ON circle_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_participants 
      WHERE circle_participants.circle_id = circle_chat_messages.circle_id 
      AND circle_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can send messages"
  ON circle_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM circle_participants 
      WHERE circle_participants.circle_id = circle_chat_messages.circle_id 
      AND circle_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON circle_chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE virtual_circles;
ALTER PUBLICATION supabase_realtime ADD TABLE circle_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE circle_chat_messages;
