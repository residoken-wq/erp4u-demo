import { getApiBaseUrl, fetchWithAuth } from '../copilotApi.ts';
import { VoiceProvider, getVoiceErrorMessage } from './voiceStateMachine.ts';

export interface VoiceConfig {
  enabled: boolean;
  provider: VoiceProvider;
  max_seconds: number;
}

export interface VoiceSettings {
  enabled: boolean;
  provider: VoiceProvider;
  updated_at?: string;
}

export interface SttResult {
  transcript: string;
  seconds: number;
}

export class VoiceApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string = 'STT_FAILED', status: number = 500) {
    super(message);
    this.name = 'VoiceApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Lấy cấu hình giọng nói người dùng (GET /api/ai/voice/config)
 */
export async function getVoiceConfig(baseUrl: string = getApiBaseUrl()): Promise<VoiceConfig> {
  try {
    const res = await fetchWithAuth(`${baseUrl}/ai/voice/config`);
    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        return { enabled: false, provider: 'gemini', max_seconds: 60 };
      }
      throw new VoiceApiError(`Lỗi tải cấu hình giọng nói (${res.status})`, 'CONFIG_ERROR', res.status);
    }
    const data = await res.json();
    return {
      enabled: Boolean(data?.enabled),
      provider: data?.provider === 'browser' ? 'browser' : 'gemini',
      max_seconds: typeof data?.max_seconds === 'number' ? data.max_seconds : 60,
    };
  } catch (err: any) {
    if (err instanceof VoiceApiError) throw err;
    return { enabled: false, provider: 'gemini', max_seconds: 60 };
  }
}

/**
 * Tải lên audio và nhận diện văn bản (POST /api/ai/stt)
 */
export async function uploadVoiceAudio(
  audioBlob: Blob,
  baseUrl: string = getApiBaseUrl(),
): Promise<SttResult> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording');

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}/ai/stt`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errorCode = 'STT_FAILED';
    let errorMessage = `Lỗi máy chủ (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.code) errorCode = errJson.code;
      if (errJson.message) errorMessage = errJson.message;
    } catch {
      // response body not json
    }
    const friendlyMessage = getVoiceErrorMessage(errorCode, errorMessage);
    throw new VoiceApiError(friendlyMessage, errorCode, res.status);
  }

  const data = await res.json();
  return {
    transcript: data.transcript || '',
    seconds: data.seconds || 1,
  };
}

/**
 * Lấy cấu hình admin (GET /api/ai/voice/settings)
 */
export async function getVoiceSettings(baseUrl: string = getApiBaseUrl()): Promise<VoiceSettings> {
  const res = await fetchWithAuth(`${baseUrl}/ai/voice/settings`);
  if (!res.ok) {
    let errorCode = 'FORBIDDEN';
    let message = 'Không có quyền truy cập cấu hình giọng nói';
    try {
      const errJson = await res.json();
      if (errJson.code) errorCode = errJson.code;
      if (errJson.message) message = errJson.message;
    } catch {}
    throw new VoiceApiError(getVoiceErrorMessage(errorCode, message), errorCode, res.status);
  }
  return res.json();
}

/**
 * Cập nhật cấu hình admin (PUT /api/ai/voice/settings)
 */
export async function updateVoiceSettings(
  settings: { enabled: boolean; provider: VoiceProvider },
  baseUrl: string = getApiBaseUrl(),
): Promise<VoiceSettings> {
  const res = await fetchWithAuth(`${baseUrl}/ai/voice/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    let errorCode = 'FORBIDDEN';
    let message = 'Lỗi cập nhật cấu hình giọng nói';
    try {
      const errJson = await res.json();
      if (errJson.code) errorCode = errJson.code;
      if (errJson.message) message = errJson.message;
    } catch {}
    throw new VoiceApiError(getVoiceErrorMessage(errorCode, message), errorCode, res.status);
  }
  return res.json();
}
