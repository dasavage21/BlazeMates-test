/*
  # Remove Conflicting Auth Trigger

  1. Changes
    - Drop the `on_auth_user_created` trigger on auth.users
    - Drop the `handle_new_user()` function
    
  2. Reasoning
    - The trigger was automatically creating user rows without age
    - This conflicts with the age >= 21 constraint
    - The app already handles user creation via mergeUserRow()
    - This trigger was causing signup failures
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();
