/**
 * Pure state machine and helpers for Voice input in ERP4U Copilot.
 * States: idle -> consent -> requesting -> recording -> uploading -> done | error
 */

export type VoiceState =
  | 'idle'
  | 'consent'
  | 'requesting'
  | 'recording'
  | 'uploading'
  | 'done'
  | 'error';

export type VoiceProvider = 'gemini' | 'browser';

export interface VoiceContext {
  state: VoiceState;
  provider: VoiceProvider;
  transcript: string;
  seconds: number;
  error: string | null;
  errorCode: string | null;
}

export type VoiceEvent =
  | { type: 'START'; hasConsent: boolean; provider?: VoiceProvider }
  | { type: 'GRANT_CONSENT' }
  | { type: 'DENY_CONSENT' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED'; error?: string; errorCode?: string }
  | { type: 'RECORDING_STARTED' }
  | { type: 'STOP' }
  | { type: 'AUTO_STOP' }
  | { type: 'UPLOAD_START' }
  | { type: 'UPLOAD_SUCCESS'; transcript: string; seconds?: number }
  | { type: 'UPLOAD_ERROR'; error: string; errorCode?: string }
  | { type: 'SPEECH_SUCCESS'; transcript: string; seconds?: number }
  | { type: 'SPEECH_ERROR'; error: string; errorCode?: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export const INITIAL_VOICE_CONTEXT: VoiceContext = {
  state: 'idle',
  provider: 'gemini',
  transcript: '',
  seconds: 0,
  error: null,
  errorCode: null,
};

/**
 * Pure reducer function for Voice state transitions
 */
export function transitionVoiceState(
  current: VoiceContext,
  event: VoiceEvent,
): VoiceContext {
  switch (event.type) {
    case 'START': {
      const provider = event.provider ?? current.provider;
      if (current.state !== 'idle' && current.state !== 'done' && current.state !== 'error') {
        return current;
      }
      if (!event.hasConsent) {
        return {
          ...current,
          provider,
          state: 'consent',
          error: null,
          errorCode: null,
          transcript: '',
          seconds: 0,
        };
      }
      return {
        ...current,
        provider,
        state: 'requesting',
        error: null,
        errorCode: null,
        transcript: '',
        seconds: 0,
      };
    }

    case 'GRANT_CONSENT': {
      if (current.state !== 'consent') return current;
      return {
        ...current,
        state: 'requesting',
        error: null,
        errorCode: null,
      };
    }

    case 'DENY_CONSENT': {
      if (current.state !== 'consent') return current;
      return {
        ...current,
        state: 'idle',
        error: null,
        errorCode: null,
      };
    }

    case 'PERMISSION_GRANTED': {
      if (current.state !== 'requesting') return current;
      return {
        ...current,
        state: 'recording',
        error: null,
        errorCode: null,
      };
    }

    case 'PERMISSION_DENIED': {
      return {
        ...current,
        state: 'error',
        error: event.error || 'Trình duyệt chưa được cấp quyền micro',
        errorCode: event.errorCode || 'PERMISSION_DENIED',
      };
    }

    case 'RECORDING_STARTED': {
      return {
        ...current,
        state: 'recording',
      };
    }

    case 'STOP':
    case 'AUTO_STOP': {
      if (current.state !== 'recording') return current;
      if (current.provider === 'browser') {
        return {
          ...current,
          state: 'done',
        };
      }
      return {
        ...current,
        state: 'uploading',
      };
    }

    case 'UPLOAD_START': {
      return {
        ...current,
        state: 'uploading',
      };
    }

    case 'UPLOAD_SUCCESS': {
      if (current.state !== 'uploading') return current;
      return {
        ...current,
        state: 'done',
        transcript: event.transcript,
        seconds: event.seconds ?? current.seconds,
        error: null,
        errorCode: null,
      };
    }

    case 'UPLOAD_ERROR': {
      return {
        ...current,
        state: 'error',
        error: event.error,
        errorCode: event.errorCode || 'STT_FAILED',
      };
    }

    case 'SPEECH_SUCCESS': {
      return {
        ...current,
        state: 'done',
        transcript: event.transcript,
        seconds: event.seconds ?? current.seconds,
        error: null,
        errorCode: null,
      };
    }

    case 'SPEECH_ERROR': {
      return {
        ...current,
        state: 'error',
        error: event.error,
        errorCode: event.errorCode || 'SPEECH_ERROR',
      };
    }

    case 'CANCEL': {
      return {
        ...current,
        state: 'idle',
        error: null,
        errorCode: null,
      };
    }

    case 'RESET': {
      return {
        ...INITIAL_VOICE_CONTEXT,
        provider: current.provider,
      };
    }

    default:
      return current;
  }
}

/**
 * Mime type selection with priority:
 * 1. audio/webm;codecs=opus (Chrome, Edge, Firefox, Android)
 * 2. audio/mp4 (Safari, iOS)
 * 3. other fallbacks or throw error
 */
export const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/wav',
];

export function selectSupportedMimeType(
  isTypeSupported?: (mime: string) => boolean,
): string {
  const checker =
    isTypeSupported ??
    (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
      ? (m: string) => MediaRecorder.isTypeSupported(m)
      : () => false);

  if (checker('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (checker('audio/webm')) return 'audio/webm';
  if (checker('audio/mp4')) return 'audio/mp4';
  if (checker('audio/aac')) return 'audio/aac';
  if (checker('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
  if (checker('audio/wav')) return 'audio/wav';

  throw new Error('UNSUPPORTED_BROWSER_AUDIO');
}

/**
 * Standard error messages in Vietnamese mapped to contract error codes
 */
export const VOICE_ERROR_MESSAGES: Record<string, string> = {
  UNSUPPORTED_AUDIO: 'Định dạng âm thanh không được hỗ trợ',
  AUDIO_TOO_LARGE: 'File ghi âm vượt quá giới hạn 2 MB',
  EMPTY_TRANSCRIPT: 'Không nhận diện được lời nói hoặc âm thanh quá nhỏ',
  INSUFFICIENT_STT_QUOTA: 'Đã hết hạn mức nhận dạng giọng nói của tháng',
  AI_QUOTA_EXCEEDED: 'Đã hết hạn mức nhận dạng giọng nói của tháng',
  VOICE_DISABLED: 'Tính năng nhập giọng nói đã bị tắt bởi quản trị viên',
  PACKAGE_NOT_ENABLED: 'Gói tính năng AI chưa được kích hoạt trên hệ thống',
  RATE_LIMITED: 'Bạn đã vượt quá giới hạn 60 lần ghi âm/giờ. Vui lòng thử lại sau',
  STT_FAILED: 'Dịch vụ nhận dạng giọng nói gặp sự cố, vui lòng thử lại sau',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
  PERMISSION_DENIED: 'Trình duyệt chưa được cấp quyền micro. Vui lòng bật quyền micro trên thanh địa chỉ',
  NOT_ALLOWED: 'Trình duyệt chưa được cấp quyền micro. Vui lòng bật quyền micro trên thanh địa chỉ',
  NotAllowedError: 'Trình duyệt chưa được cấp quyền micro. Vui lòng bật quyền micro trên thanh địa chỉ',
  UNSUPPORTED_BROWSER_AUDIO: 'Trình duyệt không hỗ trợ định dạng âm thanh phù hợp (WebM/MP4)',
  UNSUPPORTED_BROWSER: 'Trình duyệt không hỗ trợ thiết bị ghi âm',
};

export function getVoiceErrorMessage(
  codeOrError?: string | null,
  fallbackMessage?: string,
): string {
  if (codeOrError && VOICE_ERROR_MESSAGES[codeOrError]) {
    return VOICE_ERROR_MESSAGES[codeOrError];
  }
  return fallbackMessage || codeOrError || 'Có lỗi xảy ra khi xử lý giọng nói';
}

/**
 * Check if the browser supports SpeechRecognition / webkitSpeechRecognition
 */
export function isBrowserSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition,
  );
}

/**
 * Check if the browser supports getUserMedia / MediaRecorder
 */
export function isMediaRecorderSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(
    navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined',
  );
}

export const VOICE_CONSENT_KEY = 'erp4u_voice_consent_given';
export const VOICE_DENIED_SESSION_KEY = 'erp4u_voice_denied_session';

export function hasUserGivenVoiceConsent(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(VOICE_CONSENT_KEY) === 'true';
    }
  } catch {}
  return false;
}

export function saveUserVoiceConsent(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOICE_CONSENT_KEY, 'true');
    }
  } catch {}
}

export function wasPermissionDeniedInSession(): boolean {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(VOICE_DENIED_SESSION_KEY) === 'true';
    }
  } catch {}
  return false;
}

export function markPermissionDeniedInSession(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(VOICE_DENIED_SESSION_KEY, 'true');
    }
  } catch {}
}

