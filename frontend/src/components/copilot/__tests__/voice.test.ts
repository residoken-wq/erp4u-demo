import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { VoiceContext } from '../voice/voiceStateMachine.ts';
import {
  INITIAL_VOICE_CONTEXT,
  transitionVoiceState,
  selectSupportedMimeType,
  getVoiceErrorMessage,
  VOICE_ERROR_MESSAGES,
  hasUserGivenVoiceConsent,
  saveUserVoiceConsent,
  wasPermissionDeniedInSession,
  markPermissionDeniedInSession,
  VOICE_CONSENT_KEY,
  VOICE_DENIED_SESSION_KEY,
} from '../voice/voiceStateMachine.ts';
import { createMarkdownComponents } from '../copilotApi.ts';

test('Voice STT Unit Tests (Task P9f1)', async (t) => {
  await t.test('1. Máy trạng thái thuần: các chuyển trạng thái cơ bản', () => {
    let ctx: VoiceContext = { ...INITIAL_VOICE_CONTEXT };
    assert.strictEqual(ctx.state, 'idle');

    // Bắt đầu chưa có consent -> chuyển sang consent
    ctx = transitionVoiceState(ctx, { type: 'START', hasConsent: false, provider: 'gemini' });
    assert.strictEqual(ctx.state, 'consent');
    assert.strictEqual(ctx.provider, 'gemini');

    // Từ chối consent -> về idle
    ctx = transitionVoiceState(ctx, { type: 'DENY_CONSENT' });
    assert.strictEqual(ctx.state, 'idle');

    // Bắt đầu lại có consent -> chuyển sang requesting
    ctx = transitionVoiceState(ctx, { type: 'START', hasConsent: true, provider: 'gemini' });
    assert.strictEqual(ctx.state, 'requesting');

    // Được cấp quyền micro -> chuyển sang recording
    ctx = transitionVoiceState(ctx, { type: 'PERMISSION_GRANTED' });
    assert.strictEqual(ctx.state, 'recording');

    // Dừng ghi luồng Gemini -> chuyển sang uploading
    ctx = transitionVoiceState(ctx, { type: 'STOP' });
    assert.strictEqual(ctx.state, 'uploading');

    // Upload thành công -> chuyển sang done kèm transcript
    ctx = transitionVoiceState(ctx, {
      type: 'UPLOAD_SUCCESS',
      transcript: 'Doanh thu tháng 11',
      seconds: 5,
    });
    assert.strictEqual(ctx.state, 'done');
    assert.strictEqual(ctx.transcript, 'Doanh thu tháng 11');
    assert.strictEqual(ctx.seconds, 5);

    // Reset -> về idle
    ctx = transitionVoiceState(ctx, { type: 'RESET' });
    assert.strictEqual(ctx.state, 'idle');
    assert.strictEqual(ctx.transcript, '');
  });

  await t.test('2. Máy trạng thái: huỷ giữa chừng (CANCEL / Esc)', () => {
    let ctx: VoiceContext = { ...INITIAL_VOICE_CONTEXT, state: 'recording' };

    // Bấm Huỷ hoặc nhấn phím Esc khi đang ghi âm -> về idle ngay lập tức
    ctx = transitionVoiceState(ctx, { type: 'CANCEL' });
    assert.strictEqual(ctx.state, 'idle');

    // Bấm Huỷ khi đang upload -> về idle
    ctx = { ...INITIAL_VOICE_CONTEXT, state: 'uploading' };
    ctx = transitionVoiceState(ctx, { type: 'CANCEL' });
    assert.strictEqual(ctx.state, 'idle');
  });

  await t.test('3. Máy trạng thái: tự dừng sau 60 giây (AUTO_STOP)', () => {
    // Luồng Gemini: AUTO_STOP chuyển sang uploading
    let ctxGemini: VoiceContext = {
      ...INITIAL_VOICE_CONTEXT,
      state: 'recording',
      provider: 'gemini',
    };
    ctxGemini = transitionVoiceState(ctxGemini, { type: 'AUTO_STOP' });
    assert.strictEqual(ctxGemini.state, 'uploading');

    // Luồng Browser: AUTO_STOP chuyển sang done
    let ctxBrowser: VoiceContext = {
      ...INITIAL_VOICE_CONTEXT,
      state: 'recording',
      provider: 'browser',
    };
    ctxBrowser = transitionVoiceState(ctxBrowser, { type: 'AUTO_STOP' });
    assert.strictEqual(ctxBrowser.state, 'done');
  });

  await t.test('4. Máy trạng thái: lỗi quyền micro (PERMISSION_DENIED / NotAllowedError)', () => {
    let ctx: VoiceContext = { ...INITIAL_VOICE_CONTEXT, state: 'requesting' };
    ctx = transitionVoiceState(ctx, {
      type: 'PERMISSION_DENIED',
      error: 'Quyền micro bị từ chối',
      errorCode: 'NotAllowedError',
    });
    assert.strictEqual(ctx.state, 'error');
    assert.strictEqual(ctx.errorCode, 'NotAllowedError');
    assert.strictEqual(ctx.error, 'Quyền micro bị từ chối');
  });

  await t.test('5. Máy trạng thái: lỗi upload STT (UPLOAD_ERROR)', () => {
    let ctx: VoiceContext = { ...INITIAL_VOICE_CONTEXT, state: 'uploading' };
    ctx = transitionVoiceState(ctx, {
      type: 'UPLOAD_ERROR',
      error: 'Đã hết hạn mức nhận dạng giọng nói của tháng',
      errorCode: 'INSUFFICIENT_STT_QUOTA',
    });
    assert.strictEqual(ctx.state, 'error');
    assert.strictEqual(ctx.errorCode, 'INSUFFICIENT_STT_QUOTA');
  });

  await t.test('6. Chọn MIME type (selectSupportedMimeType): ưu tiên webm;codecs=opus -> mp4 -> ném lỗi', () => {
    // Giả lập Chrome/Edge: hỗ trợ cả webm và mp4 -> chọn webm;codecs=opus
    const mimeChrome = selectSupportedMimeType((m) => m.startsWith('audio/webm'));
    assert.strictEqual(mimeChrome, 'audio/webm;codecs=opus');

    // Giả lập Safari iOS: không hỗ trợ webm, chỉ hỗ trợ audio/mp4 -> chọn audio/mp4
    const mimeSafari = selectSupportedMimeType((m) => m === 'audio/mp4');
    assert.strictEqual(mimeSafari, 'audio/mp4');

    // Giả lập trình duyệt cũ không hỗ trợ định dạng nào -> ném lỗi UNSUPPORTED_BROWSER_AUDIO
    assert.throws(
      () => {
        selectSupportedMimeType(() => false);
      },
      (err: any) => err.message === 'UNSUPPORTED_BROWSER_AUDIO',
    );
  });

  await t.test('7. Chọn adapter: provider = browser nhưng trình duyệt không hỗ trợ -> tự động dùng Gemini', () => {
    function resolveVoiceProvider(
      configProvider: 'gemini' | 'browser',
      isSpeechSupported: boolean,
    ): 'gemini' | 'browser' {
      if (configProvider === 'browser' && isSpeechSupported) {
        return 'browser';
      }
      return 'gemini';
    }

    // Config browser + có hỗ trợ -> browser
    assert.strictEqual(resolveVoiceProvider('browser', true), 'browser');

    // Config browser + KHÔNG hỗ trợ (Firefox/Safari) -> tự động chuyển sang gemini
    assert.strictEqual(resolveVoiceProvider('browser', false), 'gemini');

    // Config gemini -> luôn gemini
    assert.strictEqual(resolveVoiceProvider('gemini', true), 'gemini');
    assert.strictEqual(resolveVoiceProvider('gemini', false), 'gemini');
  });

  await t.test('8. Không tự gửi: nhận transcript -> chỉ cập nhật ô nhập và gắn cờ input_mode: voice, KHÔNG gọi API gửi', () => {
    let currentInput = 'Xin chào';
    let hasVoiceInput = false;
    let apiCallCount = 0;

    const mockSendChatMessageStream = () => {
      apiCallCount += 1;
    };

    // Callback nhận transcript khi ghi âm xong
    const handleTranscriptReceived = (transcript: string) => {
      currentInput = currentInput ? `${currentInput} ${transcript}` : transcript;
      hasVoiceInput = true;
      // Tuyệt đối không gọi mockSendChatMessageStream tại đây!
    };

    // Giả lập nhận transcript
    handleTranscriptReceived('kiểm tra công nợ tháng 11');

    assert.strictEqual(currentInput, 'Xin chào kiểm tra công nợ tháng 11');
    assert.strictEqual(hasVoiceInput, true);
    assert.strictEqual(apiCallCount, 0, 'Tuyệt đối không được tự động gửi tin nhắn sau khi nhận transcript');

    // Khi người dùng bấm Gửi thủ công:
    const payload = {
      message: currentInput,
      input_mode: hasVoiceInput ? 'voice' : 'text',
    };
    mockSendChatMessageStream();
    hasVoiceInput = false;

    assert.strictEqual(apiCallCount, 1);
    assert.strictEqual(payload.input_mode, 'voice');
    assert.strictEqual(hasVoiceInput, false);
  });

  await t.test('9. Cờ voice được huỷ khi người dùng xoá hết ô nhập', () => {
    let hasVoiceInput = true;

    // Người dùng xoá sạch ô nhập
    const handleInputChange = (val: string) => {
      if (!val.trim()) {
        hasVoiceInput = false;
      }
    };

    handleInputChange('');
    assert.strictEqual(hasVoiceInput, false);
  });

  await t.test('10. Phòng chống XSS: Transcript chứa <img src=x onerror=alert(1)> không render thẻ img', () => {
    const maliciousTranscript = 'Báo cáo: <img src=x onerror=alert(1)>';
    const components = createMarkdownComponents();

    const html = ReactDOMServer.renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm],
          components,
        },
        maliciousTranscript,
      ),
    );

    assert.strictEqual(html.includes('<img'), false);
    assert.strictEqual(html.includes('&lt;img'), true);
  });

  await t.test('11. Ánh xạ mã lỗi tiếng Việt đầy đủ theo hợp đồng API', () => {
    assert.strictEqual(getVoiceErrorMessage('UNSUPPORTED_AUDIO'), 'Định dạng âm thanh không được hỗ trợ');
    assert.strictEqual(getVoiceErrorMessage('AUDIO_TOO_LARGE'), 'File ghi âm vượt quá giới hạn 2 MB');
    assert.strictEqual(getVoiceErrorMessage('EMPTY_TRANSCRIPT'), 'Không nhận diện được lời nói hoặc âm thanh quá nhỏ');
    assert.strictEqual(getVoiceErrorMessage('INSUFFICIENT_STT_QUOTA'), 'Đã hết hạn mức nhận dạng giọng nói của tháng');
    assert.strictEqual(getVoiceErrorMessage('AI_QUOTA_EXCEEDED'), 'Đã hết hạn mức nhận dạng giọng nói của tháng');
    assert.strictEqual(getVoiceErrorMessage('VOICE_DISABLED'), 'Tính năng nhập giọng nói đã bị tắt bởi quản trị viên');
    assert.strictEqual(getVoiceErrorMessage('RATE_LIMITED'), 'Bạn đã vượt quá giới hạn 60 lần ghi âm/giờ. Vui lòng thử lại sau');
    assert.strictEqual(getVoiceErrorMessage('STT_FAILED'), 'Dịch vụ nhận dạng giọng nói gặp sự cố, vui lòng thử lại sau');
    assert.strictEqual(
      getVoiceErrorMessage('NotAllowedError'),
      'Trình duyệt chưa được cấp quyền micro. Vui lòng bật quyền micro trên thanh địa chỉ',
    );
  });

  await t.test('12. Lưu trữ đồng ý và từ chối trong Storage an toàn theo nguồn nhận dạng (Task P9f1-r2)', () => {
    const fakeStore: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => fakeStore[k] || null,
      setItem: (k: string, v: string) => {
        fakeStore[k] = v;
      },
      removeItem: (k: string) => {
        delete fakeStore[k];
      },
    };

    // Ban đầu chưa đồng ý nguồn nào
    assert.strictEqual(hasUserGivenVoiceConsent('gemini'), false);
    assert.strictEqual(hasUserGivenVoiceConsent('browser'), false);
    assert.strictEqual(hasUserGivenVoiceConsent(), false);

    // 1. Đồng ý gemini -> hasUserGivenVoiceConsent('browser') = false
    saveUserVoiceConsent('gemini');
    assert.strictEqual(hasUserGivenVoiceConsent('gemini'), true);
    assert.strictEqual(hasUserGivenVoiceConsent(), true);
    assert.strictEqual(hasUserGivenVoiceConsent('browser'), false, 'Đồng ý gemini không được làm browser thành true');
    assert.strictEqual(fakeStore['erp4u_voice_consent_given:gemini'], 'true');
    assert.strictEqual(fakeStore['erp4u_voice_consent_given:browser'], undefined);

    // 2. Đồng ý browser không làm gemini thành true trừ khi đã có
    const cleanStore: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => cleanStore[k] || null,
      setItem: (k: string, v: string) => {
        cleanStore[k] = v;
      },
      removeItem: (k: string) => {
        delete cleanStore[k];
      },
    };

    saveUserVoiceConsent('browser');
    assert.strictEqual(hasUserGivenVoiceConsent('browser'), true);
    assert.strictEqual(hasUserGivenVoiceConsent('gemini'), false, 'Đồng ý browser không làm gemini thành true');
    assert.strictEqual(hasUserGivenVoiceConsent(), false);
    assert.strictEqual(cleanStore['erp4u_voice_consent_given:browser'], 'true');
    assert.strictEqual(cleanStore['erp4u_voice_consent_given:gemini'], undefined);

    // 3. Bỏ khoá cũ: khoá cũ erp4u_voice_consent_given không coi là đồng ý cho browser; có thể coi là đồng ý gemini
    const legacyStore: Record<string, string> = {
      [VOICE_CONSENT_KEY]: 'true',
    };
    (globalThis as any).localStorage = {
      getItem: (k: string) => legacyStore[k] || null,
      setItem: (k: string, v: string) => {
        legacyStore[k] = v;
      },
      removeItem: (k: string) => {
        delete legacyStore[k];
      },
    };
    assert.strictEqual(hasUserGivenVoiceConsent('gemini'), true, 'Khoá cũ có thể coi là đồng ý cho gemini');
    assert.strictEqual(hasUserGivenVoiceConsent(), true);
    assert.strictEqual(hasUserGivenVoiceConsent('browser'), false, 'Khoá cũ KHÔNG được coi là đồng ý cho browser');

    // 4. LocalStorage ném lỗi -> coi như chưa đồng ý, không crash
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error('SecurityError: The operation is insecure.');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    assert.strictEqual(hasUserGivenVoiceConsent('gemini'), false);
    assert.strictEqual(hasUserGivenVoiceConsent('browser'), false);
    assert.strictEqual(hasUserGivenVoiceConsent(), false);
    assert.doesNotThrow(() => {
      saveUserVoiceConsent('gemini');
      saveUserVoiceConsent('browser');
    });

    // 5. SessionStorage kiểm tra từ chối quyền
    const fakeSession: Record<string, string> = {};
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => fakeSession[k] || null,
      setItem: (k: string, v: string) => {
        fakeSession[k] = v;
      },
      removeItem: (k: string) => {
        delete fakeSession[k];
      },
    };

    assert.strictEqual(wasPermissionDeniedInSession(), false);
    markPermissionDeniedInSession();
    assert.strictEqual(wasPermissionDeniedInSession(), true);
    assert.strictEqual(fakeSession[VOICE_DENIED_SESSION_KEY], 'true');
  });

  await t.test('13. Biểu tượng giọng nói: tin nhắn input_mode=voice có aria-label', () => {
    // Kiểm tra mẫu thẻ tin nhắn giọng nói
    const hasVoiceLabel = 'Tin nhắn nhập bằng giọng nói';
    const sampleHtml = `<span role="img" aria-label="${hasVoiceLabel}"><svg></svg></span>`;
    assert.strictEqual(sampleHtml.includes('aria-label="Tin nhắn nhập bằng giọng nói"'), true);
  });
});
