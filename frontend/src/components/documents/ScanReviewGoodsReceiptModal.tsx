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
} from 'antd';
import { InboxOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { ScanReviewLayout } from './ScanReviewLayout';
import { DocumentScanResponse, linkScanDocument } from './documentScanApi';
import {
  transformDeliveryNoteToGoodsReceipt,
  TransformedGoodsReceipt,
  safeString,
} from './documentScanTransformers';

const { Text } = Typography;

export interface ScanReviewGoodsReceiptModalProps {
  open: boolean;
  onClose: () => void;
  scan: DocumentScanResponse;
  onSuccess?: (createdReceipt: any) => void;
}

export const ScanReviewGoodsReceiptModal: React.FC<ScanReviewGoodsReceiptModalProps> = ({
  open,
  onClose,
  scan,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);

  const transformed: TransformedGoodsReceipt = useMemo(() => {
    return transformDeliveryNoteToGoodsReceipt(scan.extracted, scan.suggestions, scan.field_confidence);
  }, [scan]);

  useEffect(() => {
    if (open) {
      // Tải danh sách PO mở để user có thể chọn nếu scan chưa khớp PO
      api.get('/purchasing')
        .then((res) => {
          setPoList(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && scan) {
      const init = transformed.initialValues;
      form.setFieldsValue({
        po_id: init.po_id || undefined,
        note: init.note || '',
        delivery_date: init.delivery_date ? dayjs(init.delivery_date) : undefined,
      });

      setItems(
        init.items.map((it, idx) => ({
          key: idx,
          po_item_id: it.po_item_id,
          material_id: it.material_id,
          product_id: it.product_id,
          description: it.description,
          quantity: it.quantity,
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
        description: 'Mặt hàng mới',
        quantity: 1,
      },
    ]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const handleSubmit = async (values: any) => {
    if (!values.po_id) {
      message.error('Vui lòng chọn Đơn mua hàng (PO) liên quan');
      return;
    }

    if (items.length === 0) {
      message.error('Phiếu nhập kho phải có ít nhất 1 mặt hàng');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        po_id: Number(values.po_id),
        note: values.note || '',
        items: items.map((it) => ({
          po_item_id: it.po_item_id,
          material_id: it.material_id,
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
        })),
      };

      // 1. Tạo Goods Receipt draft qua API thường
      const res = await api.post('/inventory/goods-receipt/draft', payload);
      const createdReceipt = res.data;
      message.success('Đã tạo phiếu nhập kho nháp thành công!');

      // 2. Liên kết scan với receipt
      if (createdReceipt?.id) {
        try {
          await linkScanDocument(scan.id, 'goods_receipt', createdReceipt.id);
        } catch (linkErr: any) {
          message.warning(`Không thể liên kết chứng từ gốc: ${linkErr.message || 'Lỗi mạng'}`);
        }
      }

      onClose();
      if (onSuccess) {
        onSuccess(createdReceipt);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || 'Lỗi khi tạo phiếu nhập kho');
    } finally {
      setLoading(false);
    }
  };

  const markedFields = transformed.markedFields;

  const getFieldStyle = (fieldName: string): React.CSSProperties => {
    const mark = markedFields[fieldName];
    if (!mark) return {};
    if (mark.level === 'missing') {
      return { border: '1.5px solid #ff4d4f', borderRadius: 6 };
    }
    return { border: '1.5px solid #faad14', borderRadius: 6 };
  };

  const columns = [
    {
      title: 'Mô tả mặt hàng',
      dataIndex: 'description',
      render: (text: string, record: any, idx: number) => {
        const mark = markedFields[`items.${idx}.item_id`];
        const element = (
          <Input
            value={text}
            style={mark ? { border: '1px dashed #ff4d4f' } : undefined}
            onChange={(e) => updateItem(record.key, 'description', e.target.value)}
          />
        );
        if (mark) {
          return <Tooltip title={mark.message}>{element}</Tooltip>;
        }
        return element;
      },
    },
    {
      title: 'Số lượng thực giao',
      dataIndex: 'quantity',
      width: 140,
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
          <InboxOutlined style={{ color: '#272F72' }} />
          <span>Duyệt Phiếu Giao Hàng & Tạo Phiếu Nhập Kho Nháp</span>
        </Space>
      }
      width={1250}
      footer={null}
      destroyOnClose
    >
      <ScanReviewLayout scanId={scan.id} sourceType={scan.source}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Đơn mua hàng (PO) liên quan"
            name="po_id"
            rules={[{ required: true, message: 'Vui lòng chọn đơn mua hàng' }]}
            help={markedFields['po_id']?.message}
            validateStatus={markedFields['po_id'] ? (markedFields['po_id'].level === 'missing' ? 'error' : 'warning') : undefined}
          >
            <Select
              placeholder="Chọn đơn mua hàng (PO)"
              showSearch
              optionFilterProp="label"
              style={getFieldStyle('po_id')}
              options={poList.map((p) => ({
                label: `${p.po_code || `PO #${p.id}`} — ${safeString(p.supplier?.name || 'NCC')}`,
                value: p.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Ngày giao hàng"
            name="delivery_date"
            help={markedFields['delivery_date']?.message}
            validateStatus={markedFields['delivery_date'] ? 'warning' : undefined}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%', ...getFieldStyle('delivery_date') }} />
          </Form.Item>

          <Form.Item label="Ghi chú phiếu nhập" name="note">
            <Input.TextArea rows={2} placeholder="Ghi chú..." />
          </Form.Item>

          <div style={{ marginTop: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Danh sách mặt hàng giao ({items.length})</Text>
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
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onClose} disabled={loading}>
              Bỏ qua
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} style={{ background: '#272F72' }}>
              Tạo Phiếu Nhập Kho Nháp
            </Button>
          </div>
        </Form>
      </ScanReviewLayout>
    </Modal>
  );
};

export default ScanReviewGoodsReceiptModal;
