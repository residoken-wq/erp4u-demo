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
import {
  buildPurchaseOrderDraftPayload,
  buildProductionOrderDraftPayload,
  buildEmailDraftPayload,
  buildQuotationDraftPayload,
  buildTaskDraftPayload,
  buildLeadDraftPayload,
} from '../draftPayloads.ts';
import { isValidSourcePath } from '../copilotApi.ts';

test('Drafts Pure Functions & Security Unit Tests (Task P9c1 & P9c1-r2)', async (t) => {
  await t.test('1. Map kind -> route (getDraftRoute): trả về route đúng cho 6 loại nháp, kind lạ trả về null', () => {
    assert.strictEqual(getDraftRoute('quotation', 'd-001'), '/sales?aiDraft=d-001');
    assert.strictEqual(getDraftRoute('purchase_order', 'd-002'), '/purchasing?aiDraft=d-002');
    assert.strictEqual(getDraftRoute('production_order', 'd-003'), '/planning?action=create-production-order&aiDraft=d-003');
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

  await t.test('7. Khớp payload Đơn mua hàng (buildPurchaseOrderDraftPayload): chỉ giữ key hợp lệ, bỏ warehouse_id, tax_rate, notes', () => {
    const rawValues = {
      supplier_id: 15,
      po_code: 'PO-2026-009',
      note: 'Giao trong giờ hành chính',
      expected_delivery_date: '2026-12-10T08:00:00.000Z',
      // Các trường thừa / sai bị cấm:
      warehouse_id: 3,
      tax_rate: 10,
      notes: 'Ghi chú cũ không được có',
      extra_field: 'unknown',
      _display: { supplier_name: 'NCC Dệt may 01' },
      items: [
        {
          material_id: 101,
          description: 'Vải Cotton 100%',
          quantity: 500,
          unit_price: 45000,
          note: 'Cuộn 50m',
          // Key thừa trong dòng hàng:
          warehouse_id: 3,
          tax_rate: 8,
          notes: 'notes thừa',
          subtotal: 22500000,
          key: 0,
          _display: { material_name: 'Vải Cotton' },
        },
        {
          product_id: 202,
          description: 'Áo mẫu đối chứng',
          quantity: 2,
          unit_price: 150000,
        },
      ],
    };

    const payload = buildPurchaseOrderDraftPayload(rawValues);

    // 1. Kiểm tra chính xác danh sách key ở root
    const rootKeys = Object.keys(payload).sort();
    assert.deepStrictEqual(rootKeys, ['expected_delivery_date', 'items', 'note', 'po_code', 'supplier_id']);

    // 2. Các key cấm tuyệt đối không tồn tại
    assert.strictEqual(payload.warehouse_id, undefined);
    assert.strictEqual(payload.tax_rate, undefined);
    assert.strictEqual(payload.notes, undefined);
    assert.strictEqual(payload.extra_field, undefined);
    assert.strictEqual(payload._display, undefined);

    // 3. Ngày giao hàng được chuẩn hoá YYYY-MM-DD
    assert.strictEqual(payload.expected_delivery_date, '2026-12-10');
    assert.strictEqual(payload.supplier_id, 15);
    assert.strictEqual(payload.po_code, 'PO-2026-009');
    assert.strictEqual(payload.note, 'Giao trong giờ hành chính');

    // 4. Kiểm tra dòng hàng
    assert.strictEqual(payload.items.length, 2);
    const item0Keys = Object.keys(payload.items[0]).sort();
    assert.deepStrictEqual(item0Keys, ['description', 'material_id', 'note', 'quantity', 'unit_price']);
    assert.strictEqual(payload.items[0].material_id, 101);
    assert.strictEqual(payload.items[0].quantity, 500);
    assert.strictEqual(payload.items[0].unit_price, 45000);
    assert.strictEqual(payload.items[0].description, 'Vải Cotton 100%');
    assert.strictEqual(payload.items[0].note, 'Cuộn 50m');
    assert.strictEqual(payload.items[0].warehouse_id, undefined);
    assert.strictEqual(payload.items[0].tax_rate, undefined);
    assert.strictEqual(payload.items[0].subtotal, undefined);
    assert.strictEqual(payload.items[0]._display, undefined);

    const item1Keys = Object.keys(payload.items[1]).sort();
    assert.deepStrictEqual(item1Keys, ['description', 'product_id', 'quantity', 'unit_price']);
    assert.strictEqual(payload.items[1].product_id, 202);
    assert.strictEqual(payload.items[1].quantity, 2);
    assert.strictEqual(payload.items[1].unit_price, 150000);
  });

  await t.test('8. Khớp payload Lệnh sản xuất (buildProductionOrderDraftPayload): chỉ giữ key backend nhận, bỏ priority, note', () => {
    const rawValues = {
      product_id: 88,
      quantity: 1000,
      code: 'LSX-2026-001',
      start_date: '2026-12-01T00:00:00.000Z',
      due_date: '2026-12-15T00:00:00.000Z',
      so_code: 'SO-2026-050',
      pfo_id: 12,
      assigned_supplier_id: 7,
      // Các trường thừa bị cấm:
      priority: 'HIGH',
      note: 'Ghi chú lệnh sx bị loại bỏ',
      notes: 'Ghi chú notes',
      _display: { product_name: 'Áo sơ mi Oxford' },
    };

    const payload = buildProductionOrderDraftPayload(rawValues);

    // 1. Kiểm tra danh sách key
    const keys = Object.keys(payload).sort();
    assert.deepStrictEqual(keys, [
      'assigned_supplier_id',
      'code',
      'due_date',
      'pfo_id',
      'product_id',
      'quantity',
      'so_code',
      'start_date',
    ]);

    // 2. Không được chứa priority, note, notes
    assert.strictEqual(payload.priority, undefined);
    assert.strictEqual(payload.note, undefined);
    assert.strictEqual(payload.notes, undefined);
    assert.strictEqual(payload._display, undefined);

    // 3. Giá trị đúng
    assert.strictEqual(payload.product_id, 88);
    assert.strictEqual(payload.quantity, 1000);
    assert.strictEqual(payload.code, 'LSX-2026-001');
    assert.strictEqual(payload.pfo_id, 12);
    assert.strictEqual(payload.assigned_supplier_id, 7);
    assert.strictEqual(payload.so_code, 'SO-2026-050');
  });

  await t.test('9. Khớp payload Email (buildEmailDraftPayload): chỉ gồm customer_id, to, subject, body', () => {
    const rawValues = {
      customer_id: 42,
      to: 'buyer@example.com',
      subject: 'Báo giá đơn hàng số SO-100',
      body: 'Kính gửi quý khách,\nXin gửi báo giá đính kèm.',
      _display: { customer_name: 'Khách hàng Demo' },
      extra: 'bỏ qua',
    };

    const payload = buildEmailDraftPayload(rawValues);

    assert.deepStrictEqual(Object.keys(payload).sort(), ['body', 'customer_id', 'subject', 'to']);
    assert.strictEqual(payload.customer_id, 42);
    assert.strictEqual(payload.to, 'buyer@example.com');
    assert.strictEqual(payload.subject, 'Báo giá đơn hàng số SO-100');
    assert.strictEqual(payload.body, 'Kính gửi quý khách,\nXin gửi báo giá đính kèm.');
  });

  await t.test('10. Kiểm tra tính khớp key giữa 3 kind form sẵn và hợp đồng API', () => {
    // A. quotation (SalesOrderDetail.tsx)
    const quotePayload = buildQuotationDraftPayload(
      {
        order_code: 'QUOTE-001',
        customer_id: 10,
        order_date: '2026-11-24',
        delivery_date: '2026-12-01',
        note: 'Đơn báo giá mẫu',
        terms_content: 'Điều khoản thanh toán 50-50',
      },
      [
        {
          sku: 'POLO-BLK-M',
          quantity: 200,
          unit_price: 120000,
          vat_content: 'Áo polo đen M',
        },
      ],
      24000000,
    );
    assert.strictEqual(quotePayload.is_quotation, true);
    assert.strictEqual(quotePayload.customer_id, 10);
    assert.strictEqual(quotePayload.total_amount, 24000000);
    assert.strictEqual(quotePayload.items[0].sku, 'POLO-BLK-M');
    assert.strictEqual(quotePayload.items[0].quantity, 200);
    assert.strictEqual(quotePayload.items[0].unit_price, 120000);

    // B. task (TasksPage.tsx)
    const taskPayload = buildTaskDraftPayload(
      {
        title: 'Kiểm tra tồn kho đầu tháng',
        description: 'Kiểm kê kho vải và phụ liệu',
        priority: 'HIGH',
        status: 'TODO',
        assignee_id: 5,
        due_date: '2026-12-01T17:00:00.000Z',
      },
      1,
    );
    assert.strictEqual(taskPayload.title, 'Kiểm tra tồn kho đầu tháng');
    assert.strictEqual(taskPayload.assignee_id, 5);
    assert.strictEqual(taskPayload.creator_id, 1);
    assert.strictEqual(taskPayload.priority, 'HIGH');
    assert.strictEqual(taskPayload.status, 'TODO');

    // C. lead (CustomersPage.tsx)
    const leadPayload = buildLeadDraftPayload({
      name: 'Công ty May mặc Demo',
      phone: '0900000001',
      email: 'contact@example.com',
      tax_code: '0101234567',
      address: 'Số 1 Đường Demo, Hà Nội',
    });
    assert.strictEqual(leadPayload.name, 'Công ty May mặc Demo');
    assert.strictEqual(leadPayload.type, 'LEAD');
    assert.strictEqual(leadPayload.tax_code, '0101234567');
    assert.strictEqual(leadPayload.credit_limit, 0);
  });
});
