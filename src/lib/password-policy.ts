/* What counts as a strong enough admin password. Used wherever a password is set. */

// The most used passwords that are 10+ characters long; attackers try these first.
const COMMON = new Set([
  '1234567890', '0123456789', '12345678910', '123456789a', 'qwertyuiop', 'password12', 'password123', 'password1234',
  'iloveyou12', '1q2w3e4r5t', 'qwerty1234', 'qwerty12345', 'abcdefghij', 'abc1234567', 'aaaaaaaaaa', '1111111111',
  'football12', 'princess12', 'sunshine12', 'welcome123', 'admin12345', 'administrator', 'letmein123', 'bangladesh',
  'bangladesh1', 'bangladesh123', 'neversettle', 'neversettle1', 'neversettle123', 'changeme123', 'passw0rd123', 'p@ssw0rd123',
  'zxcvbnm123', 'asdfghjkl1', 'q1w2e3r4t5', 'dhaka12345', 'superman12', 'trustno1234', 'password!1',
]);

export const PASSWORD_MIN = 10;

export const PASSWORD_MESSAGES = {
  short: `Use a password of at least ${PASSWORD_MIN} characters.`,
  long: 'Use a password under 200 characters.',
  guess: 'This password is too easy to guess. Try a short sentence or three random words.',
  email: 'Don’t use your email name in your password.',
  variety: 'Use more different characters in your password.',
} as const;
export type PasswordIssue = keyof typeof PASSWORD_MESSAGES;

/** What's wrong with the password, or null when it's fine. */
export function passwordIssue(pw: string, email?: string): PasswordIssue | null {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN) return 'short';
  if (pw.length > 200) return 'long';
  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(pw) || /^(0123456789|1234567890|abcdefghij)/.test(lower)) return 'guess';
  const user = email?.split('@')[0]?.toLowerCase();
  if (user && user.length >= 4 && lower.includes(user)) return 'email';
  if (new Set(pw).size < 5) return 'variety';
  return null;
}

/** A sentence saying what's wrong, or null when the password is fine. */
export function passwordProblem(pw: string, email?: string): string | null {
  const issue = passwordIssue(pw, email);
  return issue ? PASSWORD_MESSAGES[issue] : null;
}
