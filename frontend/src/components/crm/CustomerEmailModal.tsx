import React, { useEffect, useState, useMemo } from 'react';
import { Modal, Form, Input, Select, Alert, message, Button, Typography, Space } from 'antd';
import { MailOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import { confirmDraft } from '../copilot/draftApi';
import { mapDraftValidationErrors } from '../copilot/draftRoutes';
import { buildEmailDraftPayload } from '../copilot/draftPayloads';

const { Text } = Typography;
const { TextArea } = Input;

export interface CustomerEmailModalProps {
  open: boolean;
  onClose: () => void;
  customerId: number;
  customer?: any;
  aiDraftId?: string;
  initialPayload?: {
    to?: string;
    subject?: string;
    body?: string;
    customer_id?: number;
  };
  onSuccess?: () => void;
}

export const CustomerEmailModal: React.FC<CustomerEmailModalProps> = ({
  open,
  onClose,
  customerId,
  customer: propCustomer,
  aiDraftId,
  initialPayload,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<any>(propCustomer || null);

  // Tải chi tiết khách hàng nếu chưa có để lấy danh sách liên hệ & email
  useEffect(() => {
    if (!open || !customerId) return;
    if (propCustomer && propCustomer.id === customerId) {
      setCustomer(propCustomer);
      return;
    }

    api.get(`/customers/${customerId}`)
      .then((res) => {
        setCustomer(res.data);
      })
      .catch(() => {
        message.error('Không thể tải thông tin khách hàng');
      });
  }, [open, customerId, propCustomer]);

  // Danh sách các địa chỉ email hợp lệ của khách hàng và liên hệ đã lưu (không cho gõ tự do)
  const recipientOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const seen = new Set<string>();

    const addEmail = (rawEmail?: string, labelPrefix?: string) => {
      if (!rawEmail || typeof rawEmail !== 'string') return;
      const trimmed = rawEmail.trim();
      if (!trimmed.includes('@')) return;
      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);

      list.push({
        label: labelPrefix ? `${labelPrefix} (${trimmed})` : trimmed,
        value: trimmed,
      });
    };

    if (customer?.email) {
      addEmail(customer.email, customer.name || 'Khách hàng chính');
    }

    if (Array.isArray(customer?.contacts)) {
      for (const contact of customer.contacts) {
        if (contact.email) {
          addEmail(contact.email, contact.full_name || 'Liên hệ');
        }
        if (contact.phone && contact.phone.includes('@')) {
          addEmail(contact.phone, contact.full_name || 'Liên hệ');
        }
      }
    }

    return list;
  }, [customer]);

  // Điền dữ liệu ban đầu từ nháp
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        to: initialPayload?.to,
        subject: initialPayload?.subject || '',
        body: initialPayload?.body || '',
      });
    } else {
      form.resetFields();
    }
  }, [open, initialPayload, form]);

  const handleSubmit = async (values: any) => {
    if (!aiDraftId) {
      message.error('Chỉ hỗ trợ gửi email qua duyệt bản nháp AI trong phiên bản này');
      return;
    }

    setLoading(true);
    try {
      const payload = buildEmailDraftPayload({
        customer_id: customerId,
        to: values.to,
        subject: values.subject,
        body: values.body,
      });

      await confirmDraft(aiDraftId, payload);
      message.success('Đã gửi email thành công!');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      if (err.code === 'DRAFT_INVALID' && Array.isArray(err.errors)) {
        const { fieldErrors } = mapDraftValidationErrors(err.errors);
        form.setFields(fieldErrors);
      }
      message.error(err.message || 'Lỗi gửi email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <MailOutlined style={{ color: '#0284c7' }} />
          <span>Soạn & Gửi Email Khách Hàng (Nháp AI)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          Đóng
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={() => form.submit()}
        >
          Xác nhận & Gửi Email
        </Button>,
      ]}
      width={680}
      destroyOnClose
    >
      {/* Warning banner */}
      <Alert
        type="warning"
        showIcon
        icon={<RobotOutlined />}
        message="Nháp do AI soạn — kiểm tra kỹ trước khi lưu."
        style={{ marginBottom: 16, borderRadius: 6 }}
      />

      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">Khách hàng: </Text>
        <Text strong>{customer?.name || `ID: ${customerId}`}</Text>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="to"
          label="Người nhận (chọn từ danh bạ khách hàng đã lưu)"
          rules={[{ required: true, message: 'Vui lòng chọn email người nhận' }]}
          extra="Chỉ cho phép gửi tới các địa chỉ email đã lưu của khách hàng và người liên hệ liên quan"
        >
          <Select
            placeholder="Chọn người nhận từ danh bạ..."
            options={recipientOptions}
            showSearch
            optionFilterProp="label"
            notFoundContent={
              recipientOptions.length === 0
                ? 'Khách hàng này chưa có email hoặc liên hệ nào lưu trong hệ thống'
                : 'Không tìm thấy email phù hợp'
            }
          />
        </Form.Item>

        <Form.Item
          name="subject"
          label="Tiêu đề"
          rules={[
            { required: true, message: 'Vui lòng nhập tiêu đề email' },
            { max: 200, message: 'Tiêu đề tối đa 200 ký tự' },
          ]}
        >
          <Input placeholder="Tiêu đề email..." maxLength={200} showCount />
        </Form.Item>

        <Form.Item
          name="body"
          label="Nội dung email (văn bản thuần)"
          rules={[
            { required: true, message: 'Vui lòng nhập nội dung email' },
            { max: 10000, message: 'Nội dung tối đa 10.000 ký tự' },
          ]}
        >
          <TextArea
            rows={8}
            placeholder="Nhập nội dung email..."
            maxLength={10000}
            showCount
            style={{ fontFamily: 'sans-serif' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CustomerEmailModal;
