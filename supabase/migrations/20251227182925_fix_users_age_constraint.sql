/*
  # Fix Users Age Constraint

  1. Changes
    - Make age column NOT NULL with CHECK constraint (age >= 21)
    - Update any existing null ages to 21 as default
  
  2. Security
    - Enforces minimum age at database level
    - Prevents creation of accounts without valid age
  
  3. Important Notes
    - Existing users with null age will be set to 21
    - All future inserts must include valid age >= 21
*/

-- Update any null ages to 21 first
UPDATE users SET age = 21 WHERE age IS NULL;

-- Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN age SET NOT NULL;

-- Add CHECK constraint for minimum age
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_age_check' 
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_age_check CHECK (age >= 21);
  END IF;
END $$;