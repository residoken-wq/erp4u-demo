import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, message, Alert, Card, Tag, Space, Spin, Radio } from 'antd';
import { SendOutlined, CheckCircleOutlined, CloseCircleOutlined, MessageOutlined, LinkOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

interface Props {
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
  order: any;
}

export const SendZnsModal: React.FC<Props> = ({ open, onCancel, onSuccess, order }) => {
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestLog, setLatestLog] = useState<any>(null);
  const [fetchingLog, setFetchingLog] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (open && order) {
      // Priority: contact_phone -> receiver_phone -> customer.phone
      const defaultPhone = order.contact_phone || order.receiver_phone || order.customer?.phone || '';
      const defaultName = order.contact_name || order.receiver_name || order.customer?.name || 'Quý khách';
      setPhone(defaultPhone);
      setRecipientName(defaultName);
      setResultMessage(null);

      // Fetch latest ZNS log for this order
      setFetchingLog(true);
      api.get(`/zns/orders/${order.id}/latest-log`)
        .then(res => setLatestLog(res.data))
        .catch(() => setLatestLog(null))
        .finally(() => setFetchingLog(false));
    }
  }, [open, order]);

  const handleSend = async () => {
    if (!phone) {
      message.error('Vui lòng nhập số điện thoại người nhận');
      return;
    }

    setLoading(true);
    setResultMessage(null);

    try {
      const res = await api.post(`/zns/orders/${order.id}/send-confirmation`, {
        phone,
        recipient_name: recipientName,
      });

      if (res.data.success) {
        message.success('Đã gửi tin nhắn Zalo ZNS xác nhận đơn hàng thành công!');
        setResultMessage({
          type: 'success',
          text: `Gửi thành công! Mã tin nhắn: ${res.data.msg_id || 'OK'}`,
        });
        setLatestLog(res.data.log);
        if (onSuccess) onSuccess();
      } else {
        message.error(res.data.message || 'Gửi ZNS thất bại');
        setResultMessage({
          type: 'error',
          text: res.data.message || 'Gửi ZNS thất bại. Vui lòng kiểm tra số dư ZCA hoặc định dạng số điện thoại.',
        });
        if (res.data.log) setLatestLog(res.data.log);
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.message || e.message || 'Lỗi gửi tin ZNS';
      message.error(errMsg);
      setResultMessage({
        type: 'error',
        text: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  // Phone candidates for quick picking
  const phoneCandidates = [
    { label: 'Người liên hệ', name: order.contact_name, phone: order.contact_phone },
    { label: 'Người nhận hàng', name: order.receiver_name, phone: order.receiver_phone },
    { label: 'Hồ sơ khách hàng', name: order.customer?.name, phone: order.customer?.phone },
  ].filter(c => Boolean(c.phone));

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageOutlined style={{ color: '#0068ff', fontSize: 20 }} />
          <span>Gửi ZNS Xác Nhận Đơn Hàng (Zalo OA)</span>
          <Tag color="blue">Mẫu 632184</Tag>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={680}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Đóng
        </Button>,
        <Button
          key="send"
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={handleSend}
          style={{ background: '#0068ff', borderColor: '#0068ff' }}
        >
          Xác Nhận & Gửi ZNS
        </Button>,
      ]}
    >
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Thông báo tự động qua Zalo ZNS"
        description="Tin nhắn sẽ được gửi từ Zalo OA chính thức của doanh nghiệp đến Zalo cá nhân của khách hàng. Phí gửi tin 400đ/tin (trừ từ Zalo Cloud Account - ZCA)."
      />

      {resultMessage && (
        <Alert
          style={{ marginBottom: 16 }}
          type={resultMessage.type}
          showIcon
          message={resultMessage.type === 'success' ? 'Thành công' : 'Không thể gửi tin'}
          description={resultMessage.text}
        />
      )}

      {/* THÔNG TIN NGƯỜI NHẬN */}
      <Card size="small" title="Thông tin người nhận" style={{ marginBottom: 16, background: '#fafafa' }}>
        {phoneCandidates.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>
              Chọn nhanh số điện thoại từ đơn hàng:
            </span>
            <Radio.Group
              size="small"
              value={phone}
              onChange={e => {
                setPhone(e.target.value);
                const found = phoneCandidates.find(c => c.phone === e.target.value);
                if (found?.name) setRecipientName(found.name);
              }}
            >
              {phoneCandidates.map((c, idx) => (
                <Radio.Button key={idx} value={c.phone}>
                  {c.label}: <b>{c.phone}</b> {c.name ? `(${c.name})` : ''}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Số điện thoại nhận ZNS:</span>
            <Input
              style={{ marginTop: 4 }}
              prefix={<PhoneOutlined style={{ color: '#1890ff' }} />}
              placeholder="VD: 0938429210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <span style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2, display: 'block' }}>
              Hệ thống tự động chuyển sang 84... chuẩn Zalo API
            </span>
          </div>
          <div>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Tên khách hàng / Người nhận:</span>
            <Input
              style={{ marginTop: 4 }}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              placeholder="Tên khách"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* XEM TRƯỚC DỮ LIỆU GỬI (TEMPLATE DATA PREVIEW) */}
      <Card
        size="small"
        title="Xem trước nội dung tin ZNS (Mẫu 632184)"
        style={{ marginBottom: 16, border: '1px solid #d9d9d9' }}
      >
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 13, lineHeight: '22px' }}>
          <div>📦 <b>Mã đơn hàng (order_code):</b> <Tag color="blue">{order.order_code}</Tag></div>
          <div>👤 <b>Khách hàng (name):</b> <b>{recipientName || 'Quý khách'}</b></div>
          <div>📱 <b>Số điện thoại (phone_number):</b> {phone || '-'}</div>
          <div>💰 <b>Tổng tiền (price):</b> <b style={{ color: '#cf1322' }}>{Number(order.total_amount || 0).toLocaleString()} ₫</b></div>
          <div>📅 <b>Ngày đặt/xác nhận (date):</b> {dayjs(order.order_date || new Date()).format('DD/MM/YYYY')}</div>
          <div>🔖 <b>Trạng thái (status):</b> <Tag color="green">Giao dịch thành công</Tag></div>
          <div>
            🔗 <b>Link đơn hàng (order_id):</b>{' '}
            <a href={`/portal/quote/${order.uuid}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              <LinkOutlined /> Xem portal khách hàng
            </a>
          </div>
        </div>
      </Card>

      {/* LỊCH SỬ GỬI GẦN NHẤT */}
      {fetchingLog ? (
        <div style={{ textAlign: 'center', padding: 10 }}>
          <Spin size="small" /> Đang tải lịch sử...
        </div>
      ) : latestLog ? (
        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: latestLog.status === 'SUCCESS' ? '#389e0d' : '#cf1322' }}>
              {latestLog.status === 'SUCCESS' ? (
                <>
                  <CheckCircleOutlined /> Lần gửi gần nhất: Thành công
                </>
              ) : (
                <>
                  <CloseCircleOutlined /> Lần gửi gần nhất: Thất bại ({latestLog.error_message})
                </>
              )}
            </span>
            <span style={{ color: '#8c8c8c' }}>
              {dayjs(latestLog.created_at).format('HH:mm DD/MM/YYYY')} ({latestLog.sent_by || 'System'})
            </span>
          </div>
          {latestLog.msg_id && (
            <div style={{ color: '#555', marginTop: 2 }}>Mã tin Zalo: <code>{latestLog.msg_id}</code></div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
