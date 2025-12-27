# Deployment Instructions

## Environment Variables Setup

Your website is showing a blank page because the environment variables are not configured on your hosting platform. Follow these steps to fix it:

### For Netlify:

1. Go to your Netlify dashboard: https://app.netlify.com/
2. Select your site (blazemates)
3. Go to **Site settings** > **Environment variables**
4. Add the following two environment variables:

   **Variable 1:**
   - Key: `EXPO_PUBLIC_SUPABASE_URL`
   - Value: `https://zedfmjwqbikwynwqtylu.supabase.co`

   **Variable 2:**
   - Key: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZGZtandxYmlrd3lud3F0eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNTU2MjksImV4cCI6MjA2OTkzMTYyOX0.NlX3kyLve4-W_Y0zE0Or9Jl2k_1rZL_JdQdlPKvnCOg`

5. Click **Save**
6. **Trigger a new deployment** by going to **Deploys** > **Trigger deploy** > **Deploy site**

### Verification

After the deployment completes, your site should load properly. The app will:
- Show the age verification screen for new users
- Show the login screen for returning users
- Connect to your Supabase database correctly

## What Was Fixed

1. Added the `build:web` script to package.json
2. Added the `useFrameworkReady` hook for proper app initialization
3. Added error handling for missing environment variables
4. Updated Netlify configuration
5. Removed problematic image references that were causing build errors

## If You Still See Issues

Check your browser console (F12) for any error messages and verify that:
- The environment variables are set correctly in Netlify
- The deployment completed successfully
- Your browser cache is cleared (Ctrl+Shift+R or Cmd+Shift+R)
