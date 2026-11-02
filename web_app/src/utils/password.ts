/** Mirrors validateStrongPassword in backend/pkg/validation/validation.go. */

/** validator's `min=8` counts runes, so count code points rather than UTF-16 units. */
const MIN_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if ([...password].length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  const missing: string[] = [];
  if (!/\p{Lu}/u.test(password)) missing.push('an uppercase letter');
  if (!/\p{Ll}/u.test(password)) missing.push('a lowercase letter');
  if (!/\p{Nd}/u.test(password)) missing.push('a number');
  // Go's special class is unicode punctuation or symbols.
  if (!/[\p{P}\p{S}]/u.test(password)) missing.push('a special character');

  if (missing.length > 0) {
    const list =
      missing.length === 1
        ? missing[0]
        : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
    return `Password must include ${list}`;
  }
  return null;
}

/**
 * The backend answers validation failures with a generic "Validation failed"
 * plus a `details` string, so the raw `error` alone never explains anything.
 */
export function signupErrorMessage(data: any, fallback = 'Signup failed'): string {
  const details = typeof data?.details === 'string' ? data.details : '';
  if (/Password/i.test(details)) {
    return 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character';
  }
  if (/Email/i.test(details)) return 'Please enter a valid email address';
  return typeof data?.error === 'string' ? data.error : fallback;
}
