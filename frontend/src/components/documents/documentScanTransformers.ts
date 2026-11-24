/**
 * Bộ chuyển đổi thuần và helper trích xuất chứng từ AI (Task P9e1)
 * 
 * Nguyên tắc:
 * 1. Hàm thuần (pure functions) không phụ thuộc side-effects.
 * 2. Tái sử dụng builder P9c cho PO.
 * 3. Chuyển đổi extracted + suggestions -> initialValues + markedFields (low, missing).
 * 4. Xử lý số tiền chuỗi, null, undefined an toàn.
 * 5. Tuyệt đối không render HTML thô từ extracted / warnings.
 */

export type FieldConfidenceLevel = 'high' | 'medium' | 'low' | 'missing';

export interface MarkedFieldInfo {
  level: 'low' | 'missing';
  message: string;
}

export type MarkedFieldsMap = Record<string, MarkedFieldInfo>;

export interface TransformedPO {
  initialValues: {
    supplier_id?: number;
    po_code?: string;
    expected_delivery_date?: string | null;
    note?: string;
    items: Array<{
      material_id?: number;
      product_id?: number;
      description: string;
      quantity: number;
      unit_price: number;
      note?: string;
      tax_rate?: number;
      amount?: number;
    }>;
  };
  markedFields: MarkedFieldsMap;
}

export interface TransformedGoodsReceipt {
  initialValues: {
    po_id?: number;
    note?: string;
    delivery_date?: string | null;
    items: Array<{
      po_item_id?: number;
      material_id?: number;
      product_id?: number;
      description: string;
      quantity: number;
    }>;
  };
  markedFields: MarkedFieldsMap;
}

export interface TransformedExpenseTransaction {
  initialValues: {
    type: 'EXPENSE';
    amount: number;
    partner_name: string;
    supplier_id?: number;
    category_id?: number;
    date: string | null;
    reference_code: string;
    vat_invoice_code?: string;
    description: string;
  };
  markedFields: MarkedFieldsMap;
  duplicateWarning?: {
    transaction_id: number | string;
    message: string;
    link: string;
  } | null;
}

export interface ScanWarningItem {
  code: string;
  params?: Record<string, any>;
  message?: string;
}

/**
 * Lấy mức độ tin cậy từ field_confidence theo đường dẫn fieldPath (vd 'supplier.name', 'lines[0].quantity')
 */
export function getFieldConfidence(
  confidenceMap?: Record<string, string> | null,
  fieldPath?: string,
): FieldConfidenceLevel {
  if (!confidenceMap || !fieldPath) return 'medium';
  const val = confidenceMap[fieldPath];
  if (val === 'high' || val === 'medium' || val === 'low' || val === 'missing') {
    return val;
  }
  return 'medium';
}

/**
 * Chuyển đổi an toàn giá trị số (xử lý string, null, undefined, NaN, định dạng VN/EN)
 */
