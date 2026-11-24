import { useState, useRef, useEffect, useCallback } from 'react';
import { isBrowserSpeechSupported, getVoiceErrorMessage } from './voiceStateMachine.ts';

export interface UseBrowserSpeechOptions {
  maxSeconds?: number;
  onTranscript?: (transcript: string) => void;
  onError?: (error: string, code?: string) => void;
}

export function useBrowserSpeech(options: UseBrowserSpeechOptions = {}) {
  const { maxSeconds = 60, onTranscript, onError } = options;

  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [seconds, setSeconds] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const autoStopTimeoutRef = useRef<any>(null);
  const fullTranscriptRef = useRef<string>('');
  const isCancelledRef = useRef<boolean>(false);

  const isSupported = isBrowserSpeechSupported();

  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const errMsg = 'Trình duyệt không hỗ trợ nhận dạng giọng nói trực tiếp';
      setError(errMsg);
      onError?.(errMsg, 'UNSUPPORTED_BROWSER_SPEECH');
      return;
    }

    cleanup();
    isCancelledRef.current = false;
    fullTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setSeconds(0);
    setError(null);

    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;

      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            currentFinal += text + ' ';
          } else {
            currentInterim += text;
          }
        }

        if (currentFinal) {
          fullTranscriptRef.current = (fullTranscriptRef.current + ' ' + currentFinal).trim();
          setTranscript(fullTranscriptRef.current);
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        if (isCancelledRef.current) return;
        let code = 'STT_FAILED';
        if (event.error === 'not-allowed') {
          code = 'NotAllowedError';
        } else if (event.error === 'no-speech') {
          code = 'EMPTY_TRANSCRIPT';
        }
        const msg = getVoiceErrorMessage(code, event.error);
        setError(msg);
        onError?.(msg, code);
        cleanup();
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!isCancelledRef.current) {
          const finalResult = (fullTranscriptRef.current + ' ' + interimTranscript).trim();
          if (finalResult) {
            onTranscript?.(finalResult);
          }
        }
        cleanup();
      };

      recognition.start();

      // Start 60s timer
      timerIntervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          if (next >= maxSeconds) {
            stopListening();
          }
          return next;
        });
      }, 1000);

      autoStopTimeoutRef.current = setTimeout(() => {
        stopListening();
      }, maxSeconds * 1000);
    } catch (err: any) {
      cleanup();
      const msg = getVoiceErrorMessage('STT_FAILED', err?.message);
      setError(msg);
      onError?.(msg, 'STT_FAILED');
    }
  }, [cleanup, isSupported, maxSeconds, onError, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        cleanup();
      }
    } else {
      cleanup();
    }
  }, [cleanup]);

  const cancelListening = useCallback(() => {
    isCancelledRef.current = true;
    fullTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setSeconds(0);
    cleanup();
  }, [cleanup]);

  return {
    isSupported,
    isListening,
    transcript: transcript || interimTranscript,
    interimTranscript,
    seconds,
    error,
    startListening,
    stopListening,
    cancelListening,
  };
}
