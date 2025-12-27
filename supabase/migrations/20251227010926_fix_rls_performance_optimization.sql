/*
  # Optimize RLS Policies for Performance

  1. Changes
    - Drop existing RLS policies on `users` table
    - Recreate policies with optimized `auth.uid()` calls wrapped in `(select auth.uid())`
    - This prevents re-evaluation of auth.uid() for each row, improving query performance at scale
  
  2. Security
    - All security rules remain identical
    - Only the performance optimization is applied
    - Users can still only access their own data
  
  3. Important Notes
    - Using `(select auth.uid())` instead of `auth.uid()` caches the user ID for the query
    - This is the recommended approach per Supabase documentation
    - No changes to actual access control behavior
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can delete own profile" ON users;

-- Recreate policies with optimized auth.uid() calls
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id AND age >= 21);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id AND age >= 21);

CREATE POLICY "Users can delete own profile"
  ON users
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = id);
