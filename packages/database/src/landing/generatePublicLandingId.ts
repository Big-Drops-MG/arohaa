import { randomBytes } from 'node:crypto';

export function generatePublicLandingId(): string {
  return `lp_${randomBytes(12).toString('base64url')}`;
}
