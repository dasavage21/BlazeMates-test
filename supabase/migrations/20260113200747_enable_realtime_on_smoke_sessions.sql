/*
  # Enable Realtime on smoke_sessions Table

  ## Changes
  - Add `smoke_sessions` to the realtime publication so events update in real-time
  - This allows users to see new events and event updates without refreshing
*/

-- Enable realtime for smoke_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.smoke_sessions;
