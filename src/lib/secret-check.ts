/** Why AUTH_SECRET (or SETUP_KEY) can't be used, or null when it's fine. Placeholders from .env.example are public. */
export function secretProblem(s: string | undefined): 'missing' | 'too short (needs 32+ characters)' | 'still the example value: replace it' | null {
  if (!s) return 'missing';
  if (/CHANGE_?ME|paste-a-long-random-string|your[-_]?secret/i.test(s)) return 'still the example value: replace it';
  if (s.length < 32) return 'too short (needs 32+ characters)';
  return null;
}
