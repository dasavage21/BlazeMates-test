/*
  # Fix Security Definer and Search Path Issues

  ## Changes
  
  1. Views Updated
    - Recreate `active_users_15m` without SECURITY DEFINER
    - Recreate `active_users_15m_count` without SECURITY DEFINER
  
  2. Functions Updated
    - `admin_utils.force_logout_user` - Add fixed search_path
    - `public.handle_new_user` - Add fixed search_path
    - `public.set_updated_at` - Add fixed search_path (already not SECURITY DEFINER, but adding for consistency)
  
  ## Security Notes
  - SECURITY DEFINER views can lead to privilege escalation
  - SECURITY DEFINER functions need fixed search_path to prevent search path injection attacks
  - Setting `search_path = ''` forces full schema qualification, preventing malicious function substitution
*/

-- Drop and recreate views without SECURITY DEFINER
DROP VIEW IF EXISTS public.active_users_15m CASCADE;
DROP VIEW IF EXISTS public.active_users_15m_count CASCADE;

CREATE VIEW public.active_users_15m AS
SELECT user_id, last_seen
FROM user_sessions
WHERE last_seen > (now() - interval '15 minutes');

CREATE VIEW public.active_users_15m_count AS
SELECT count(*) AS count
FROM user_sessions
WHERE last_seen > (now() - interval '15 minutes');

-- Recreate admin_utils.force_logout_user with fixed search_path
CREATE OR REPLACE FUNCTION admin_utils.force_logout_user(p_user_id uuid, p_triggered_by text DEFAULT 'system'::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_revoked_count integer;
BEGIN
  UPDATE auth.refresh_tokens
  SET revoked = true
  WHERE user_id = p_user_id AND revoked = false;

  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

  INSERT INTO admin_utils.logout_audit(user_id, revoked_count, triggered_by)
  VALUES (p_user_id, v_revoked_count, coalesce(p_triggered_by, 'system'));

  RETURN v_revoked_count;
END;
$$;

-- Recreate public.handle_new_user with fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, created_at, updated_at)
  VALUES (new.id, now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Update public.set_updated_at with fixed search_path for consistency
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;