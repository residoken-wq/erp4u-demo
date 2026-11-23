import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Alert,
  message,
  Button,
  Space,
  Row,
  Col,
} from 'antd';
import { RobotOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { confirmDraft } from '../copilot/draftApi';
import { mapDraftValidationErrors } from '../copilot/draftRoutes';
import api from '../../utils/api';

const { RangePicker } = DatePicker;

export interface DraftProductionOrderModalProps {
  open: boolean;
  onClose: () => void;
  draftId?: string;
  initialPayload?: any;
  suppliers: any[];
  onSuccess?: () => void;
}

export const DraftProductionOrderModal: React.FC<DraftProductionOrderModalProps> = ({
  open,
  onClose,
  draftId,
  initialPayload,
  suppliers = [],
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      api.get('/products')
        .then((res) => {
          setProducts(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && initialPayload) {
      const start = initialPayload.start_date ? dayjs(initialPayload.start_date) : null;
      const due = initialPayload.due_date ? dayjs(initialPayload.due_date) : null;

      form.setFieldsValue({
        code: initialPayload.code || '',
        product_id: initialPayload.product_id,
        quantity: initialPayload.quantity || 1,
        dateRange: start && due ? [start, due] : null,
        assigned_supplier_id: initialPayload.assigned_supplier_id || undefined,
        so_code: initialPayload.so_code || initialPayload.sales_order_code || '',
      });
    } else {
      form.resetFields();
    }
  }, [open, initialPayload, form]);

  const handleSubmit = async (values: any) => {
    if (!draftId) {
      message.error('Không tìm thấy mã nháp');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        code: values.code,
        product_id: values.product_id,
        quantity: Number(values.quantity),
        start_date: values.dateRange?.[0] ? values.dateRange[0].toISOString() : undefined,
        due_date: values.dateRange?.[1] ? values.dateRange[1].toISOString() : undefined,
        assigned_supplier_id: values.assigned_supplier_id || null,
        so_code: values.so_code || null,
        pfo_id: initialPayload?.pfo_id || null,
      };

      await confirmDraft(draftId, payload);
      message.success('Xác nhận tạo Lệnh sản xuất thành công!');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      if (err.code === 'DRAFT_INVALID' && Array.isArray(err.errors)) {
        const { fieldErrors } = mapDraftValidationErrors(err.errors);
        form.setFields(fieldErrors);
      }
      message.error(err.message || 'Lỗi xác nhận nháp Lệnh sản xuất');
    } finally {
      setLoading(false);
    }
  };

  const productOptions = products.map((p) => ({
    label: `${p.name} (${p.sku})`,
    value: p.id,
  }));

  // Nếu initialPayload có _display.product_name nhưng products chưa load kịp
  if (
    initialPayload?.product_id &&
    !productOptions.some((p) => p.value === initialPayload.product_id)
  ) {
    productOptions.unshift({
      label: initialPayload._display?.product_name || `Sản phẩm #${initialPayload.product_id}`,
      value: initialPayload.product_id,
    });
  }

  return (
    <Modal
      title={
        <Space>
          <DeploymentUnitOutlined style={{ color: '#0284c7' }} />
          <span>Duyệt Nháp Lệnh Sản Xuất (AI)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={650}
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
          Lưu & Xác Nhận Lệnh SX
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
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="code"
              label="Mã Lệnh SX"
              rules={[{ required: true, message: 'Vui lòng nhập mã lệnh SX' }]}
            >
              <Input placeholder="VD: LSX-2026-001" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="quantity"
              label="Số lượng sản xuất"
              rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="product_id"
          label="Sản phẩm / Mặt hàng sản xuất"
          rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
        >
          <Select
            placeholder="Chọn sản phẩm..."
            showSearch
            optionFilterProp="label"
            options={productOptions}
          />
        </Form.Item>

        <Form.Item name="dateRange" label="Thời gian thực hiện (Bắt đầu - Dự kiến xong)">
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="assigned_supplier_id" label="Xưởng / Đối tác gia công">
              <Select
                placeholder="Nội bộ hoặc chọn NCC gia công..."
                allowClear
                showSearch
                optionFilterProp="label"
                options={suppliers.map((s) => ({
                  label: s.name,
                  value: s.id,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="so_code" label="Mã Đơn hàng bán liên quan">
              <Input placeholder="VD: SO-2026-001" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default DraftProductionOrderModal;
