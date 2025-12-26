/*
  # Fix Security Definer and Search Path Issues

  1. Security Fixes
    - Drop and recreate views with SECURITY INVOKER instead of SECURITY DEFINER
    - Add explicit search_path to functions to prevent injection attacks
    - Ensure all functions use immutable search_path settings

  2. Changes Made
    - Drop existing views: active_users_15m, active_users_15m_count
    - Drop existing functions: handle_new_user, set_updated_at, force_logout_user
    - Recreate with proper security settings

  3. Important Notes
    - SECURITY INVOKER ensures views run with caller's privileges
    - Fixed search_path prevents search_path injection vulnerabilities
    - These are critical security best practices for PostgreSQL
*/

-- Drop views if they exist (to recreate with SECURITY INVOKER)
DROP VIEW IF EXISTS public.active_users_15m CASCADE;
DROP VIEW IF EXISTS public.active_users_15m_count CASCADE;

-- Drop functions if they exist (to recreate with fixed search_path)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS admin_utils.force_logout_user(uuid) CASCADE;

-- Recreate active_users_15m view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.active_users_15m
WITH (security_invoker = true)
AS
SELECT 
  id,
  updated_at
FROM public.users
WHERE updated_at >= now() - interval '15 minutes';

-- Recreate active_users_15m_count view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.active_users_15m_count
WITH (security_invoker = true)
AS
SELECT COUNT(*) as active_count
FROM public.active_users_15m;

-- Recreate handle_new_user function with fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- This function can be customized to handle new user creation
  -- For now, it's a placeholder
  RETURN NEW;
END;
$$;

-- Recreate set_updated_at function with fixed search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic updated_at on users table
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create admin_utils schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS admin_utils;

-- Recreate force_logout_user function with fixed search_path
CREATE OR REPLACE FUNCTION admin_utils.force_logout_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Force logout by deleting user's sessions
  DELETE FROM auth.sessions
  WHERE user_id = force_logout_user.user_id;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA admin_utils TO authenticated;
GRANT EXECUTE ON FUNCTION admin_utils.force_logout_user TO service_role;
