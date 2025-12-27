# Security Implementation

## Database Security

### Security Definer Views

All database views have been configured without the SECURITY DEFINER property to prevent privilege escalation vulnerabilities. Views run with the privileges of the executing user, not the view owner.

**Fixed Views:**
- `public.active_users_15m`
- `public.active_users_15m_count`

### Function Search Path Protection

All SECURITY DEFINER functions now have fixed search paths (`search_path = ''`) to prevent search path injection attacks. This requires full schema qualification within functions and prevents malicious code execution.

**Protected Functions:**
- `admin_utils.force_logout_user` - Admin utility with SECURITY DEFINER
- `public.handle_new_user` - User creation trigger with SECURITY DEFINER
- `public.set_updated_at` - Timestamp update trigger

**Migration File:** `supabase/migrations/20251227133732_fix_security_definer_and_search_path.sql`

## Leaked Password Protection

This app implements client-side password breach checking to prevent users from creating accounts with compromised passwords.

### How It Works

When a user creates an account or resets their password, the app:

1. Validates password strength requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number

2. Checks against HaveIBeenPwned API:
   - Uses k-anonymity model for privacy
   - Only sends first 5 characters of SHA-1 hash
   - Never sends actual password over network
   - Rejects passwords found in data breaches

### Implementation Files

- `lib/passwordSecurity.ts` - Core security functions
- `app/create-account.tsx` - Sign up validation
- `app/reset-password.tsx` - Password reset validation

### Additional Recommendation

For comprehensive protection, also enable Leaked Password Protection in your Supabase Dashboard:

1. Go to Authentication → Providers
2. Select Email provider
3. Enable "Leaked Password Protection"

This provides both client-side and server-side protection.

### Technical Details

The implementation uses the HaveIBeenPwned Pwned Passwords API v3, which:
- Protects user privacy through k-anonymity
- Checks against 800M+ compromised passwords
- Returns results without exposing the full password hash
- Is recommended by security experts worldwide
