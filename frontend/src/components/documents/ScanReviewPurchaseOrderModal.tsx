import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Button,
  DatePicker,
  message,
  Space,
  Typography,
  Tooltip,
  theme,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { ScanReviewLayout } from './ScanReviewLayout';
import { DocumentScanResponse, linkScanDocument } from './documentScanApi';
import {
  transformSupplierQuoteToPo,
  TransformedPO,
  safeString,
} from './documentScanTransformers';
import { buildPurchaseOrderDraftPayload } from '../copilot/draftPayloads';

const { Text } = Typography;

export interface ScanReviewPurchaseOrderModalProps {
  open: boolean;
  onClose: () => void;
  scan: DocumentScanResponse;
  suppliers: any[];
  onSuccess?: (createdPO: any) => void;
}

export const ScanReviewPurchaseOrderModal: React.FC<ScanReviewPurchaseOrderModalProps> = ({
  open,
  onClose,
  scan,
  suppliers = [],
  onSuccess,
}) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<any[]>([]);

  const transformed: TransformedPO = useMemo(() => {
    return transformSupplierQuoteToPo(scan.extracted, scan.suggestions, scan.field_confidence);
  }, [scan]);

  useEffect(() => {
    if (open && scan) {
      const init = transformed.initialValues;
      form.setFieldsValue({
        po_code: init.po_code || '',
        supplier_id: init.supplier_id || undefined,
        note: init.note || '',
        expected_delivery_date: init.expected_delivery_date ? dayjs(init.expected_delivery_date) : undefined,
      });

      setItems(
        init.items.map((it, idx) => ({
          key: idx,
          material_id: it.material_id,
          product_id: it.product_id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          note: it.note || '',
        })),
      );
    } else {
      form.resetFields();
      setItems([]);
    }
  }, [open, scan, transformed, form]);

  const updateItem = (key: number, field: string, val: any) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, [field]: val } : it)),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: Date.now(),
        description: 'Vật tư / Mặt hàng mới',
        quantity: 1,
        unit_price: 0,
        note: '',
      },
    ]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  }, [items]);

  const handleSubmit = async (values: any) => {
    if (items.length === 0) {
      message.error('Đơn mua hàng phải có ít nhất 1 mặt hàng');
      return;
    }

    // Bắt buộc số lượng > 0 và đơn giá >= 0 cho mọi dòng
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = Number(it.quantity);
      if (it.quantity === undefined || it.quantity === null || isNaN(qty) || qty <= 0) {
        message.error(`Dòng ${i + 1} (${it.description || 'Mặt hàng'}): Số lượng phải lớn hơn 0`);
        return;
      }
      const price = Number(it.unit_price);
      if (it.unit_price === undefined || it.unit_price === null || isNaN(price) || price < 0) {
        message.error(`Dòng ${i + 1} (${it.description || 'Mặt hàng'}): Đơn giá không hợp lệ`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = buildPurchaseOrderDraftPayload({
        ...values,
        items,
      });

      // 1. Tạo PO qua API thường
      const res = await api.post('/purchasing', payload);
      const createdPO = res.data;
      message.success('Đã tạo Đơn mua hàng thành công!');

      // 2. Liên kết bản scan với PO vừa tạo
      if (createdPO?.id) {
        try {
          await linkScanDocument(scan.id, 'purchase_order', createdPO.id);
        } catch (linkErr: any) {
          message.warning(`Không thể liên kết chứng từ gốc: ${linkErr.message || 'Lỗi mạng'}`);
        }
      }

      onClose();
      if (onSuccess) {
        onSuccess(createdPO);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || 'Lỗi khi tạo đơn mua hàng');
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

  const columns = [
    {
      title: 'Mô tả mặt hàng / Vật tư',
      dataIndex: 'description',
      render: (text: string, record: any, idx: number) => {
        const mark = markedFields[`items.${idx}.description`];
        const itemMark = markedFields[`items.${idx}.item_id`];
        const element = (
          <Input
            value={text}
            style={mark ? getFieldStyle(`items.${idx}.description`) : itemMark ? { border: `1px dashed ${token.colorError}` } : undefined}
            onChange={(e) => updateItem(record.key, 'description', e.target.value)}
          />
        );
        if (mark || itemMark) {
          return (
            <Tooltip title={mark?.message || itemMark?.message}>
              {element}
            </Tooltip>
          );
        }
        return element;
      },
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      width: 120,
      render: (val: number, record: any, idx: number) => {
        const mark = markedFields[`items.${idx}.quantity`];
        const element = (
          <InputNumber
            min={0.01}
            value={val}
            style={{ width: '100%', ...(mark ? getFieldStyle(`items.${idx}.quantity`) : {}) }}
            onChange={(v) => updateItem(record.key, 'quantity', v)}
          />
        );
        if (mark) {
          return <Tooltip title={mark.message}>{element}</Tooltip>;
        }
        return element;
      },
    },
    {
      title: 'Đơn giá (VNĐ)',
      dataIndex: 'unit_price',
      width: 140,
      render: (val: number, record: any, idx: number) => {
        const mark = markedFields[`items.${idx}.unit_price`];
        const element = (
          <InputNumber
            min={0}
            value={val}
            style={{ width: '100%', ...(mark ? getFieldStyle(`items.${idx}.unit_price`) : {}) }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(v) => Number(v?.replace(/,/g, '') || 0)}
            onChange={(v) => updateItem(record.key, 'unit_price', v)}
          />
        );
        if (mark) {
          return <Tooltip title={mark.message}>{element}</Tooltip>;
        }
        return element;
      },
    },
    {
      title: 'Thành tiền',
      key: 'total',
      width: 130,
      align: 'right' as const,
      render: (_: any, r: any) => (
        <Text strong>
          {((Number(r.quantity) || 0) * (Number(r.unit_price) || 0)).toLocaleString()} ₫
        </Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.key)}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <ShoppingCartOutlined style={{ color: token.colorPrimary }} />
          <span>Duyệt Báo giá & Lập Đơn mua hàng (PO)</span>
        </Space>
      }
      width={1250}
      footer={null}
      destroyOnClose
    >
      <ScanReviewLayout scanId={scan.id} sourceType={scan.source}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Nhà cung cấp"
            name="supplier_id"
            rules={[{ required: true, message: 'Vui lòng chọn nhà cung cấp' }]}
            help={markedFields['supplier_id']?.message}
            validateStatus={markedFields['supplier_id'] ? (markedFields['supplier_id'].level === 'missing' ? 'error' : 'warning') : undefined}
          >
            <Select
              placeholder="Chọn nhà cung cấp"
              showSearch
              optionFilterProp="label"
              style={getFieldStyle('supplier_id')}
              options={suppliers.map((s) => ({ label: safeString(s.name), value: s.id }))}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label="Mã PO"
              name="po_code"
              help={markedFields['po_code']?.message}
              validateStatus={markedFields['po_code'] ? 'warning' : undefined}
            >
              <Input placeholder="Tự sinh nếu để trống" style={getFieldStyle('po_code')} />
            </Form.Item>

            <Form.Item
              label="Ngày dự kiến nhận hàng"
              name="expected_delivery_date"
              help={markedFields['expected_delivery_date']?.message}
              validateStatus={markedFields['expected_delivery_date'] ? 'warning' : undefined}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%', ...getFieldStyle('expected_delivery_date') }} />
            </Form.Item>
          </div>

          <Form.Item label="Ghi chú đơn hàng" name="note">
            <Input.TextArea rows={2} placeholder="Ghi chú mua hàng..." />
          </Form.Item>

          <div style={{ marginTop: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Danh sách mặt hàng ({items.length})</Text>
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addItem}>
              Thêm mặt hàng
            </Button>
          </div>

          <Table
            dataSource={items}
            columns={columns}
            pagination={false}
            size="small"
            rowKey="key"
            style={{ marginBottom: 12 }}
          />

          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <Text type="secondary" style={{ marginRight: 8 }}>Tổng tiền ước tính:</Text>
            <Text strong style={{ fontSize: 18, color: token.colorPrimary }}>
              {totalAmount.toLocaleString()} ₫
            </Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onClose} disabled={loading}>
              Bỏ qua
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}>
              Lưu Đơn Mua Hàng
            </Button>
          </div>
        </Form>
      </ScanReviewLayout>
    </Modal>
  );
};

export default ScanReviewPurchaseOrderModal;
