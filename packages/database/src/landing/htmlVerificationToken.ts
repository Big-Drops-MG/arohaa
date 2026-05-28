import { randomBytes } from 'node:crypto';

export function generateHtmlVerificationToken(): string {
  return randomBytes(24).toString('base64url');
}
