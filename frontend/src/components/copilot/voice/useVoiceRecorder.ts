import { useState, useRef, useEffect, useCallback } from 'react';
import {
  VoiceContext,
  VoiceEvent,
  INITIAL_VOICE_CONTEXT,
  transitionVoiceState,
  selectSupportedMimeType,
  getVoiceErrorMessage,
} from './voiceStateMachine.ts';
import { uploadVoiceAudio, VoiceApiError } from './voiceApi.ts';

export interface UseVoiceRecorderOptions {
  baseUrl?: string;
  maxSeconds?: number;
  onTranscript?: (transcript: string, seconds: number) => void;
  onError?: (error: string, code?: string) => void;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const { baseUrl, maxSeconds = 60, onTranscript, onError } = options;

  const [context, setContext] = useState<VoiceContext>(INITIAL_VOICE_CONTEXT);
  const [seconds, setSeconds] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const autoStopTimeoutRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Dispatch event through pure reducer
  const dispatch = useCallback((event: VoiceEvent) => {
    setContext((prev) => transitionVoiceState(prev, event));
  }, []);

  // Stop all media tracks safely
  const releaseStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      releaseStream();
    };
  }, [releaseStream]);

  // Start recording
  const startRecording = useCallback(
    async (hasConsent: boolean = true) => {
      isCancelledRef.current = false;
      audioChunksRef.current = [];
      setSeconds(0);

      dispatch({ type: 'START', hasConsent, provider: 'gemini' });

      if (!hasConsent) {
        return;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const errMsg = getVoiceErrorMessage('UNSUPPORTED_BROWSER');
          dispatch({ type: 'PERMISSION_DENIED', error: errMsg, errorCode: 'UNSUPPORTED_BROWSER' });
          onError?.(errMsg, 'UNSUPPORTED_BROWSER');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isCancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;

        let mimeType: string;
        try {
          mimeType = selectSupportedMimeType();
        } catch {
          const errMsg = getVoiceErrorMessage('UNSUPPORTED_BROWSER_AUDIO');
          dispatch({ type: 'PERMISSION_DENIED', error: errMsg, errorCode: 'UNSUPPORTED_BROWSER_AUDIO' });
          onError?.(errMsg, 'UNSUPPORTED_BROWSER_AUDIO');
          releaseStream();
          return;
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          releaseStream();
          if (isCancelledRef.current) {
            audioChunksRef.current = [];
            return;
          }

          const recordedChunks = [...audioChunksRef.current];
          audioChunksRef.current = [];
          if (recordedChunks.length === 0) {
            const errMsg = getVoiceErrorMessage('EMPTY_TRANSCRIPT');
            dispatch({ type: 'UPLOAD_ERROR', error: errMsg, errorCode: 'EMPTY_TRANSCRIPT' });
            onError?.(errMsg, 'EMPTY_TRANSCRIPT');
            return;
          }

          const audioBlob = new Blob(recordedChunks, { type: mimeType || 'audio/webm' });
          if (audioBlob.size > 2 * 1024 * 1024) {
            const errMsg = getVoiceErrorMessage('AUDIO_TOO_LARGE');
            dispatch({ type: 'UPLOAD_ERROR', error: errMsg, errorCode: 'AUDIO_TOO_LARGE' });
            onError?.(errMsg, 'AUDIO_TOO_LARGE');
            return;
          }

          dispatch({ type: 'UPLOAD_START' });

          try {
            const result = await uploadVoiceAudio(audioBlob, baseUrl);
            dispatch({
              type: 'UPLOAD_SUCCESS',
              transcript: result.transcript,
              seconds: result.seconds,
            });
            onTranscript?.(result.transcript, result.seconds);
          } catch (err: any) {
            const errorCode = err instanceof VoiceApiError ? err.code : 'STT_FAILED';
            const errorMsg = err.message || getVoiceErrorMessage(errorCode);
            dispatch({ type: 'UPLOAD_ERROR', error: errorMsg, errorCode });
            onError?.(errorMsg, errorCode);
          }
        };

        recorder.start(250); // timeslice 250ms
        dispatch({ type: 'PERMISSION_GRANTED' });

        // Start timer
        timerIntervalRef.current = setInterval(() => {
          setSeconds((prev) => {
            const next = prev + 1;
            if (next >= maxSeconds) {
              stopRecording();
            }
            return next;
          });
        }, 1000);

        // Auto-stop timeout safety
        autoStopTimeoutRef.current = setTimeout(() => {
          stopRecording();
        }, maxSeconds * 1000);
      } catch (err: any) {
        releaseStream();
        let code = 'PERMISSION_DENIED';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          code = 'NotAllowedError';
        }
        const errMsg = getVoiceErrorMessage(code, err.message);
        dispatch({ type: 'PERMISSION_DENIED', error: errMsg, errorCode: code });
        onError?.(errMsg, code);
      }
    },
    [baseUrl, dispatch, maxSeconds, onError, onTranscript, releaseStream],
  );

  // Stop recording normally
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      dispatch({ type: 'STOP' });
    }
  }, [dispatch]);

  // Cancel recording and discard audio
  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    audioChunksRef.current = [];
    releaseStream();
    dispatch({ type: 'CANCEL' });
    setSeconds(0);
  }, [dispatch, releaseStream]);

  // Reset to initial state
  const reset = useCallback(() => {
    cancelRecording();
    dispatch({ type: 'RESET' });
    setSeconds(0);
  }, [cancelRecording, dispatch]);

  return {
    state: context.state,
    isRecording: context.state === 'recording',
    isUploading: context.state === 'uploading',
    isRequesting: context.state === 'requesting',
    isConsent: context.state === 'consent',
    seconds,
    maxSeconds,
    transcript: context.transcript,
    error: context.error,
    errorCode: context.errorCode,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    dispatch,
  };
}
