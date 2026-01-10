/**
 * SHA-1 hash implementation for React Native
 */
async function sha1(message: string): Promise<string> {
  if (typeof TextEncoder === 'undefined' || typeof crypto === 'undefined') {
    throw new Error('TextEncoder or crypto not available in this environment');
  }
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
    throw new Error('Failed to check password breach status');
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
}

/**
 * Calculate password strength score
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  level: 'weak' | 'medium' | 'strong';
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
    isLongEnough: boolean;
  };
} {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    isLongEnough: password.length >= 12,
  };

  let score = 0;
  if (checks.minLength) score += 1;
  if (checks.hasUppercase) score += 1;
  if (checks.hasLowercase) score += 1;
  if (checks.hasNumber) score += 1;
  if (checks.hasSpecialChar) score += 1;
  if (checks.isLongEnough) score += 1;

  let level: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 5) {
    level = 'strong';
  } else if (score >= 4) {
    level = 'medium';
  }

  return { score, level, checks };
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

  try {
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
  } catch (error) {
    console.error('Password breach check failed:', error);
    return {
      isValid: false,
      errors: ['Unable to verify password security. Please try again or choose a different password.'],
    };
  }
}
