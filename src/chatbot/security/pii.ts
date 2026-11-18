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

export function scanPii(text: string): boolean {
  if (!text) return false;
  const vnPhoneRegex = /((\+84|0)(3|5|7|8|9)[0-9]{8})/;
  const emailRegex = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,})/;
  const digitsRegex = /\b\d{9,14}\b/;
  return vnPhoneRegex.test(text) || emailRegex.test(text) || digitsRegex.test(text);
}

export function normalizeVi(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

