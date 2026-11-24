/**
 * Hàm thuần chuẩn hoá và xây dựng payload xác nhận nháp AI (Task P9c1-r2)
 *
 * Nguyên tắc:
 * 1. Với các kind dùng modal mới (purchase_order, production_order, email):
 *    Chỉ giữ lại các key backend nhận, loại bỏ hoàn toàn các key thừa
 *    như warehouse_id, tax_rate, notes, priority, note...
 * 2. Với các kind có form sẵn (quotation, task, lead):
 *    Payload khớp chính xác cấu trúc và key mà form tương ứng gửi tới API tạo thường.
 */

/**
 * Xây dựng payload xác nhận nháp Đơn mua hàng (purchase_order).
 * Whitelist: supplier_id, po_code, note, expected_delivery_date, items.
 * Mỗi dòng items: material_id | product_id, description, quantity, unit_price, note.
 * Bỏ: warehouse_id, tax_rate, notes, _display, key, subtotal...
 */
export function buildPurchaseOrderDraftPayload(values: any): Record<string, any> {
  const result: Record<string, any> = {
    supplier_id: Number(values?.supplier_id),
  };

  if (values?.po_code !== undefined && values?.po_code !== null && values?.po_code !== '') {
    result.po_code = String(values.po_code);
  }

  if (values?.note !== undefined && values?.note !== null && values?.note !== '') {
    result.note = String(values.note);
  }

  if (values?.expected_delivery_date) {
    const raw = values.expected_delivery_date;
    if (typeof raw === 'string') {
      result.expected_delivery_date = raw.slice(0, 10);
    } else if (raw && typeof raw.format === 'function') {
      result.expected_delivery_date = raw.format('YYYY-MM-DD');
    } else {
      result.expected_delivery_date = String(raw).slice(0, 10);
    }
  }

  const rawItems = Array.isArray(values?.items) ? values.items : [];
  result.items = rawItems.map((item: any) => {
    const it: Record<string, any> = {
      quantity: Number(item?.quantity) || 0,
      unit_price: Number(item?.unit_price) || 0,
    };
    if (item?.material_id !== undefined && item?.material_id !== null) {
      it.material_id = Number(item.material_id);
    }
    if (item?.product_id !== undefined && item?.product_id !== null) {
      it.product_id = Number(item.product_id);
    }
    if (item?.description !== undefined && item?.description !== null && item?.description !== '') {
      it.description = String(item.description);
    }
    if (item?.note !== undefined && item?.note !== null && item?.note !== '') {
      it.note = String(item.note);
    }
    return it;
  });

  return result;
}

/**
 * Xây dựng payload xác nhận nháp Lệnh sản xuất (production_order).
 * Whitelist: product_id, quantity, code, start_date, due_date, so_code, pfo_id, assigned_supplier_id.
 * Bỏ: priority, note, notes, _display...
 */
export function buildProductionOrderDraftPayload(values: any): Record<string, any> {
  const result: Record<string, any> = {
    product_id: Number(values?.product_id),
    quantity: Number(values?.quantity),
  };

  if (values?.code !== undefined && values?.code !== null && values?.code !== '') {
    result.code = String(values.code);
  }

  let startDate = values?.start_date;
  let dueDate = values?.due_date;
  if (Array.isArray(values?.dateRange)) {
    if (values.dateRange[0]) {
      startDate = typeof values.dateRange[0].toISOString === 'function'
        ? values.dateRange[0].toISOString()
        : String(values.dateRange[0]);
    }
    if (values.dateRange[1]) {
      dueDate = typeof values.dateRange[1].toISOString === 'function'
        ? values.dateRange[1].toISOString()
        : String(values.dateRange[1]);
    }
  }

  if (startDate) {
    result.start_date = typeof startDate?.toISOString === 'function'
      ? startDate.toISOString()
      : String(startDate);
  }
  if (dueDate) {
    result.due_date = typeof dueDate?.toISOString === 'function'
      ? dueDate.toISOString()
      : String(dueDate);
  }

  if (values?.so_code !== undefined && values?.so_code !== null && values?.so_code !== '') {
    result.so_code = String(values.so_code);
  } else if (values?.sales_order_code !== undefined && values?.sales_order_code !== null && values?.sales_order_code !== '') {
    result.so_code = String(values.sales_order_code);
  }

  if (values?.pfo_id !== undefined && values?.pfo_id !== null) {
    result.pfo_id = Number(values.pfo_id);
  }

  if (values?.assigned_supplier_id !== undefined && values?.assigned_supplier_id !== null) {
    result.assigned_supplier_id = Number(values.assigned_supplier_id);
  }

  return result;
}

/**
 * Xây dựng payload gửi email (email).
 * Whitelist: customer_id, to, subject, body.
 */
export function buildEmailDraftPayload(values: any): Record<string, any> {
  return {
    customer_id: Number(values?.customer_id),
    to: String(values?.to || ''),
    subject: String(values?.subject || ''),
    body: String(values?.body || ''),
  };
}

/**
 * Xây dựng payload Báo giá khớp chính xác SalesOrderDetail.tsx (quotation).
 * Nguồn: frontend/src/components/SalesOrderDetail.tsx (handleSave)
 */
export function buildQuotationDraftPayload(
  formValues: Record<string, any>,
  orderItems: any[] = [],
  totalAmount: number = 0,
): Record<string, any> {
  const payload: Record<string, any> = {
    ...formValues,
    order_date: formValues?.order_date
      ? (typeof formValues.order_date.format === 'function'
          ? formValues.order_date.format('YYYY-MM-DD')
          : String(formValues.order_date).slice(0, 10))
      : null,
    delivery_date: formValues?.delivery_date
      ? (typeof formValues.delivery_date.format === 'function'
          ? formValues.delivery_date.format('YYYY-MM-DD')
          : String(formValues.delivery_date).slice(0, 10))
      : null,
    total_amount: totalAmount,
    is_quotation: true,
    items: orderItems.map((i: any) => ({
      sku: i.sku,
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      vat_content: i.vat_content,
      sample_image: i.sample_image,
      image_url: i.image_url,
      total_price: i.total_price !== undefined ? Number(i.total_price) : (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
      price_ranges: i.price_ranges,
      customer_note: i.customer_note,
      internal_note: i.internal_note,
    })),
  };

  return payload;
}

/**
 * Xây dựng payload Công việc khớp chính xác TasksPage.tsx (task).
 * Nguồn: frontend/src/pages/TasksPage.tsx (handleSave)
 */
export function buildTaskDraftPayload(
  formValues: Record<string, any>,
  creatorId?: number,
): Record<string, any> {
  return {
    ...formValues,
    creator_id: creatorId,
    due_date: formValues?.due_date
      ? (typeof formValues.due_date.toISOString === 'function'
          ? formValues.due_date.toISOString()
          : String(formValues.due_date))
      : null,
  };
}

/**
 * Xây dựng payload Khách tiềm năng khớp chính xác CustomersPage.tsx (lead).
 * Nguồn: frontend/src/pages/CustomersPage.tsx (handleSave)
 */
export function buildLeadDraftPayload(formValues: Record<string, any>): Record<string, any> {
  return {
    ...formValues,
    type: 'LEAD',
    credit_limit: formValues?.credit_limit !== undefined ? Number(formValues.credit_limit) : 0,
  };
}
