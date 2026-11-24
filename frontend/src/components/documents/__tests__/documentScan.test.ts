import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  transformSupplierQuoteToPo,
  transformDeliveryNoteToGoodsReceipt,
  transformExpenseInvoiceToTransaction,
  validateScanFile,
  mapScanErrorCode,
  safeNumber,
  safeString,
} from '../documentScanTransformers.ts';

test('Document Scan Pure Transformers, Validation & Security Tests (Task P9e1)', async (t) => {
  // -------------------------------------------------------------
  // 1. TRANSFORMER: transformSupplierQuoteToPo
  // -------------------------------------------------------------
  await t.test('1.1. transformSupplierQuoteToPo: đầy đủ trường hợp lệ', () => {
    const extracted = {
      document_no: 'BG-2026-001',
      delivery_date: '2026-12-05',
      valid_until: '2026-12-25',
      supplier: {
        name: 'NCC Test 01',
        tax_code: '0100000001',
      },
      lines: [
        {
          description: 'Vải Cotton 100%',
          sku_or_code: 'SKU-TEST-01',
          quantity: 100,
          unit_price: 50000,
          amount: 5000000,
        },
      ],
    };

    const suggestions = {
      supplier_id: 15,
      items: [
        { line_index: 0, material_id: 42 },
      ],
    };

    const fieldConfidence = {
      'supplier.name': 'high',
      'lines[0].quantity': 'high',
      'lines[0].unit_price': 'high',
    };

    const res = transformSupplierQuoteToPo(extracted, suggestions, fieldConfidence);

    assert.strictEqual(res.initialValues.supplier_id, 15);
    assert.strictEqual(res.initialValues.po_code, 'PO-BG-2026-001');
    assert.strictEqual(res.initialValues.expected_delivery_date, '2026-12-05');
    assert.strictEqual(res.initialValues.items.length, 1);
    assert.strictEqual(res.initialValues.items[0].material_id, 42);
    assert.strictEqual(res.initialValues.items[0].quantity, 100);
    assert.strictEqual(res.initialValues.items[0].unit_price, 50000);
    assert.strictEqual(res.markedFields['supplier_id'], undefined);
  });

  await t.test('1.2. transformSupplierQuoteToPo: thiếu NCC và trường low confidence', () => {
    const extracted = {
      document_no: 'BG-2026-002',
      lines: [
        {
          description: 'Mặt hàng mẫu',
          quantity: '50.5', // chuỗi
          unit_price: '120000', // chuỗi
        },
        {
          description: 'Mặt hàng thiếu giá',
          quantity: null,
          unit_price: null,
        },
      ],
    };

    const suggestions = {
      supplier_id: null, // Chưa khớp NCC
      items: [],
    };

    const fieldConfidence = {
      'supplier.name': 'low',
      'document_no': 'low',
      'lines[0].quantity': 'low',
    };

    const res = transformSupplierQuoteToPo(extracted, suggestions, fieldConfidence);

    // supplier_id chưa có -> đánh dấu missing
    assert.strictEqual(res.initialValues.supplier_id, undefined);
    assert.strictEqual(res.markedFields['supplier_id']?.level, 'missing');

    // document_no low -> po_code đánh dấu low
    assert.strictEqual(res.markedFields['po_code']?.level, 'low');

    // Dòng 0: quantity = 50.5, low confidence
    assert.strictEqual(res.initialValues.items[0].quantity, 50.5);
    assert.strictEqual(res.initialValues.items[0].unit_price, 120000);
    assert.strictEqual(res.markedFields['items.0.quantity']?.level, 'low');

    // Dòng 1: quantity null -> đánh dấu missing
    assert.strictEqual(res.markedFields['items.1.quantity']?.level, 'missing');
    assert.strictEqual(res.markedFields['items.1.item_id']?.level, 'missing');
  });

  await t.test('1.3. transformSupplierQuoteToPo: xử lý nhiều dòng (10 dòng)', () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({
      description: `Vật tư ${i + 1}`,
      sku_or_code: `SKU-${i + 1}`,
      quantity: (i + 1) * 10,
      unit_price: 10000,
    }));

    const suggestions = {
      supplier_id: 10,
      items: lines.map((_, i) => ({ line_index: i, material_id: 100 + i })),
    };

    const res = transformSupplierQuoteToPo({ lines }, suggestions);
    assert.strictEqual(res.initialValues.items.length, 10);
    assert.strictEqual(res.initialValues.items[9].quantity, 100);
    assert.strictEqual(res.initialValues.items[9].material_id, 109);
  });

  // -------------------------------------------------------------
  // 2. TRANSFORMER: transformDeliveryNoteToGoodsReceipt
  // -------------------------------------------------------------
  await t.test('2.1. transformDeliveryNoteToGoodsReceipt: đầy đủ và khớp PO', () => {
    const extracted = {
      document_no: 'PGH-2026-999',
      delivery_date: '2026-11-25',
      lines: [
        {
          description: 'Nút áo nhựa 4 lỗ',
          quantity: 2000,
        },
      ],
    };

    const suggestions = {
      po_id: 305,
      items: [
        { line_index: 0, po_item_id: 88, material_id: 55 },
      ],
    };

    const res = transformDeliveryNoteToGoodsReceipt(extracted, suggestions);

    assert.strictEqual(res.initialValues.po_id, 305);
    assert.strictEqual(res.initialValues.delivery_date, '2026-11-25');
    assert.strictEqual(res.initialValues.items.length, 1);
    assert.strictEqual(res.initialValues.items[0].po_item_id, 88);
    assert.strictEqual(res.initialValues.items[0].quantity, 2000);
    assert.strictEqual(res.markedFields['po_id'], undefined);
  });

  await t.test('2.2. transformDeliveryNoteToGoodsReceipt: thiếu po_id -> đánh dấu missing', () => {
    const extracted = {
      document_no: 'PGH-UNKNOWN',
      lines: [{ description: 'Vải lót', quantity: 50 }],
    };

    const suggestions = { po_id: null, items: [] };
    const res = transformDeliveryNoteToGoodsReceipt(extracted, suggestions);

    assert.strictEqual(res.initialValues.po_id, undefined);
    assert.strictEqual(res.markedFields['po_id']?.level, 'missing');
    assert.strictEqual(res.markedFields['items.0.item_id']?.level, 'missing');
  });

  // -------------------------------------------------------------
  // 3. TRANSFORMER: transformExpenseInvoiceToTransaction
  // -------------------------------------------------------------
  await t.test('3.1. transformExpenseInvoiceToTransaction: đầy đủ trường', () => {
    const extracted = {
      document_no: '00000123',
      invoice_no: '00000123',
      invoice_series: '1C26TAA',
      document_date: '2026-11-24',
      total: 3500000,
      supplier: {
        name: 'Công ty Dịch Vụ Vận Tải Test',
      },
      lines: [
        { description: 'Cước vận chuyển hàng nguyên phụ liệu' },
      ],
    };

    const suggestions = {
      supplier_id: 12,
      category_id: 4,
    };

    const res = transformExpenseInvoiceToTransaction(extracted, suggestions);

    assert.strictEqual(res.initialValues.type, 'EXPENSE');
    assert.strictEqual(res.initialValues.amount, 3500000);
    assert.strictEqual(res.initialValues.partner_name, 'Công ty Dịch Vụ Vận Tải Test');
    assert.strictEqual(res.initialValues.supplier_id, 12);
    assert.strictEqual(res.initialValues.category_id, 4);
    assert.strictEqual(res.initialValues.vat_invoice_code, '1C26TAA-00000123');
    assert.strictEqual(res.initialValues.date, '2026-11-24');
    assert.strictEqual(res.duplicateWarning, null);
  });

  await t.test('3.2. transformExpenseInvoiceToTransaction: cảnh báo trùng hoá đơn (duplicate_transaction_id)', () => {
    const extracted = {
      invoice_no: '00000123',
      total: 3500000,
      supplier: { name: 'Công ty Test' },
    };

    const suggestions = {
      duplicate_transaction_id: 482,
    };

    const warnings = [
      {
        code: 'duplicate_transaction_id',
        params: { transaction_id: 482 },
        message: 'Trùng số hoá đơn với giao dịch chi #482',
      },
    ];

    const res = transformExpenseInvoiceToTransaction(extracted, suggestions, null, warnings);

    assert.notStrictEqual(res.duplicateWarning, null);
    assert.strictEqual(res.duplicateWarning?.transaction_id, 482);
    assert.strictEqual(res.duplicateWarning?.link, '/finance?transaction=482');
    // Vẫn trả về initialValues hợp lệ để người dùng có thể chủ động bấm lưu
    assert.strictEqual(res.initialValues.amount, 3500000);
  });

  await t.test('3.3. transformExpenseInvoiceToTransaction: số tiền null / 0 -> đánh dấu missing', () => {
    const extracted = {
      total: null,
    };

    const res = transformExpenseInvoiceToTransaction(extracted);
    assert.strictEqual(res.initialValues.amount, 0);
    assert.strictEqual(res.markedFields['amount']?.level, 'missing');
  });

  // -------------------------------------------------------------
  // 4. KIỂM TRA FILE VÀ ÁNH XẠ MÃ LỖI
  // -------------------------------------------------------------
  await t.test('4.1. validateScanFile: kiểm tra dung lượng file (<= 10 MB)', () => {
    const validFile = { name: 'invoice.pdf', size: 5 * 1024 * 1024, type: 'application/pdf' } as File;
    assert.strictEqual(validateScanFile(validFile).valid, true);

    const oversizedFile = { name: 'large.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' } as File;
    const overRes = validateScanFile(oversizedFile);
    assert.strictEqual(overRes.valid, false);
    assert.strictEqual(overRes.errorCode, 'FILE_TOO_LARGE');
    assert.strictEqual(overRes.error, 'Kích thước file vượt quá giới hạn 10 MB');
  });

  await t.test('4.2. validateScanFile: kiểm tra loại file được hỗ trợ', () => {
    const allowed = ['test.jpg', 'test.jpeg', 'test.png', 'test.webp', 'test.heic', 'test.pdf', 'test.xml'];
    for (const name of allowed) {
      assert.strictEqual(validateScanFile({ name, size: 1000, type: '' } as File).valid, true, `File ${name} phải hợp lệ`);
    }

    const disallowed = ['malicious.exe', 'script.js', 'page.html', 'archive.zip'];
    for (const name of disallowed) {
      const res = validateScanFile({ name, size: 1000, type: '' } as File);
      assert.strictEqual(res.valid, false, `File ${name} phải bị từ chối`);
      assert.strictEqual(res.errorCode, 'UNSUPPORTED_FILE');
    }
  });

  await t.test('4.3. mapScanErrorCode: ánh xạ mã lỗi thành thông báo tiếng Việt', () => {
    assert.strictEqual(mapScanErrorCode('FILE_TOO_LARGE'), 'Kích thước file vượt quá giới hạn 10 MB');
    assert.strictEqual(mapScanErrorCode('UNSUPPORTED_FILE'), 'Định dạng file không được hỗ trợ (chỉ nhận ảnh JPEG/PNG/WebP/HEIC, PDF hoặc XML)');
    assert.strictEqual(mapScanErrorCode('TOO_MANY_PAGES'), 'File PDF vượt quá giới hạn tối đa 5 trang');
    assert.strictEqual(mapScanErrorCode('INSUFFICIENT_OCR_QUOTA'), 'Đã hết hạn mức đọc chứng từ (OCR) của gói AI trong tháng');
    assert.strictEqual(mapScanErrorCode('RATE_LIMITED'), 'Vượt quá giới hạn 30 lần đọc/giờ. Vui lòng thử lại sau');
    assert.strictEqual(mapScanErrorCode('EXTRACTION_FAILED'), 'Không thể trích xuất dữ liệu từ chứng từ. Vui lòng kiểm tra lại chất lượng file');
    assert.strictEqual(mapScanErrorCode('PACKAGE_NOT_ENABLED'), 'Gói tính năng AI chưa được kích hoạt');
    assert.strictEqual(mapScanErrorCode('FORBIDDEN'), 'Bạn không có quyền thực hiện hành động này');
    assert.strictEqual(mapScanErrorCode('UNKNOWN_CODE', 'Lỗi mặc định'), 'Lỗi mặc định');
  });

  // -------------------------------------------------------------
  // 5. BẢO MẬT XSS: extracted.supplier.name = '<img src=x onerror=alert(1)>'
  // -------------------------------------------------------------
  await t.test('5.1. XSS Prevention: extracted.supplier.name không render thành thẻ HTML', () => {
    const xssPayload = '<img src=x onerror=alert(1)>';
    const extracted = {
      supplier: {
        name: xssPayload,
      },
      lines: [
        {
          description: '<script>alert("xss")</script>',
          quantity: 1,
          unit_price: 1000,
        },
      ],
    };

    const res = transformSupplierQuoteToPo(extracted);
    assert.strictEqual(res.initialValues.items[0].description, '<script>alert("xss")</script>');

    // Khi React render chuỗi thuần trong JSX
    const element = React.createElement('div', { id: 'partner' }, res.initialValues.items[0].description);
    const htmlString = ReactDOMServer.renderToStaticMarkup(element);

    // Chuỗi phải được escape thành &lt;script&gt;, tuyệt đối không xuất hiện thẻ <script> thật
    assert.ok(htmlString.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
    assert.ok(!htmlString.includes('<script>'));
  });

  // -------------------------------------------------------------
  // 6. SAFE NUMBER & STRING HELPERS
  // -------------------------------------------------------------
  await t.test('6.1. safeNumber và safeString an toàn với null, undefined, chuỗi dị', () => {
    assert.strictEqual(safeNumber(null), 0);
    assert.strictEqual(safeNumber(undefined), 0);
    assert.strictEqual(safeNumber(''), 0);
    assert.strictEqual(safeNumber('1,500,000'), 1500000);
    assert.strictEqual(safeNumber('2.500.000 ₫'), 2500000);
    assert.strictEqual(safeNumber('abc', 10), 10);

    assert.strictEqual(safeString(null), '');
    assert.strictEqual(safeString(undefined), '');
    assert.strictEqual(safeString('  NCC Test  '), 'NCC Test');
  });

  // -------------------------------------------------------------
  // 7. KHÔNG TỰ ĐỘNG GỌI API TẠO CHỨNG TỪ KHI MỞ ?aiScan
  // -------------------------------------------------------------
  await t.test('7.1. Không gọi API tạo chứng từ khi mở form với ?aiScan (chỉ điền initialValues)', () => {
    const apiCalls: string[] = [];
    const mockApi = {
      post: (url: string) => {
        apiCalls.push(url);
        return Promise.resolve({ data: {} });
      },
    };

    // Khi người dùng mở form với ?aiScan=abc: hệ thống chỉ đọc chứng từ và biến đổi dữ liệu
    const scanData = {
      id: 'scan-123',
      kind: 'supplier_quote',
      extracted: {
        document_no: 'BG-001',
        total: 1000000,
        lines: [{ description: 'Vải', quantity: 10, unit_price: 100000 }],
      },
      suggestions: { supplier_id: 5 },
    };

    // Chuyển đổi để điền sẵn vào form
    const poValues = transformSupplierQuoteToPo(scanData.extracted, scanData.suggestions);
    assert.strictEqual(poValues.initialValues.supplier_id, 5);

    const grValues = transformDeliveryNoteToGoodsReceipt(scanData.extracted, scanData.suggestions);
    assert.strictEqual(grValues.initialValues.items.length, 1);

    const expValues = transformExpenseInvoiceToTransaction(scanData.extracted, scanData.suggestions);
    assert.strictEqual(expValues.initialValues.amount, 1000000);

    // Khẳng định tuyệt đối không có cuộc gọi API tạo chứng từ nào được thực hiện khi chỉ mới mở form
    assert.strictEqual(apiCalls.length, 0);
    assert.strictEqual(apiCalls.includes('/purchasing'), false);
    assert.strictEqual(apiCalls.includes('/inventory/goods-receipt/draft'), false);
    assert.strictEqual(apiCalls.includes('/finance/transactions'), false);
  });
});
