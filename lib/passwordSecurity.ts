/**
 * SHA-1 hash implementation for React Native
 */
async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a password has been leaked using HaveIBeenPwned API
 * Uses k-anonymity model - only sends first 5 chars of SHA-1 hash
 */
export async function checkPasswordBreach(password: string): Promise<boolean> {
  try {
    const hash = (await sha1(password)).toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        method: 'GET',
        headers: {
          'Add-Padding': 'true',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to check password breach status');
      return false;
    }

    const text = await response.text();
    const hashes = text.split('\n');

    for (const line of hashes) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix === suffix) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking password breach:', error);
    return false;
  }
}

/**
 * Validate password meets security requirements
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive password validation including breach check
 */
export async function validatePassword(password: string): Promise<{
  isValid: boolean;
  errors: string[];
}> {
  const strengthCheck = validatePasswordStrength(password);

  if (!strengthCheck.isValid) {
    return strengthCheck;
  }

  const isBreached = await checkPasswordBreach(password);

  if (isBreached) {
    return {
      isValid: false,
      errors: ['This password has been exposed in a data breach. Please choose a different password.'],
    };
  }

  return {
    isValid: true,
    errors: [],
  };
}
