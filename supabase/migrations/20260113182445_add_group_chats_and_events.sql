/*
  # Add Group Chats and Events for Cannabis Community

  ## New Tables

  ### `group_chats`
  - `id` (uuid, primary key) - unique identifier
  - `name` (text) - group name
  - `description` (text) - group description
  - `image_url` (text) - optional group image
  - `created_by` (uuid, foreign key to users) - creator
  - `created_at` (timestamptz) - creation time
  - `is_public` (boolean) - whether the group is publicly visible
  - `member_limit` (integer) - max members (default 50)

  ### `group_members`
  - `group_id` (uuid, foreign key to group_chats)
  - `user_id` (uuid, foreign key to users)
  - `role` (text) - 'admin' or 'member'
  - `joined_at` (timestamptz)
  - Primary key: (group_id, user_id)

  ### `group_messages`
  - `id` (uuid, primary key)
  - `group_id` (uuid, foreign key to group_chats)
  - `sender_id` (uuid, foreign key to users)
  - `content` (text)
  - `created_at` (timestamptz)

  ### `smoke_sessions` (events)
  - `id` (uuid, primary key)
  - `title` (text) - event title
  - `description` (text) - event description
  - `location` (text) - location name/address
  - `latitude` (numeric) - location coordinates
  - `longitude` (numeric) - location coordinates
  - `scheduled_at` (timestamptz) - when the session happens
  - `created_by` (uuid, foreign key to users)
  - `created_at` (timestamptz)
  - `is_public` (boolean) - whether event is publicly visible
  - `max_attendees` (integer) - optional attendee limit

  ### `session_attendees`
  - `session_id` (uuid, foreign key to smoke_sessions)
  - `user_id` (uuid, foreign key to users)
  - `rsvp_status` (text) - 'going', 'maybe', 'not_going'
  - `rsvp_at` (timestamptz)
  - Primary key: (session_id, user_id)

  ## Security
  - Enable RLS on all tables
  - Users can create groups and events
  - Users can view groups they're members of
  - Users can view public groups and events
  - Group admins can manage their groups
  - Event creators can manage their events
*/

-- Create group_chats table
CREATE TABLE IF NOT EXISTS public.group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  image_url text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  is_public boolean DEFAULT true,
  member_limit integer DEFAULT 50 CHECK (member_limit > 0 AND member_limit <= 500)
);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Create group_messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.group_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Create smoke_sessions (events) table
CREATE TABLE IF NOT EXISTS public.smoke_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  location text,
  latitude numeric,
  longitude numeric,
  scheduled_at timestamptz NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  is_public boolean DEFAULT true,
  max_attendees integer CHECK (max_attendees IS NULL OR (max_attendees > 0 AND max_attendees <= 1000))
);

ALTER TABLE public.smoke_sessions ENABLE ROW LEVEL SECURITY;

-- Create session_attendees table
CREATE TABLE IF NOT EXISTS public.session_attendees (
  session_id uuid REFERENCES public.smoke_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  rsvp_status text DEFAULT 'going' CHECK (rsvp_status IN ('going', 'maybe', 'not_going')),
  rsvp_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE public.session_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_chats
CREATE POLICY "Users can view public groups"
  ON public.group_chats
  FOR SELECT
  TO authenticated
  USING (is_public = true OR id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create groups"
  ON public.group_chats
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins can update their groups"
  ON public.group_chats
  FOR UPDATE
  TO authenticated
  USING (id IN (
    SELECT group_id FROM public.group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (id IN (
    SELECT group_id FROM public.group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Group admins can delete their groups"
  ON public.group_chats
  FOR DELETE
  TO authenticated
  USING (id IN (
    SELECT group_id FROM public.group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for group_members
CREATE POLICY "Users can view members of their groups"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
    OR group_id IN (SELECT id FROM public.group_chats WHERE is_public = true)
  );

CREATE POLICY "Users can join groups"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups"
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR group_id IN (
    SELECT group_id FROM public.group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for group_messages
CREATE POLICY "Group members can view messages"
  ON public.group_messages
  FOR SELECT
  TO authenticated
  USING (group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Group members can send messages"
  ON public.group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() 
    AND group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for smoke_sessions
CREATE POLICY "Users can view public events"
  ON public.smoke_sessions
  FOR SELECT
  TO authenticated
  USING (
    is_public = true 
    OR created_by = auth.uid()
    OR id IN (SELECT session_id FROM public.session_attendees WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create events"
  ON public.smoke_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Event creators can update their events"
  ON public.smoke_sessions
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Event creators can delete their events"
  ON public.smoke_sessions
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for session_attendees
CREATE POLICY "Users can view event attendees"
  ON public.session_attendees
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (SELECT id FROM public.smoke_sessions WHERE is_public = true)
    OR session_id IN (SELECT session_id FROM public.session_attendees WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can RSVP to events"
  ON public.session_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their RSVP"
  ON public.session_attendees
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their RSVP"
  ON public.session_attendees
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smoke_sessions_scheduled ON public.smoke_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_smoke_sessions_public ON public.smoke_sessions(is_public, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_session_attendees_user ON public.session_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_session_attendees_session ON public.session_attendees(session_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_attendees;
