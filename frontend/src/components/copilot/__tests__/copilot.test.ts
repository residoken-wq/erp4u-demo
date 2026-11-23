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
} from '../copilotApi.ts';
import type { PackageKey } from '../../../config/packages.ts';

test('Copilot API & UI Unit Tests (Task P9b2)', async (t) => {
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
    // Chunk 1 bị cắt dở giữa chừng event step
    const chunk1 = 'event: conversation\ndata: {"id":"c-999","title":"Tồn kho"}\n\nevent: step\ndata: {"tool":"inventory.lowStock","lab';
    const { events: events1, remaining: rem1 } = parseSseBuffer(chunk1);

    assert.strictEqual(events1.length, 1);
    assert.strictEqual(events1[0].type, 'conversation');
    assert.strictEqual(rem1, 'event: step\ndata: {"tool":"inventory.lowStock","lab');

    // Chunk 2 đến bổ sung phần còn lại
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
    // Hợp lệ
    assert.strictEqual(isValidSourcePath('/sales/orders/1'), true);
    assert.strictEqual(isValidSourcePath('/inventory/materials'), true);
    assert.strictEqual(isValidSourcePath('/customers?id=42'), true);

    // Không hợp lệ: giao thức ngoài / protocol-relative / javascript
    assert.strictEqual(isValidSourcePath('//evil.com'), false);
    assert.strictEqual(isValidSourcePath('https://evil.com'), false);
    assert.strictEqual(isValidSourcePath('http://evil.com'), false);
    assert.strictEqual(isValidSourcePath('javascript:alert(1)'), false);
    assert.strictEqual(isValidSourcePath('data:text/html,<script>alert(1)</script>'), false);

    // Không hợp lệ: rỗng / không bắt đầu bằng '/' / chứa '//'
    assert.strictEqual(isValidSourcePath(''), false);
    assert.strictEqual(isValidSourcePath('sales/orders/1'), false);
    assert.strictEqual(isValidSourcePath('/sales//orders'), false);
    assert.strictEqual(isValidSourcePath(null), false);
    assert.strictEqual(isValidSourcePath(undefined), false);
  });

  await t.test('Kiểm tra markdown link (isValidMarkdownLink)', () => {
    // Hợp lệ: http, https, đường dẫn nội bộ bắt đầu bằng '/'
    assert.strictEqual(isValidMarkdownLink('https://example.com/docs'), true);
    assert.strictEqual(isValidMarkdownLink('http://internal.erp/page'), true);
    assert.strictEqual(isValidMarkdownLink('/orders/101'), true);
    assert.strictEqual(isValidMarkdownLink('/dashboard'), true);

    // Không hợp lệ: protocol-relative, javascript, file
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

    // Tuyệt đối không được chứa thẻ <img
    assert.strictEqual(html.includes('<img'), false);
    // Nội dung phải được escape thành văn bản an toàn
    assert.strictEqual(html.includes('&lt;img'), true);
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
    // Chỉ bật SALES & INVENTORY
    const enabled1 = (pkg: PackageKey | string) => pkg === 'SALES' || pkg === 'INVENTORY';
    const suggestions1 = getSuggestedQuestions(enabled1);
    assert.strictEqual(suggestions1.length >= 2 && suggestions1.length <= 4, true);
    assert.strictEqual(suggestions1.some((s) => s.includes('Doanh thu')), true);
    assert.strictEqual(suggestions1.some((s) => s.includes('sản phẩm')), true);

    // Bật tất cả các gói
    const enabledAll = () => true;
    const suggestionsAll = getSuggestedQuestions(enabledAll);
    assert.strictEqual(suggestionsAll.length, 4);

    // Không bật gói nào
    const enabledNone = () => false;
    const suggestionsNone = getSuggestedQuestions(enabledNone);
    assert.strictEqual(suggestionsNone.length >= 2, true);
  });
});
