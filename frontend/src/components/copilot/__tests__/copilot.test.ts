import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  parseSseBuffer,
  isValidSourcePath,
  isValidMarkdownLink,
  getErrorMessageByCode,
  getSuggestedQuestions,
  createMarkdownComponents,
  StreamCoordinator,
  RequestTracker,
  getApiBaseUrl,
  fetchWithAuth,
} from '../copilotApi.ts';
import { handleUnauthorized } from '../../../utils/authSession.ts';
import type { PackageKey } from '../../../config/packages.ts';

test('Copilot API & UI Unit Tests (Task P9b2 & P9b2-r2)', async (t) => {
  await t.test('SSE parser: xử lý nhiều sự kiện trong cùng 1 chunk', () => {
    const chunk = [
      'event: conversation',
      'data: {"id":"c-123","title":"Đơn hàng tháng 11"}',
      '',
      'event: step',
      'data: {"tool":"sales.orderDetail","label":"Đang tra cứu đơn hàng…"}',
      '',
      'event: answer',
      'data: {"message_id":"m-1","content":"Đơn hàng SO-01 đã được duyệt.","sources":[{"type":"order","id":"1","label":"SO-01","path":"/sales/orders/1"}]}',
      '',
      'event: done',
      'data: {}',
      '',
      '',
    ].join('\n');

    const { events, remaining } = parseSseBuffer(chunk);

    assert.strictEqual(remaining, '');
    assert.strictEqual(events.length, 4);
    assert.strictEqual(events[0].type, 'conversation');
    assert.deepStrictEqual(events[0].data, { id: 'c-123', title: 'Đơn hàng tháng 11' });
    assert.strictEqual(events[1].type, 'step');
    assert.deepStrictEqual(events[1].data, { tool: 'sales.orderDetail', label: 'Đang tra cứu đơn hàng…' });
    assert.strictEqual(events[2].type, 'answer');
    assert.strictEqual(events[2].data.message_id, 'm-1');
    assert.strictEqual(events[3].type, 'done');
  });

  await t.test('SSE parser: sự kiện bị cắt giữa 2 chunk (split chunk stream)', () => {
    const chunk1 = 'event: conversation\ndata: {"id":"c-999","title":"Tồn kho"}\n\nevent: step\ndata: {"tool":"inventory.lowStock","lab';
    const { events: events1, remaining: rem1 } = parseSseBuffer(chunk1);

    assert.strictEqual(events1.length, 1);
    assert.strictEqual(events1[0].type, 'conversation');
    assert.strictEqual(rem1, 'event: step\ndata: {"tool":"inventory.lowStock","lab');

    const chunk2 = 'el":"Đang kiểm tra tồn kho…"}\n\nevent: done\ndata: {}\n\n';
    const { events: events2, remaining: rem2 } = parseSseBuffer(rem1 + chunk2);

    assert.strictEqual(rem2, '');
    assert.strictEqual(events2.length, 2);
    assert.strictEqual(events2[0].type, 'step');
    assert.deepStrictEqual(events2[0].data, {
      tool: 'inventory.lowStock',
      label: 'Đang kiểm tra tồn kho…',
    });
    assert.strictEqual(events2[1].type, 'done');
  });

  await t.test('SSE parser: nhận sự kiện error rồi done', () => {
    const errorChunk = [
      'event: error',
      'data: {"code":"AI_QUOTA_EXCEEDED","message":"Đã hết hạn mức AI của tháng"}',
      '',
      'event: done',
      'data: {}',
      '',
      '',
    ].join('\n');

    const { events, remaining } = parseSseBuffer(errorChunk);

    assert.strictEqual(remaining, '');
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].type, 'error');
    assert.deepStrictEqual(events[0].data, {
      code: 'AI_QUOTA_EXCEEDED',
      message: 'Đã hết hạn mức AI của tháng',
    });
    assert.strictEqual(events[1].type, 'done');
  });

  await t.test('Kiểm tra link nguồn (isValidSourcePath): /sales/orders/1 hợp lệ; //evil.com, https://evil.com, javascript:alert(1) không hợp lệ', () => {
    assert.strictEqual(isValidSourcePath('/sales/orders/1'), true);
    assert.strictEqual(isValidSourcePath('/inventory/materials'), true);
    assert.strictEqual(isValidSourcePath('/customers?id=42'), true);

    assert.strictEqual(isValidSourcePath('//evil.com'), false);
    assert.strictEqual(isValidSourcePath('https://evil.com'), false);
    assert.strictEqual(isValidSourcePath('http://evil.com'), false);
    assert.strictEqual(isValidSourcePath('javascript:alert(1)'), false);
    assert.strictEqual(isValidSourcePath('data:text/html,<script>alert(1)</script>'), false);

    assert.strictEqual(isValidSourcePath(''), false);
    assert.strictEqual(isValidSourcePath('sales/orders/1'), false);
    assert.strictEqual(isValidSourcePath('/sales//orders'), false);
    assert.strictEqual(isValidSourcePath(null), false);
    assert.strictEqual(isValidSourcePath(undefined), false);
  });

  await t.test('Kiểm tra markdown link (isValidMarkdownLink)', () => {
    assert.strictEqual(isValidMarkdownLink('https://example.com/docs'), true);
    assert.strictEqual(isValidMarkdownLink('http://internal.erp/page'), true);
    assert.strictEqual(isValidMarkdownLink('/orders/101'), true);
    assert.strictEqual(isValidMarkdownLink('/dashboard'), true);

    assert.strictEqual(isValidMarkdownLink('//evil.com'), false);
    assert.strictEqual(isValidMarkdownLink('javascript:alert(1)'), false);
    assert.strictEqual(isValidMarkdownLink('file:///etc/passwd'), false);
    assert.strictEqual(isValidMarkdownLink('/orders//evil'), false);
    assert.strictEqual(isValidMarkdownLink(''), false);
  });

  await t.test('Markdown an toàn: nội dung <img src=x onerror=alert(1)> không render thành thẻ img', () => {
    const rawMarkdown = 'Đây là ảnh nguy hiểm: <img src=x onerror=alert(1)> kết thúc.';
    const html = ReactDOMServer.renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm],
        },
        rawMarkdown,
      ),
    );

    assert.strictEqual(html.includes('<img'), false);
    assert.strictEqual(html.includes('&lt;img'), true);
  });

  await t.test('P9b2-r2 [CHẶN]: markdown ![a](https://evil.example/x?d=1) không có thẻ img; link ngoài hiển thị hostname', () => {
    const rawMarkdown = 'Xem ảnh: ![a](https://evil.example/x?d=1) và link: [Báo cáo](https://evil.example/report?token=secret)';
    const components = createMarkdownComponents();
    const html = ReactDOMServer.renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm],
          components,
        },
        rawMarkdown,
      ),
    );

    // Không render thẻ img (phòng chống data exfiltration via image GET request)
    assert.strictEqual(html.includes('<img'), false);
    // Hiển thị dạng chữ [ảnh: a]
    assert.strictEqual(html.includes('[ảnh: a]'), true);
    // Link ngoài hiển thị tên miền kèm nhãn
    assert.strictEqual(html.includes('(evil.example)'), true);
    assert.strictEqual(html.includes('Báo cáo') && html.includes('(evil.example)'), true);
    // Giữ rel="noopener noreferrer" và target="_blank"
    assert.strictEqual(html.includes('rel="noopener noreferrer"'), true);
    assert.strictEqual(html.includes('target="_blank"'), true);
    // Không rò thuộc tính "node" xuống thẻ DOM
    assert.strictEqual(html.includes('node='), false);
  });

  await t.test('P9b2-r2: markdown ảnh không có alt text hiển thị [ảnh] thay vì thẻ img', () => {
    const rawMarkdown = 'Xem ảnh không alt: ![](https://evil.example/x?d=2)';
    const components = createMarkdownComponents();
    const html = ReactDOMServer.renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm],
          components,
        },
        rawMarkdown,
      ),
    );

    assert.strictEqual(html.includes('<img'), false);
    assert.strictEqual(html.includes('[ảnh]'), true);
  });

  await t.test('P9b2-r2 [CHẶN]: StreamCoordinator quản lý huỷ stream & bỏ qua sự kiện của request cũ', () => {
    const coordinator = new StreamCoordinator();
    const session1 = coordinator.startRequest();
    assert.strictEqual(session1.requestId, 1);
    assert.strictEqual(coordinator.isCurrent(session1.requestId), true);
    assert.strictEqual(session1.signal.aborted, false);

    // Bắt đầu request 2 -> request 1 phải bị abort và không còn là current
    const session2 = coordinator.startRequest();
    assert.strictEqual(session1.signal.aborted, true);
    assert.strictEqual(coordinator.isCurrent(session1.requestId), false);
    assert.strictEqual(coordinator.isCurrent(session2.requestId), true);

    // Giả lập sự kiện SSE đến muộn của request 1 -> bị bỏ qua
    const handledEvents: string[] = [];
    const handleEventForReq = (reqId: number, evName: string) => {
      if (!coordinator.isCurrent(reqId)) {
        return; // Bỏ qua sự kiện của request cũ
      }
      handledEvents.push(`${reqId}:${evName}`);
    };

    // Sự kiện request 1 đến muộn
    handleEventForReq(session1.requestId, 'answer');
    // Sự kiện request 2 đến
    handleEventForReq(session2.requestId, 'answer');

    assert.deepStrictEqual(handledEvents, ['2:answer']);

    // Huỷ bỏ thủ công (ví dụ khi đóng panel hoặc unmount)
    coordinator.cancelCurrent();
    assert.strictEqual(session2.signal.aborted, true);
    assert.strictEqual(coordinator.isCurrent(session2.requestId), false);
  });

  await t.test('P9b2-r2 [CHẶN]: RequestTracker xử lý nhấn nhanh 2 hội thoại (race condition)', async () => {
    const tracker = new RequestTracker();
    const req1 = tracker.nextRequestId();
    const req2 = tracker.nextRequestId();

    let appliedConversationId: string | null = null;

    // Giả lập request 1 hoàn thành sau request 2
    const completeReq = (reqId: number, convId: string) => {
      if (tracker.isCurrent(reqId)) {
        appliedConversationId = convId;
      }
    };

    // Request 2 hoàn thành trước
    completeReq(req2, 'conv-2');
    assert.strictEqual(appliedConversationId, 'conv-2');

    // Request 1 đến muộn sau khi req2 đã áp dụng
    completeReq(req1, 'conv-1');
    // Kết quả vẫn phải giữ conv-2, không bị conv-1 ghi đè
    assert.strictEqual(appliedConversationId, 'conv-2');
  });

  await t.test('P9b2-r2: Địa chỉ API getApiBaseUrl dùng đúng base URL và không dùng biến toàn cục __ERP4U_API_URL__', () => {
    // Không đọc biến toàn cục __ERP4U_API_URL__
    (globalThis as any).__ERP4U_API_URL__ = 'http://should-be-ignored:9999/api';
    assert.notStrictEqual(getApiBaseUrl(), 'http://should-be-ignored:9999/api');
    delete (globalThis as any).__ERP4U_API_URL__;

    // Khi truyền tham số overrideUrl (như API_URL từ config.ts)
    assert.strictEqual(getApiBaseUrl('http://localhost:3000/api'), 'http://localhost:3000/api');
    assert.strictEqual(getApiBaseUrl('/api'), '/api');
  });

  await t.test('P9b2-r2: Xử lý 401 xoá token và user khỏi localStorage qua handleUnauthorized', async () => {
    // Thiết lập mock localStorage
    const storage: Record<string, string> = {
      token: 'fake-jwt-token',
      user: JSON.stringify({ id: 1, name: 'Demo' }),
    };
    (globalThis as any).localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; },
    };

    handleUnauthorized();

    assert.strictEqual(storage.token, undefined);
    assert.strictEqual(storage.user, undefined);

    // Mock fetch trả về 401 kiểm tra fetchWithAuth gọi handleUnauthorized
    storage.token = 'new-token';
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });
      const res = await fetchWithAuth('/test-401');
      assert.strictEqual(res.status, 401);
      // token phải bị xoá
      assert.strictEqual(storage.token, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).localStorage;
    }
  });

  await t.test('Thông báo lỗi theo mã hợp đồng (getErrorMessageByCode)', () => {
    assert.strictEqual(
      getErrorMessageByCode('AI_QUOTA_EXCEEDED'),
      'Đã hết hạn mức AI của tháng',
    );
    assert.strictEqual(
      getErrorMessageByCode('AI_NOT_CONFIGURED'),
      'AI chưa được cấu hình, liên hệ quản trị viên',
    );
    assert.strictEqual(
      getErrorMessageByCode('AI_KEY_MISSING'),
      'Chưa cấu hình API key AI, liên hệ quản trị viên',
    );
    assert.strictEqual(
      getErrorMessageByCode('PACKAGE_NOT_ENABLED'),
      'Gói tính năng AI chưa được kích hoạt trên hệ thống',
    );
    assert.strictEqual(
      getErrorMessageByCode('FORBIDDEN'),
      'Bạn không có quyền thực hiện yêu cầu này',
    );
    assert.strictEqual(
      getErrorMessageByCode('INTERNAL'),
      'Lỗi xử lý từ hệ thống AI, vui lòng thử lại sau',
    );
    assert.strictEqual(
      getErrorMessageByCode('UNKNOWN_CODE', 'Lỗi tuỳ biến'),
      'Lỗi tuỳ biến',
    );
  });

  await t.test('Gợi ý câu hỏi khi hội thoại trống theo gói đang bật (getSuggestedQuestions)', () => {
    const enabled1 = (pkg: PackageKey | string) => pkg === 'SALES' || pkg === 'INVENTORY';
    const suggestions1 = getSuggestedQuestions(enabled1);
    assert.strictEqual(suggestions1.length >= 2 && suggestions1.length <= 4, true);
    assert.strictEqual(suggestions1.some((s) => s.includes('Doanh thu')), true);
    assert.strictEqual(suggestions1.some((s) => s.includes('sản phẩm')), true);

    const enabledAll = () => true;
    const suggestionsAll = getSuggestedQuestions(enabledAll);
    assert.strictEqual(suggestionsAll.length, 4);

    const enabledNone = () => false;
    const suggestionsNone = getSuggestedQuestions(enabledNone);
    assert.strictEqual(suggestionsNone.length >= 2, true);
  });
});
