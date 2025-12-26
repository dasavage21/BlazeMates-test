/*
  # Create Users Table with Age Verification

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `age` (integer, required, minimum 21)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on users table
    - Add policy for users to read their own data
    - Add policy for users to update their own data
    - Add policy for users to insert their own data
    - Add policy for authenticated users to insert only if age >= 21
  
  3. Important Notes
    - Age is enforced at the database level with CHECK constraint
    - Only authenticated users can create/read/update their own records
    - Age validation prevents underage users from storing invalid ages
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age integer NOT NULL CHECK (age >= 21),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND age >= 21);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND age >= 21);

CREATE POLICY "Users can delete own profile"
  ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
