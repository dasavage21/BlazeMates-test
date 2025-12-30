/*
  # Fix RLS policy for mutual matches

  1. Changes
    - Add policy to allow users to see likes where they are the liked_user_id
    - This enables the app to check if someone liked them back (mutual matches)
  
  2. Security
    - Users can only see likes where they are either the liker OR the person being liked
    - This is safe because users need to see who liked them to display mutual matches
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'likes' 
    AND policyname = 'Users can view likes where they are liked'
  ) THEN
    CREATE POLICY "Users can view likes where they are liked"
      ON likes
      FOR SELECT
      TO authenticated
      USING (auth.uid() = liked_user_id);
  END IF;
END $$;
