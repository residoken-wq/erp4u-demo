/**
 * Shared validation rules for Chatbot configuration.
 * Used by both ChatbotConfigDto (class-validator decorators on PUT)
 * and ChatbotConfigService.validateAndSanitize() (on reading from DB).
 */

export const AVATAR_URL_REGEX = /^(\/(?!\/)|https:\/\/)/;
export const TIME_STEP_REGEX = /^([01]\d|2[0-3]):(00|15|30|45)$/;
export const HOTLINE_REGEX = /^[\d\s+\-,.]{8,50}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SAFE_TEXT_REGEX = /^[^<>{}]*$/;

export function checkNoSecret(value: any): boolean {
  if (typeof value !== 'string') return true;
  if (/AIza[0-9A-Za-z_-]{20,}/.test(value)) return false;
  if (/sk-[A-Za-z0-9]{20,}/.test(value)) return false;
  // Reject raw long secret tokens (32+ base64/hex without spaces unless URL or path)
  if (
    /[A-Za-z0-9+/=_-]{32,}/.test(value) &&
    !value.startsWith('http://') &&
    !value.startsWith('https://') &&
    !value.startsWith('/')
  ) {
    return false;
  }
  return true;
}

export function checkDisplayName(val: any): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  if (!SAFE_TEXT_REGEX.test(val)) return false;
  return checkNoSecret(val);
}

export function checkShortName(val: any): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 2 || trimmed.length > 30) return false;
  if (!SAFE_TEXT_REGEX.test(val)) return false;
  return checkNoSecret(val);
}

export function checkAvatarUrl(val: any): boolean {
  if (typeof val !== 'string') return false;
  if (val.length > 500) return false;
  if (/\s/.test(val)) return false;
  // Must start with / (not //) or https://
  if (!AVATAR_URL_REGEX.test(val)) return false;
  if (/[<>"']/.test(val)) return false;
  return checkNoSecret(val);
}

export function checkGreeting(val: any): boolean {
  if (typeof val !== 'string') return false;
  if (val.length < 2 || val.length > 300) return false;
  if (/[<>]/.test(val)) return false;
  const matches = val.match(/{([^}]+)}/g);
  if (matches) {
    for (const m of matches) {
      if (m !== '{short_name}' && m !== '{display_name}') {
        return false;
      }
    }
  }
  return checkNoSecret(val);
}

export function checkHotline(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val !== 'string') return false;
  if (val.length > 50) return false;
  if (!HOTLINE_REGEX.test(val)) return false;
  return checkNoSecret(val);
}

export function checkZaloUrl(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val !== 'string') return false;
  if (val.length > 500) return false;
  if (!val.startsWith('https://')) return false;
  if (/<|>|"|'|\s/.test(val)) return false;
  return checkNoSecret(val);
}

export function checkMessengerUrl(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val !== 'string') return false;
  if (val.length > 500) return false;
  if (!val.startsWith('https://')) return false;
  if (/<|>|"|'|\s/.test(val)) return false;
  return checkNoSecret(val);
}

export function checkEmail(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val !== 'string') return false;
  if (val.length > 254) return false;
  if (!EMAIL_REGEX.test(val)) return false;
  if (/[<>"']/.test(val)) return false;
  return checkNoSecret(val);
}

export function checkResponseSlaText(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val !== 'string') return false;
  if (val.length > 300) return false;
  if (!SAFE_TEXT_REGEX.test(val)) return false;
  return checkNoSecret(val);
}

export function checkDaySchedule(day: any): boolean {
  if (!day || typeof day !== 'object') return false;
  if (typeof day.off !== 'boolean') return false;

  if (day.off) {
    // When off is true, from/to are optional, but if present must be valid time strings
    if (day.from && (!TIME_STEP_REGEX.test(day.from) || typeof day.from !== 'string')) return false;
    if (day.to && (!TIME_STEP_REGEX.test(day.to) || typeof day.to !== 'string')) return false;
    return true;
  }

  // When off is false, from and to must be valid time strings with from < to
  if (typeof day.from !== 'string' || !TIME_STEP_REGEX.test(day.from)) return false;
  if (typeof day.to !== 'string' || !TIME_STEP_REGEX.test(day.to)) return false;

  const [fromH, fromM] = day.from.split(':').map(Number);
  const [toH, toM] = day.to.split(':').map(Number);
  const fromMin = fromH * 60 + fromM;
  const toMin = toH * 60 + toM;

  return fromMin < toMin;
}

export function checkHolidayNote(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val !== 'string') return false;
  if (val.length > 300) return false;
  if (/[<>]/.test(val)) return false;
  return checkNoSecret(val);
}

export function checkTimezone(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: val });
    return true;
  } catch {
    return false;
  }
}