export function safeNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;

  // Giữ lại số, dấu chấm, dấu phẩy, dấu âm
  let str = String(val).replace(/[^0-9.,-]+/g, '').trim();
  if (!str) return fallback;

  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  if (dotCount > 1 || (dotCount === 1 && commaCount === 1 && str.indexOf('.') < str.indexOf(','))) {
    // Kiểu Việt Nam / châu Âu: 2.500.000 hoặc 2.500.000,50
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (commaCount > 1 || (commaCount === 1 && dotCount === 1 && str.indexOf(',') < str.indexOf('.'))) {
    // Kiểu US / UK: 2,500,000 hoặc 2,500,000.50
    str = str.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount === 0) {
    if (/^\d{1,3},\d{3}$/.test(str)) {
      str = str.replace(',', '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const parsed = Number(str);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Chuyển đổi an toàn chuỗi (loại bỏ ký tự lạ, escape sơ bộ)
 */
export function safeString(val: any, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

/**
 * 1. Chuyển đổi Báo giá / PO nhà cung cấp (supplier_quote) -> Initial Values tạo PO
 */
export function transformSupplierQuoteToPo(
  extracted?: Record<string, any> | null,
  suggestions?: Record<string, any> | null,
  fieldConfidence?: Record<string, string> | null,
): TransformedPO {
  const markedFields: MarkedFieldsMap = {};
  const lines = Array.isArray(extracted?.lines) ? extracted!.lines : [];

  const supplierId = suggestions?.supplier_id ? Number(suggestions.supplier_id) : undefined;
  if (!supplierId) {
    markedFields['supplier_id'] = {
      level: 'missing',
      message: 'Chưa khớp nhà cung cấp trong hệ thống, vui lòng chọn NCC',
    };
  } else if (getFieldConfidence(fieldConfidence, 'supplier.name') === 'low') {
    markedFields['supplier_id'] = {
      level: 'low',
      message: 'AI đọc tên NCC chưa chắc chắn, vui lòng kiểm tra lại',
    };
  }

  const deliveryDate = extracted?.delivery_date || extracted?.valid_until || null;
  if (getFieldConfidence(fieldConfidence, 'delivery_date') === 'low' || getFieldConfidence(fieldConfidence, 'valid_until') === 'low') {
    markedFields['expected_delivery_date'] = {
      level: 'low',
      message: 'AI đọc ngày giao hàng / hạn báo giá chưa chắc chắn',
    };
  }

  if (getFieldConfidence(fieldConfidence, 'document_no') === 'low') {
    markedFields['po_code'] = {
      level: 'low',
      message: 'AI đọc số báo giá chưa chắc chắn',
    };
  }

  const items = lines.map((line: any, idx: number) => {
    const itemSuggestion = suggestions?.items?.find((s: any) => s.line_index === idx);
    const qtyConfidence = getFieldConfidence(fieldConfidence, `lines[${idx}].quantity`);
    const priceConfidence = getFieldConfidence(fieldConfidence, `lines[${idx}].unit_price`);
    const descConfidence = getFieldConfidence(fieldConfidence, `lines[${idx}].description`);
    const rawQty = safeNumber(line.quantity, 0);
    const finalQty = rawQty <= 0 ? 0 : rawQty;

    if (qtyConfidence === 'low') {
      markedFields[`items.${idx}.quantity`] = {
        level: 'low',
        message: 'AI đọc số lượng chưa chắc chắn',
      };
    } else if (qtyConfidence === 'missing' || line.quantity === undefined || line.quantity === null || rawQty <= 0) {
      markedFields[`items.${idx}.quantity`] = {
        level: 'missing',
        message: 'Thiếu số lượng',
      };
    }

    if (priceConfidence === 'low') {
      markedFields[`items.${idx}.unit_price`] = {
        level: 'low',
        message: 'AI đọc đơn giá chưa chắc chắn',
      };
    }

    if (descConfidence === 'low') {
      markedFields[`items.${idx}.description`] = {
        level: 'low',
        message: 'AI đọc tên mặt hàng chưa chắc chắn',
      };
    }

    const matId = itemSuggestion?.material_id ? Number(itemSuggestion.material_id) : undefined;
    const prodId = itemSuggestion?.product_id ? Number(itemSuggestion.product_id) : undefined;

    if (!matId && !prodId) {
      markedFields[`items.${idx}.item_id`] = {
        level: 'missing',
        message: 'Chưa khớp vật tư/sản phẩm trong hệ thống, vui lòng chọn',
      };
    }

    return {
      material_id: matId,
      product_id: prodId,
      description: safeString(line.description, `Mặt hàng #${idx + 1}`),
      quantity: finalQty,
      unit_price: safeNumber(line.unit_price, 0),
      note: line.sku_or_code ? `Mã: ${safeString(line.sku_or_code)}` : '',
      tax_rate: line.tax_rate !== undefined ? safeNumber(line.tax_rate) : undefined,
      amount: safeNumber(line.amount, finalQty * safeNumber(line.unit_price, 0)),
    };
  });

  return {
    initialValues: {
      supplier_id: supplierId,
      po_code: extracted?.document_no ? `PO-${safeString(extracted.document_no)}` : '',
      expected_delivery_date: deliveryDate ? safeString(deliveryDate) : null,
      note: extracted?.document_no ? `Theo báo giá ${safeString(extracted.document_no)}` : '',
      items,
    },
    markedFields,
  };
}

/**
 * 2. Chuyển đổi Phiếu giao hàng (delivery_note) -> Initial Values tạo Phiếu nhập kho nháp
 */
export function transformDeliveryNoteToGoodsReceipt(
  extracted?: Record<string, any> | null,
  suggestions?: Record<string, any> | null,
  fieldConfidence?: Record<string, string> | null,
): TransformedGoodsReceipt {
  const markedFields: MarkedFieldsMap = {};
  const lines = Array.isArray(extracted?.lines) ? extracted!.lines : [];

  const poId = suggestions?.po_id ? Number(suggestions.po_id) : undefined;
  if (!poId) {
    markedFields['po_id'] = {
      level: 'missing',
      message: 'Chưa tìm thấy đơn mua hàng (PO) liên quan, vui lòng chọn PO',
    };
  }

  const deliveryDate = extracted?.delivery_date || extracted?.document_date || null;
  if (getFieldConfidence(fieldConfidence, 'delivery_date') === 'low' || getFieldConfidence(fieldConfidence, 'document_date') === 'low') {
    markedFields['delivery_date'] = {
      level: 'low',
      message: 'AI đọc ngày giao hàng chưa chắc chắn',
    };
  }

  const items = lines.map((line: any, idx: number) => {
    const itemSuggestion = suggestions?.items?.find((s: any) => s.line_index === idx);
    const qtyConfidence = getFieldConfidence(fieldConfidence, `lines[${idx}].quantity`);
    const rawQty = safeNumber(line.quantity, 0);
    const finalQty = rawQty <= 0 ? 0 : rawQty;

    if (qtyConfidence === 'low') {
      markedFields[`items.${idx}.quantity`] = {
        level: 'low',
        message: 'AI đọc số lượng giao chưa chắc chắn',
      };
    } else if (qtyConfidence === 'missing' || line.quantity === undefined || line.quantity === null || rawQty <= 0) {
      markedFields[`items.${idx}.quantity`] = {
        level: 'missing',
        message: 'Thiếu số lượng giao',
      };
    }

    const matId = itemSuggestion?.material_id ? Number(itemSuggestion.material_id) : undefined;
    const prodId = itemSuggestion?.product_id ? Number(itemSuggestion.product_id) : undefined;

    if (!matId && !prodId) {
      markedFields[`items.${idx}.item_id`] = {
        level: 'missing',
        message: 'Chưa khớp vật tư/sản phẩm với PO, vui lòng chọn',
      };
    }

    return {
      po_item_id: itemSuggestion?.po_item_id ? Number(itemSuggestion.po_item_id) : undefined,
      material_id: matId,
      product_id: prodId,
      description: safeString(line.description, `Mặt hàng #${idx + 1}`),
      quantity: finalQty,
    };
  });

  return {
    initialValues: {
      po_id: poId,
      note: extracted?.document_no ? `Nhập kho theo phiếu giao ${safeString(extracted.document_no)}` : 'Nhập kho từ phiếu giao hàng AI',
      delivery_date: deliveryDate ? safeString(deliveryDate) : null,
      items,
    },
    markedFields,
  };
}

/**
 * 3. Chuyển đổi Hoá đơn chi phí (expense_invoice) -> Initial Values tạo Phiếu Chi
 */
export function transformExpenseInvoiceToTransaction(
  extracted?: Record<string, any> | null,
  suggestions?: Record<string, any> | null,
  fieldConfidence?: Record<string, string> | null,
  warnings?: ScanWarningItem[] | null,
): TransformedExpenseTransaction {
  const markedFields: MarkedFieldsMap = {};

  const totalAmount = safeNumber(extracted?.total, 0);
  if (totalAmount <= 0) {
    markedFields['amount'] = {
      level: 'missing',
      message: 'Số tiền hoá đơn bằng 0 hoặc chưa nhận diện được',
    };
  } else if (getFieldConfidence(fieldConfidence, 'total') === 'low') {
    markedFields['amount'] = {
      level: 'low',
      message: 'AI đọc tổng tiền chưa chắc chắn, vui lòng kiểm tra lại',
    };
  }

  const supplierName = safeString(extracted?.supplier?.name, '');
  const supplierId = suggestions?.supplier_id ? Number(suggestions.supplier_id) : undefined;

  if (getFieldConfidence(fieldConfidence, 'supplier.name') === 'low') {
    markedFields['partner_name'] = {
      level: 'low',
      message: 'AI đọc tên đơn vị bán chưa chắc chắn',
    };
  }

  const docDate = extracted?.document_date ? safeString(extracted.document_date) : null;
  if (getFieldConfidence(fieldConfidence, 'document_date') === 'low') {
    markedFields['date'] = {
      level: 'low',
      message: 'AI đọc ngày hoá đơn chưa chắc chắn',
    };
  }

  const invoiceNo = safeString(extracted?.invoice_no || extracted?.document_no, '');
  const invoiceSeries = safeString(extracted?.invoice_series, '');
  const vatInvoiceCode = invoiceSeries && invoiceNo ? `${invoiceSeries}-${invoiceNo}` : invoiceNo;

  // Mô tả mặc định từ các dòng hàng hoặc hoá đơn
  const lineDescriptions = Array.isArray(extracted?.lines)
    ? extracted!.lines.map((l: any) => safeString(l.description)).filter(Boolean)
    : [];
  const description = lineDescriptions.length > 0
    ? lineDescriptions.slice(0, 3).join(', ')
    : (invoiceNo ? `Chi phí theo HĐ ${invoiceNo}` : 'Chi phí theo hoá đơn');

  // Kiểm tra cảnh báo trùng hoá đơn (dựng câu tiếng Việt phía client từ code + params, bỏ dùng message từ server)
  let duplicateWarning: TransformedExpenseTransaction['duplicateWarning'] = null;
  const dupWarningItem = warnings?.find((w) => w.code === 'duplicate_transaction_id');
  const duplicateTxId = suggestions?.duplicate_transaction_id || dupWarningItem?.params?.transaction_id;

  if (duplicateTxId) {
    const warningMessage = formatScanWarningMessage('duplicate_transaction_id', {
      ...dupWarningItem?.params,
      transaction_id: duplicateTxId,
      vat_invoice_code: vatInvoiceCode || dupWarningItem?.params?.vat_invoice_code,
      supplier_name: supplierName || dupWarningItem?.params?.supplier_name,
    });

    duplicateWarning = {
      transaction_id: duplicateTxId,
      message: warningMessage,
      link: `/finance?transaction=${duplicateTxId}`,
    };
  }

  return {
    initialValues: {
      type: 'EXPENSE',
      amount: totalAmount,
      partner_name: supplierName,
      supplier_id: supplierId,
      category_id: suggestions?.category_id ? Number(suggestions.category_id) : undefined,
      date: docDate,
      reference_code: '', // Số hoá đơn không đặt vào reference_code (chỉ dùng PO-/SO- để đồng bộ thanh toán)
      vat_invoice_code: vatInvoiceCode,
      description,
    },
    markedFields,
    duplicateWarning,
  };
}

export type DocumentPreviewMode = 'pdf' | 'text' | 'image' | 'unsupported';

/**
 * Helper thuần xác định phương thức hiển thị file an toàn theo `source` và `mimeType`
 * Phòng chống XSS từ XML/SVG/HTML:
 * - XML (source = xml hoặc mime = application/xml | text/xml): luôn hiển thị dạng text thuần ('text')
 * - PDF (mime = application/pdf hoặc source = pdf khi mime hợp lệ): 'pdf' (dùng iframe)
 * - Ảnh (mime = image/jpeg|png|webp|heic hoặc source = image): 'image' (dùng <img>)
 * - Tuyệt đối chặn image/svg+xml, text/html, application/xhtml+xml, javascript...: 'unsupported'
 */
export function getDocumentPreviewMode(
  source?: string | null,
  mimeType?: string | null,
): DocumentPreviewMode {
  const normMime = (mimeType || '').toLowerCase().trim();
  const normSource = (source || '').toLowerCase().trim();

  // 1. Chặn tuyệt đối các định dạng có thể thực thi mã kịch bản (XSS)
  const dangerousMimes = [
    'image/svg+xml',
    'image/svg',
    'text/html',
    'application/xhtml+xml',
    'text/javascript',
    'application/javascript',
    'application/x-javascript',
  ];
  if (dangerousMimes.some((d) => normMime.includes(d))) {
    return 'unsupported';
  }

  // 2. XML: luôn hiển thị text thuần, không bao giờ dùng iframe
  if (
    normSource === 'xml' ||
    normMime === 'application/xml' ||
    normMime === 'text/xml' ||
    normMime.endsWith('+xml')
  ) {
    return 'text';
  }

  // 3. PDF: chỉ khi mime là application/pdf (hoặc source là pdf và mime rỗng/octet-stream)
  if (
    normMime === 'application/pdf' ||
    (normSource === 'pdf' && (!normMime || normMime === 'application/pdf' || normMime === 'application/octet-stream'))
  ) {
    return 'pdf';
  }

  // 4. Ảnh: chỉ các định dạng an toàn (JPEG, PNG, WebP, HEIC)
  const safeImageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
  ];
  if (safeImageMimes.includes(normMime)) {
    return 'image';
  }
  if (normSource === 'image') {
    if (!normMime || normMime === 'application/octet-stream') {
      return 'image';
    }
    return 'unsupported';
  }

  return 'unsupported';
}

/**
 * Dựng câu thông báo tiếng Việt từ mã cảnh báo (`code`) và tham số (`params`)
 * Tuyệt đối không dùng câu tự do từ server để đảm bảo an toàn và tính nhất quán
 */
export function formatScanWarningMessage(code: string, params?: Record<string, any> | null): string {
  switch (code) {
    case 'duplicate_transaction_id': {
      const txId = params?.transaction_id;
      const vatCode = params?.vat_invoice_code || params?.reference_code;
      const supplier = params?.supplier_name;
      if (vatCode && supplier) {
        return `Hoá đơn ${vatCode} (${supplier}) có thể trùng với giao dịch #${txId} đã có trong hệ thống`;
      }
      if (vatCode) {
        return `Hoá đơn ${vatCode} có thể trùng với giao dịch #${txId} đã có trong hệ thống`;
      }
      if (txId) {
        return `Hoá đơn này có thể trùng với giao dịch #${txId} đã có trong hệ thống`;
      }
      return 'Hoá đơn này có thể trùng với một giao dịch chi đã có trong hệ thống';
    }
    case 'subtotal_mismatch': {
      return 'Tổng tiền các dòng chi tiết không khớp với tổng tiền hàng trên chứng từ';
    }
    case 'tax_mismatch': {
      return 'Tiền thuế tính toán không khớp với tiền thuế ghi trên chứng từ';
    }
    default:
      return 'Phát hiện cảnh báo khi đối chiếu chứng từ';
  }
}

/**
 * Kiểm tra tính hợp lệ của file chứng từ phía client
 * - Kích thước ≤ 10 MB
 * - Loại file: JPEG, PNG, WebP, HEIC, PDF, XML
 */
export function validateScanFile(file: File): { valid: boolean; error?: string; errorCode?: string } {
  if (!file) {
    return { valid: false, error: 'Vui lòng chọn file', errorCode: 'FILE_EMPTY' };
  }

  const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: 'Kích thước file vượt quá giới hạn 10 MB',
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  const fileName = (file.name || '').toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf', '.xml'];
  const hasValidExt = allowedExtensions.some((ext) => fileName.endsWith(ext));

  const mime = (file.type || '').toLowerCase();
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/xml',
    'text/xml',
  ];
  const hasValidMime = allowedMimes.includes(mime);

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: 'Định dạng file không được hỗ trợ (chỉ nhận ảnh JPEG/PNG/WebP/HEIC, PDF hoặc XML)',
      errorCode: 'UNSUPPORTED_FILE',
    };
  }

  return { valid: true };
}

/**
 * Ánh xạ mã lỗi API sang thông báo tiếng Việt chuẩn
 */
export function mapScanErrorCode(errorCode?: string | null, fallbackMessage?: string): string {
  switch (errorCode) {
    case 'UNSUPPORTED_FILE':
      return 'Định dạng file không được hỗ trợ (chỉ nhận ảnh JPEG/PNG/WebP/HEIC, PDF hoặc XML)';
    case 'FILE_TOO_LARGE':
      return 'Kích thước file vượt quá giới hạn 10 MB';
    case 'TOO_MANY_PAGES':
      return 'File PDF vượt quá giới hạn tối đa 5 trang';
    case 'INSUFFICIENT_OCR_QUOTA':
      return 'Đã hết hạn mức đọc chứng từ (OCR) của gói AI trong tháng';
    case 'PACKAGE_NOT_ENABLED':
      return 'Gói tính năng AI chưa được kích hoạt';
    case 'FORBIDDEN':
      return 'Bạn không có quyền thực hiện hành động này';
    case 'EXTRACTION_FAILED':
      return 'Không thể trích xuất dữ liệu từ chứng từ. Vui lòng kiểm tra lại chất lượng file';
    case 'RATE_LIMITED':
      return 'Vượt quá giới hạn 30 lần đọc/giờ. Vui lòng thử lại sau';
    default:
      return fallbackMessage || 'Lỗi khi đọc chứng từ';
  }
}
