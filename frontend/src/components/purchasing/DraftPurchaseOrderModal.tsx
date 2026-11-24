import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Button,
  Alert,
  DatePicker,
  message,
  Space,
  Typography,
} from 'antd';
import { RobotOutlined, PlusOutlined, DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { confirmDraft } from '../copilot/draftApi';
import { mapDraftValidationErrors } from '../copilot/draftRoutes';
import { buildPurchaseOrderDraftPayload } from '../copilot/draftPayloads';

const { Text } = Typography;

export interface DraftPurchaseOrderModalProps {
  open: boolean;
  onClose: () => void;
  draftId?: string;
  initialPayload?: any;
  suppliers: any[];
  onSuccess?: () => void;
}

export const DraftPurchaseOrderModal: React.FC<DraftPurchaseOrderModalProps> = ({
  open,
  onClose,
  draftId,
  initialPayload,
  suppliers = [],
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (open && initialPayload) {
      form.setFieldsValue({
        po_code: initialPayload.po_code || '',
        supplier_id: initialPayload.supplier_id || undefined,
        note: initialPayload.note || '',
        expected_delivery_date: initialPayload.expected_delivery_date
          ? dayjs(initialPayload.expected_delivery_date)
          : undefined,
      });

      const rawItems = Array.isArray(initialPayload.items) ? initialPayload.items : [];
      setItems(
        rawItems.map((item: any, idx: number) => ({
          key: idx,
          material_id: item.material_id,
          product_id: item.product_id,
          description: item.description || item._display?.material_name || item._display?.product_name || `Mặt hàng #${idx + 1}`,
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          note: item.note || '',
          _display: item._display,
        })),
      );
    } else {
      form.resetFields();
      setItems([]);
    }
  }, [open, initialPayload, form]);

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
    if (!draftId) {
      message.error('Không tìm thấy mã nháp');
      return;
    }

    if (items.length === 0) {
      message.error('Đơn mua hàng phải có ít nhất 1 mặt hàng');
      return;
    }

    setLoading(true);
    try {
      const payload = buildPurchaseOrderDraftPayload({
        ...values,
        items,
      });

      await confirmDraft(draftId, payload);
      message.success('Xác nhận tạo Đơn mua hàng thành công!');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      if (err.code === 'DRAFT_INVALID' && Array.isArray(err.errors)) {
        const { fieldErrors } = mapDraftValidationErrors(err.errors);
        form.setFields(fieldErrors);
      }
      message.error(err.message || 'Lỗi xác nhận nháp PO');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Mô tả mặt hàng / Vật tư',
      dataIndex: 'description',
      render: (text: string, record: any) => (
        <Input
          value={text}
          onChange={(e) => updateItem(record.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      width: 120,
      render: (val: number, record: any) => (
        <InputNumber
          min={0.01}
          value={val}
          style={{ width: '100%' }}
          onChange={(v) => updateItem(record.key, 'quantity', v)}
        />
      ),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      width: 160,
      render: (val: number, record: any) => (
        <InputNumber
          min={0}
          value={val}
          style={{ width: '100%' }}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateItem(record.key, 'unit_price', v)}
        />
      ),
    },
    {
      title: 'Thành tiền',
      key: 'subtotal',
      width: 150,
      align: 'right' as const,
      render: (_: any, record: any) => (
        <b>
          {((Number(record.quantity) || 0) * (Number(record.unit_price) || 0)).toLocaleString()}{' '}
          ₫
        </b>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.key)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <ShoppingCartOutlined style={{ color: '#0284c7' }} />
          <span>Duyệt Nháp Đơn Mua Hàng (AI)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose} disabled={loading}>
          Đóng
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={loading}
          onClick={() => form.submit()}
        >
          Lưu & Xác Nhận PO
        </Button>,
      ]}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        icon={<RobotOutlined />}
        message="Nháp do AI soạn — kiểm tra kỹ trước khi lưu."
        style={{ marginBottom: 16, borderRadius: 6 }}
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="po_code" label="Mã PO (để trống để tự sinh)">
            <Input placeholder="Tự sinh nếu để trống" />
          </Form.Item>

          <Form.Item
            name="supplier_id"
            label="Nhà cung cấp"
            rules={[{ required: true, message: 'Vui lòng chọn nhà cung cấp' }]}
          >
            <Select
              placeholder="Chọn nhà cung cấp..."
              showSearch
              optionFilterProp="label"
              options={suppliers.map((s) => ({
                label: s.name,
                value: s.id,
              }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="expected_delivery_date" label="Ngày giao dự kiến">
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="Chọn ngày giao dự kiến..." />
        </Form.Item>

        <Form.Item name="note" label="Ghi chú đơn mua hàng">
          <Input.TextArea rows={2} placeholder="Ghi chú..." />
        </Form.Item>

        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Danh sách mặt hàng ({items.length}):</Text>
          <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addItem}>
            Thêm dòng
          </Button>
        </div>

        <Table
          dataSource={items}
          columns={columns}
          pagination={false}
          size="small"
          bordered
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3} align="right">
                <b>Tổng tiền ước tính:</b>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ color: '#0284c7', fontSize: 14 }}>
                  {totalAmount.toLocaleString()} ₫
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          )}
        />
      </Form>
    </Modal>
  );
};

export default DraftPurchaseOrderModal;
