import { EMAIL_REGEX, PHONE_REGEX } from './validators';

export type IdentifierType = 'email' | 'phone';

export interface NormalizedIdentifier {
  type: IdentifierType;
  value: string;
}

const PHONE_SEPARATORS = /[\s().-]/g;

export function normalizeIdentifier(raw: unknown): NormalizedIdentifier | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();

  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    return EMAIL_REGEX.test(email) ? { type: 'email', value: email } : null;
  }

  const phone = trimmed.replace(PHONE_SEPARATORS, '');
  return PHONE_REGEX.test(phone) ? { type: 'phone', value: phone } : null;
}
