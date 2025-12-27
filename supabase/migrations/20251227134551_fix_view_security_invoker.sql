/*
  # Fix View Security Model

  ## Changes
  
  1. Views with SECURITY INVOKER
    - Recreate active_users_15m with security_invoker=true
    - Recreate active_users_15m_count with security_invoker=true
    - This ensures views run with caller's permissions, not owner's
    - Prevents privilege escalation and ensures RLS policies apply
  
  ## Security Impact
  - Views now respect Row Level Security policies of the calling user
  - Prevents unauthorized access through view ownership escalation
  - Aligns with security best practices for PostgreSQL 15+
  
  ## Note on idx_messages_thread_id
  - Index is kept despite "unused" warning
  - Required for foreign key CASCADE deletes from threads table
  - Will be used when queries join messages to threads
  - New indexes appear as "unused" until queries actually use them
*/

-- Recreate views with security_invoker option
DROP VIEW IF EXISTS public.active_users_15m CASCADE;
DROP VIEW IF EXISTS public.active_users_15m_count CASCADE;

-- Create with SECURITY INVOKER (runs with caller's permissions, not owner's)
CREATE VIEW public.active_users_15m 
WITH (security_invoker=true) AS
SELECT user_id, last_seen
FROM public.user_sessions
WHERE last_seen > (now() - interval '15 minutes');

CREATE VIEW public.active_users_15m_count 
WITH (security_invoker=true) AS
SELECT count(*) AS count
FROM public.user_sessions
WHERE last_seen > (now() - interval '15 minutes');