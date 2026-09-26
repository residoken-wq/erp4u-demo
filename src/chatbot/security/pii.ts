import * as crypto from 'crypto';

const RUNTIME_SALT = crypto.randomBytes(16).toString('hex');

export function hashIp(ip: string, salt: string = RUNTIME_SALT): string {
  if (!ip) return '';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
}

export function hashToken(token: string): string {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function normalizePhone(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+84' + cleaned.slice(1);
  } else if (cleaned.startsWith('84') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}
