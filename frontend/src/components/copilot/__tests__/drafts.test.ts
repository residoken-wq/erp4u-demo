import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  getDraftRoute,
  getDraftKindLabel,
  getDraftStatusInfo,
  stripDisplayFields,
  mapDraftValidationErrors,
} from '../draftRoutes.ts';
import { isValidSourcePath } from '../copilotApi.ts';

test('Drafts Pure Functions & Security Unit Tests (Task P9c1)', async (t) => {
  await t.test('1. Map kind -> route (getDraftRoute): trả về route đúng cho 6 loại nháp, kind lạ trả về null', () => {
    assert.strictEqual(getDraftRoute('quotation', 'd-001'), '/sales?aiDraft=d-001');
    assert.strictEqual(getDraftRoute('purchase_order', 'd-002'), '/purchasing?aiDraft=d-002');
    assert.strictEqual(getDraftRoute('production_order', 'd-003'), '/planning?aiDraft=d-003');
    assert.strictEqual(getDraftRoute('task', 'd-004'), '/tasks?aiDraft=d-004');
    assert.strictEqual(getDraftRoute('lead', 'd-005'), '/customers?aiDraft=d-005');
    assert.strictEqual(getDraftRoute('email', 'd-006'), '/customers?aiDraft=d-006');

    // Kind lạ không có trong bảng cấu hình -> trả về null để thẻ không hiển thị nút mở
    assert.strictEqual(getDraftRoute('unknown_kind', 'd-007'), null);
    assert.strictEqual(getDraftRoute('smart_action', 'd-008'), null);
    assert.strictEqual(getDraftRoute('', 'd-009'), null);
    assert.strictEqual(getDraftRoute(null, 'd-010'), null);
    assert.strictEqual(getDraftRoute('quotation', null), null);
  });

  await t.test('2. Nhãn loại nháp (getDraftKindLabel) & thông tin trạng thái (getDraftStatusInfo)', () => {
    assert.strictEqual(getDraftKindLabel('quotation'), 'Báo giá');
    assert.strictEqual(getDraftKindLabel('purchase_order'), 'Đơn mua hàng');
    assert.strictEqual(getDraftKindLabel('production_order'), 'Lệnh sản xuất');
    assert.strictEqual(getDraftKindLabel('task'), 'Công việc');
    assert.strictEqual(getDraftKindLabel('lead'), 'Khách tiềm năng');
    assert.strictEqual(getDraftKindLabel('email'), 'Email');
    assert.strictEqual(getDraftKindLabel('custom_type'), 'custom_type');

    assert.deepStrictEqual(getDraftStatusInfo('pending'), { label: 'Chờ duyệt', color: 'orange' });
    assert.deepStrictEqual(getDraftStatusInfo('confirmed'), { label: 'Đã tạo', color: 'green' });
    assert.deepStrictEqual(getDraftStatusInfo('rejected'), { label: 'Đã bỏ', color: 'default' });
    assert.deepStrictEqual(getDraftStatusInfo('expired'), { label: 'Hết hạn', color: 'red' });
    assert.deepStrictEqual(getDraftStatusInfo('failed'), { label: 'Lỗi', color: 'red' });
    assert.deepStrictEqual(getDraftStatusInfo('executing'), { label: 'Đang xử lý', color: 'blue' });
  });

  await t.test('3. Lọc trường _display (stripDisplayFields): loại bỏ các key _display trong object lồng nhau và mảng', () => {
    const rawPayload = {
      customer_id: 12,
      note: 'Giao hàng trước 10h',
      _display: {
        customer_name: 'Khách hàng Demo 01',
      },
      items: [
        {
          product_id: 45,
          quantity: 100,
          unit_price: 150000,
          _display: {
            product_name: 'Áo thun Polo thể thao',
            sku: 'POLO-01',
          },
        },
        {
          product_id: 46,
          quantity: 50,
          unit_price: 200000,
          _display: 'dạng chuỗi chỉ hiển thị',
        },
      ],
      extra: {
        meta: 'giữ lại',
        _display_author: 'bị bỏ',
      },
    };

    const cleaned = stripDisplayFields(rawPayload);

    assert.strictEqual(cleaned.customer_id, 12);
    assert.strictEqual(cleaned.note, 'Giao hàng trước 10h');
    assert.strictEqual(cleaned._display, undefined);
    assert.strictEqual(cleaned.items.length, 2);
    assert.strictEqual(cleaned.items[0].product_id, 45);
    assert.strictEqual(cleaned.items[0]._display, undefined);
    assert.strictEqual(cleaned.items[1].product_id, 46);
    assert.strictEqual(cleaned.items[1]._display, undefined);
    assert.strictEqual(cleaned.extra.meta, 'giữ lại');
    assert.strictEqual(cleaned.extra._display_author, undefined);
  });

  await t.test('4. Map lỗi validate DRAFT_INVALID (mapDraftValidationErrors): phân rã items.0.quantity thành mảng đường dẫn cho Antd Form', () => {
    const backendErrors = [
      { field: 'customer_id', message: 'Khách hàng không tồn tại' },
      { field: 'items.0.quantity', message: 'Số lượng phải lớn hơn 0' },
      { field: 'items.2.unit_price', message: 'Đơn giá không được âm' },
    ];

    const { fieldErrors, errorMap } = mapDraftValidationErrors(backendErrors);

    assert.strictEqual(fieldErrors.length, 3);
    assert.deepStrictEqual(fieldErrors[0], {
      name: ['customer_id'],
      errors: ['Khách hàng không tồn tại'],
    });
    assert.deepStrictEqual(fieldErrors[1], {
      name: ['items', 0, 'quantity'],
      errors: ['Số lượng phải lớn hơn 0'],
    });
    assert.deepStrictEqual(fieldErrors[2], {
      name: ['items', 2, 'unit_price'],
      errors: ['Đơn giá không được âm'],
    });

    assert.strictEqual(errorMap['customer_id'], 'Khách hàng không tồn tại');
    assert.strictEqual(errorMap['items.0.quantity'], 'Số lượng phải lớn hơn 0');
    assert.strictEqual(errorMap['items.2.unit_price'], 'Đơn giá không được âm');

    // Thử với null/undefined/rỗng
    const emptyResult = mapDraftValidationErrors(null);
    assert.deepStrictEqual(emptyResult.fieldErrors, []);
    assert.deepStrictEqual(emptyResult.errorMap, {});
  });

  await t.test('5. Kiểm tra an toàn result_ref.path: //evil.com, https://..., javascript: không cho phép tạo link', () => {
    // Hợp lệ (nội bộ, an toàn)
    assert.strictEqual(isValidSourcePath('/orders'), true);
    assert.strictEqual(isValidSourcePath('/purchasing'), true);
    assert.strictEqual(isValidSourcePath('/customers?id=12'), true);

    // Không hợp lệ: link nguy hiểm, chuyển hướng ngoài, XSS
    assert.strictEqual(isValidSourcePath('//evil.com'), false);
    assert.strictEqual(isValidSourcePath('https://evil.com/orders'), false);
    assert.strictEqual(isValidSourcePath('http://evil.com/orders'), false);
    assert.strictEqual(isValidSourcePath('javascript:alert(1)'), false);
    assert.strictEqual(isValidSourcePath('data:text/html,<script>alert(1)</script>'), false);
    assert.strictEqual(isValidSourcePath('/orders//evil'), false);
    assert.strictEqual(isValidSourcePath(''), false);
    assert.strictEqual(isValidSourcePath(null), false);
    assert.strictEqual(isValidSourcePath(undefined), false);
  });

  await t.test('6. Bảo mật Thẻ nháp: summary chứa <img src=x onerror=...> không render thành thẻ img HTML', () => {
    const maliciousSummary = 'Báo giá 10 sản phẩm <img src=x onerror=alert("xss")> kết thúc tóm tắt.';

    // Giả lập render React text node như trong thẻ DraftCard
    const html = ReactDOMServer.renderToString(
      React.createElement(
        'div',
        { className: 'draft-summary' },
        maliciousSummary,
      ),
    );

    // Tuyệt đối không được xuất hiện thẻ <img (đã được React escape an toàn thành &lt;img)
    assert.strictEqual(html.includes('<img'), false);
    assert.strictEqual(html.includes('&lt;img'), true);
    assert.strictEqual(html.includes('alert(&quot;xss&quot;)'), true);
  });
});
