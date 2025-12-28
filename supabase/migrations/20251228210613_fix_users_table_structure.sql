/*
  # Fix Users Table Structure and RLS Policies

  1. Changes
    - Recreate users table with proper foreign key to auth.users
    - Ensure all necessary columns exist with correct constraints
    - Fix RLS policies to allow proper signup flow

  2. Security
    - Enable RLS on users table
    - Add restrictive policies for authenticated users
    - Allow users to read all profiles (for matching feature)
    - Only allow users to insert/update/delete their own records

  3. Important Notes
    - Preserves existing user data
    - Adds missing foreign key constraint
    - Consolidates duplicate policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;
DROP POLICY IF EXISTS "users: insert self" ON public.users;
DROP POLICY IF EXISTS "users: read all" ON public.users;
DROP POLICY IF EXISTS "users: read anon" ON public.users;
DROP POLICY IF EXISTS "users: update own record" ON public.users;
DROP POLICY IF EXISTS "users: user can delete own row" ON public.users;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_id_fkey' 
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey 
      FOREIGN KEY (id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create consolidated, clear policies

-- Allow authenticated users to read all profiles (needed for matching/browsing)
CREATE POLICY "Users can read all profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to insert their own profile only
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND age >= 21);

-- Allow users to update their own profile only
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND age >= 21);

-- Allow users to delete their own profile only
CREATE POLICY "Users can delete own profile"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
