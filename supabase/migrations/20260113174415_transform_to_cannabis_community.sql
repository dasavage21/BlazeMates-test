/*
  # Transform BlazeMates to Cannabis Community Platform

  ## Overview
  This migration transforms the dating platform into a cannabis community platform
  for finding smoke buddies, sharing strains, and discussing cultivation.

  ## Changes Made

  ### 1. Remove Dating-Specific Columns
    - Drop `looking_for` (hookups, relationships, friends+)
    - Drop `sexual_orientation` (no longer relevant)
    - Keep `gender` (for user identification, not matching criteria)
    - Keep age verification fields (still required for cannabis platform)

  ### 2. Add Cannabis Community Columns
    - `preferred_strains` (text[]): User's favorite strains (Indica, Sativa, Hybrid)
    - `consumption_methods` (text[]): How they consume (Flower, Edibles, Concentrates, Vape, etc.)
    - `experience_level` (text): Beginner, Intermediate, Expert
    - `cultivation_interest` (boolean): Whether they grow or want to learn
    - `favorite_activities` (text[]): What they like to do while high (Music, Gaming, Hiking, Art, etc.)
    - `session_preferences` (text[]): Solo, Small Group, Large Group, Events
    - `interests` (text[]): Cannabis-related interests (Cultivation, Strains, Edibles, Medical, etc.)

  ### 3. Update Profile Fields
    - Repurpose existing bio field for cannabis-focused intro
    - Keep location data for finding local smoke buddies

  ## Data Migration
  - Existing users retain their basic profile info
  - Dating-specific data is removed (no rollback needed for privacy)
  - New fields default to empty arrays/null
*/

-- Remove dating-specific columns
DO $$
BEGIN
  -- Drop looking_for column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'looking_for'
  ) THEN
    ALTER TABLE users DROP COLUMN looking_for;
  END IF;

  -- Drop sexual_orientation column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'sexual_orientation'
  ) THEN
    ALTER TABLE users DROP COLUMN sexual_orientation;
  END IF;
END $$;

-- Add cannabis community columns
DO $$
BEGIN
  -- Preferred strains
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'preferred_strains'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_strains text[] DEFAULT '{}';
  END IF;

  -- Consumption methods
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'consumption_methods'
  ) THEN
    ALTER TABLE users ADD COLUMN consumption_methods text[] DEFAULT '{}';
  END IF;

  -- Experience level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'experience_level'
  ) THEN
    ALTER TABLE users ADD COLUMN experience_level text;
  END IF;

  -- Cultivation interest
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'cultivation_interest'
  ) THEN
    ALTER TABLE users ADD COLUMN cultivation_interest boolean DEFAULT false;
  END IF;

  -- Favorite activities
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'favorite_activities'
  ) THEN
    ALTER TABLE users ADD COLUMN favorite_activities text[] DEFAULT '{}';
  END IF;

  -- Session preferences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'session_preferences'
  ) THEN
    ALTER TABLE users ADD COLUMN session_preferences text[] DEFAULT '{}';
  END IF;

  -- Cannabis interests
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'interests'
  ) THEN
    ALTER TABLE users ADD COLUMN interests text[] DEFAULT '{}';
  END IF;
END $$;

-- Add check constraints for experience level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_experience_level_check'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_experience_level_check 
    CHECK (experience_level IN ('Beginner', 'Intermediate', 'Expert', 'Cannabis Curious'));
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_experience_level ON users(experience_level);
CREATE INDEX IF NOT EXISTS idx_users_cultivation_interest ON users(cultivation_interest);
CREATE INDEX IF NOT EXISTS idx_users_preferred_strains ON users USING GIN(preferred_strains);
CREATE INDEX IF NOT EXISTS idx_users_consumption_methods ON users USING GIN(consumption_methods);
CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING GIN(interests);