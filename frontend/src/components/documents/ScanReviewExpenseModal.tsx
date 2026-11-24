import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  DatePicker,
  message,
  Space,
  Typography,
  theme,
} from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { ScanReviewLayout } from './ScanReviewLayout';
import { DocumentScanResponse, linkScanDocument } from './documentScanApi';
import {
  transformExpenseInvoiceToTransaction,
  TransformedExpenseTransaction,
  safeString,
} from './documentScanTransformers';

const { Text } = Typography;

export interface ScanReviewExpenseModalProps {
  open: boolean;
  onClose: () => void;
  scan: DocumentScanResponse;
  suppliers?: any[];
  categories?: any[];
  onSuccess?: (createdTransaction: any) => void;
}

export const ScanReviewExpenseModal: React.FC<ScanReviewExpenseModalProps> = ({
  open,
  onClose,
  scan,
  suppliers = [],
  categories = [],
  onSuccess,
}) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);

  const transformed: TransformedExpenseTransaction = useMemo(() => {
    return transformExpenseInvoiceToTransaction(
      scan.extracted,
      scan.suggestions,
      scan.field_confidence,
      scan.warnings,
    );
  }, [scan]);

  useEffect(() => {
    if (open && scan) {
      const init = transformed.initialValues;
      form.setFieldsValue({
        type: 'EXPENSE',
        amount: init.amount || undefined,
        partner_name: init.partner_name || '',
        supplier_id: init.supplier_id || undefined,
        category_id: init.category_id || undefined,
        date: init.date ? dayjs(init.date) : dayjs(),
        reference_code: init.reference_code || '',
        vat_invoice_code: init.vat_invoice_code || '',
        description: init.description || '',
      });
    } else {
      form.resetFields();
    }
  }, [open, scan, transformed, form]);

  const handleSubmit = async (values: any) => {
    const amount = Number(values.amount);
    if (values.amount === undefined || values.amount === null || isNaN(amount) || amount <= 0) {
      message.error('Số tiền chi phải lớn hơn 0');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: 'EXPENSE',
        amount: amount,
        partner_name: safeString(values.partner_name),
        supplier_id: values.supplier_id ? Number(values.supplier_id) : undefined,
        category_id: values.category_id ? Number(values.category_id) : undefined,
        date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        reference_code: safeString(values.reference_code),
        vat_invoice_code: safeString(values.vat_invoice_code),
        description: safeString(values.description),
      };

      // 1. Lưu transaction qua API thường
      const res = await api.post('/finance/transactions', payload);
      const createdTx = res.data;
      message.success('Đã lưu phiếu chi thành công!');

      // 2. Liên kết scan với transaction vừa tạo
      if (createdTx?.id) {
        try {
          await linkScanDocument(scan.id, 'transaction', createdTx.id);
        } catch (linkErr: any) {
          message.warning(`Không thể liên kết chứng từ gốc: ${linkErr.message || 'Lỗi mạng'}`);
        }
      }

      onClose();
      if (onSuccess) {
        onSuccess(createdTx);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || 'Lỗi khi lưu giao dịch chi');
    } finally {
      setLoading(false);
    }
  };

  const markedFields = transformed.markedFields;

  const getFieldStyle = (fieldName: string): React.CSSProperties => {
    const mark = markedFields[fieldName];
    if (!mark) return {};
    if (mark.level === 'missing') {
      return { border: `1.5px solid ${token.colorError}`, borderRadius: 6 };
    }
    return { border: `1.5px solid ${token.colorWarning}`, borderRadius: 6 };
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <DollarOutlined style={{ color: token.colorError }} />
          <span>Duyệt Hoá Đơn Chi Phí & Lập Phiếu Chi</span>
        </Space>
      }
      width={1250}
      footer={null}
      destroyOnClose
    >
      <ScanReviewLayout
        scanId={scan.id}
        sourceType={scan.source}
        duplicateWarning={transformed.duplicateWarning}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label="Số tiền chi (VNĐ)"
              name="amount"
              rules={[{ required: true, message: 'Vui lòng nhập số tiền chi' }]}
              help={markedFields['amount']?.message}
              validateStatus={markedFields['amount'] ? (markedFields['amount'].level === 'missing' ? 'error' : 'warning') : undefined}
            >
              <InputNumber
                style={{ width: '100%', fontSize: 16, fontWeight: 700, color: token.colorErrorText, ...getFieldStyle('amount') }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number(v?.replace(/,/g, '') || 0)}
              />
            </Form.Item>

            <Form.Item
              label="Ngày hoá đơn / chứng từ"
              name="date"
              rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
              help={markedFields['date']?.message}
              validateStatus={markedFields['date'] ? 'warning' : undefined}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%', ...getFieldStyle('date') }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label="Đơn vị bán / Đối tác"
              name="partner_name"
              help={markedFields['partner_name']?.message}
              validateStatus={markedFields['partner_name'] ? 'warning' : undefined}
            >
              <Input placeholder="Tên công ty / nhà cung cấp" style={getFieldStyle('partner_name')} />
            </Form.Item>

            <Form.Item label="Nhà cung cấp trong hệ thống" name="supplier_id">
              <Select
                placeholder="Chọn nhà cung cấp (nếu có)"
                allowClear
                showSearch
                optionFilterProp="label"
                options={suppliers.map((s) => ({ label: safeString(s.name), value: s.id }))}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Danh mục chi phí" name="category_id">
              <Select
                placeholder="Chọn danh mục chi phí"
                allowClear
                showSearch
                optionFilterProp="label"
                options={categories.map((c) => ({ label: safeString(c.name), value: c.id }))}
              />
            </Form.Item>

            <Form.Item label="Mã chứng từ liên kết (PO/SO)" name="reference_code">
              <Input placeholder="Mã PO-/SO- liên kết (để trống nếu chi độc lập)" />
            </Form.Item>
          </div>

          <Form.Item label="Ký hiệu & Số HĐ VAT" name="vat_invoice_code">
            <Input placeholder="VD: 1C26TAA-00000123" />
          </Form.Item>

          <Form.Item label="Nội dung diễn giải" name="description" rules={[{ required: true, message: 'Vui lòng nhập diễn giải' }]}>
            <Input.TextArea rows={3} placeholder="Diễn giải nội dung chi phí..." />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Button onClick={onClose} disabled={loading}>
              Bỏ qua
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} danger>
              Lưu Phiếu Chi
            </Button>
          </div>
        </Form>
      </ScanReviewLayout>
    </Modal>
  );
};

export default ScanReviewExpenseModal;
