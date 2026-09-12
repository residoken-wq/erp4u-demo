import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message, Alert, Row, Col, Tag, Table, Switch, Checkbox, Space, Tooltip, Typography, Divider } from 'antd';
import { ReloadOutlined, SaveOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, MessageOutlined, KeyOutlined, ApiOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Text } = Typography;

export const ZnsConfigTab: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/zns/config');
      setStatusInfo(res.data);
      form.setFieldsValue({
        app_id: res.data.app_id,
        secret_key: res.data.secret_key,
        oa_id: res.data.oa_id,
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
        order_confirm_template_id: res.data.order_confirm_template_id || '632184',
        delivery_notice_template_id: res.data.delivery_notice_template_id || '',
        portal_base_url: res.data.portal_base_url || 'https://localhost:3000',
        auto_send_on_order_confirm: res.data.auto_send_on_order_confirm || false,
        auto_send_on_delivery_shipped: res.data.auto_send_on_delivery_shipped || false,
        is_active: res.data.is_active !== undefined ? res.data.is_active : true,
      });
    } catch (e: any) {
      message.error('Không thể tải cấu hình Zalo ZNS: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/zns/logs?limit=25');
      setLogs(res.data || []);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      await api.post('/zns/config', values);
      message.success('Đã lưu cấu hình Zalo ZNS thành công!');
      fetchConfig();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshingToken(true);
    try {
      const res = await api.post('/zns/refresh-token');
      message.success(res.data.message || 'Đã làm mới Token thành công!');
      fetchConfig();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Lỗi làm mới Token');
    } finally {
      setRefreshingToken(false);
    }
  };

  const handleTestSend = async () => {
    if (!testPhone) {
      message.error('Vui lòng nhập số điện thoại thử nghiệm');
      return;
    }
    setTestingSend(true);
    try {
      const res = await api.post('/zns/test-connection', {
        phone: testPhone,
        template_id: form.getFieldValue('order_confirm_template_id') || '632184',
      });
      if (res.data.success) {
        message.success('Đã gửi tin test thành công!');
      } else {
        message.error(res.data.message || 'Gửi test thất bại');
      }
      fetchLogs();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Lỗi khi gửi tin test');
    } finally {
      setTestingSend(false);
    }
  };

  return (
    <div>
      {/* HEADER CARD - STATUS */}
      <Card
        size="small"
        style={{ marginBottom: 16, border: '1px solid #d9d9d9' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageOutlined style={{ color: '#0068ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>Trạng Thái Kết Nối Zalo ZNS (OAuth 2.0)</span>
          </div>
        }
        extra={
          <Space>
            <Button
              type="primary"
              ghost
              icon={<ReloadOutlined />}
              loading={refreshingToken}
              onClick={handleRefreshToken}
            >
              Làm Mới Token Ngay
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchConfig(); fetchLogs(); }}>
              Tải lại
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: '#666' }}>Trạng thái tích hợp:</div>
            <div style={{ marginTop: 4 }}>
              {statusInfo?.is_active ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>Đang kích hoạt</Tag>
              ) : (
                <Tag color="red" icon={<CloseCircleOutlined />}>Đang tắt</Tag>
              )}
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: '#666' }}>Hạn Access Token:</div>
            <div style={{ marginTop: 4 }}>
              {statusInfo?.access_token ? (
                statusInfo.isTokenExpired ? (
                  <Tag color="red">Đã hết hạn (Cần refresh)</Tag>
                ) : (
                  <Tag color={statusInfo.tokenHoursLeft < 4 ? 'orange' : 'blue'}>
                    Còn {statusInfo.tokenHoursLeft} giờ
                  </Tag>
                )
              ) : (
                <Tag color="default">Chưa có token</Tag>
              )}
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: '#666' }}>Hạn Refresh Token:</div>
            <div style={{ marginTop: 4 }}>
              {statusInfo?.refresh_token ? (
                statusInfo.isRefreshTokenExpired ? (
                  <Tag color="red">Đã hết hạn</Tag>
                ) : (
                  <Tag color="cyan">Còn ~{statusInfo.refreshDaysLeft} ngày</Tag>
                )
              ) : (
                <Tag color="default">Chưa có</Tag>
              )}
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: '#666' }}>Tự động làm mới (Cron):</div>
            <div style={{ marginTop: 4 }}>
              <Tag color="geekblue">Chạy ngầm mỗi 4 giờ</Tag>
            </div>
          </Col>
        </Row>
      </Card>

      {/* FORM CẤU HÌNH */}
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Card size="small" title="Thông tin Zalo for Developers & Official Account" style={{ marginBottom: 16 }}>
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="Hướng dẫn lấy Token lần đầu"
            description={
              <span>
                1. Truy cập <b>Zalo for Developers</b> ➔ Quản lý ứng dụng (App) của bạn.<br />
                2. Vào phần <b>Công cụ ➔ Khai thác Token</b>, chọn đúng Zalo Official Account (OA) đã được duyệt mẫu tin ZNS.<br />
                3. Sao chép <b>App ID, Secret Key, Access Token</b> và <b>Refresh Token</b> dán vào bên dưới rồi bấm <b>Lưu Cấu Hình</b>.<br />
                4. Hệ thống ERP sẽ tự động duy trì làm mới (Refresh Token) vĩnh viễn định kỳ mỗi 4 giờ.
              </span>
            }
          />

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="app_id" label="App ID (Mã Ứng Dụng)" rules={[{ required: true, message: 'Nhập App ID' }]}>
                <Input placeholder="VD: 4402685712345678" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="secret_key" label="Secret Key (Khóa Bí Mật)" rules={[{ required: true, message: 'Nhập Secret Key' }]}>
                <Input.Password placeholder="Khóa bí mật ứng dụng Zalo" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="oa_id" label="OA ID (Mã Official Account)">
                <Input placeholder="VD: 14782950123456789" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="access_token" label="Access Token Hiện Tại (Có hạn 25h)">
                <Input.TextArea rows={2} placeholder="Access token dài được cấp từ Zalo Developers..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="refresh_token" label="Refresh Token Hiện Tại (Dùng để lấy Token mới)">
                <Input.TextArea rows={2} placeholder="Refresh token dài dùng để cấp lại token..." />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* TEMPLATES & CÀI ĐẶT GỬI */}
        <Card size="small" title="Cấu hình Mẫu ZNS (Template IDs) & Tự Động Hóa" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="order_confirm_template_id"
                label="Mẫu Xác Nhận Đơn Hàng (Template ID)"
                rules={[{ required: true, message: 'Nhập Template ID xác nhận đơn' }]}
                extra="Mẫu đã duyệt: 632184 (Tên mẫu: Xác nhận đơn hàng)"
              >
                <Input placeholder="632184" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="delivery_notice_template_id"
                label="Mẫu Thông Báo Giao Hàng (Template ID)"
                extra="Nếu bạn đã đăng ký mẫu ZNS Giao hàng trên Zalo OA, hãy nhập Template ID vào đây"
              >
                <Input placeholder="VD: 638920 (để trống nếu chưa đăng ký)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="portal_base_url"
                label="Portal Base URL (Đường dẫn tra cứu đơn hàng)"
                rules={[{ required: true }]}
                extra="Dùng để sinh link đơn hàng {order_id} gửi cho khách hàng tra cứu"
              >
                <Input placeholder="https://localhost:3000" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="is_active" valuePropName="checked" label="Kích hoạt tính năng Zalo ZNS">
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 16px 0' }} />

          <div style={{ fontWeight: 500, marginBottom: 8 }}>Chế độ tự động gửi (Automation Triggers):</div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item name="auto_send_on_order_confirm" valuePropName="checked" style={{ margin: 0 }}>
              <Checkbox>
                <b>Tự động gửi ZNS khi xác nhận đơn hàng:</b> Hệ thống sẽ tự động gửi ZNS mẫu 632184 ngay khi đơn hàng chuyển sang trạng thái Xác nhận (SO_PENDING).
              </Checkbox>
            </Form.Item>
            <Form.Item name="auto_send_on_delivery_shipped" valuePropName="checked" style={{ margin: 0 }}>
              <Checkbox>
                <b>Tự động gửi ZNS khi xuất kho giao hàng:</b> Hệ thống sẽ tự động gửi ZNS thông báo giao hàng ngay khi phiếu xuất kho chuyển sang trạng thái Đã xuất/Đang giao (SHIPPED).
              </Checkbox>
            </Form.Item>
          </Space>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />} loading={loading}>
            Lưu Cấu Hình Zalo ZNS
          </Button>
        </div>
      </Form>

      {/* THỬ NGHIỆM GỬI TIN */}
      <Card
        size="small"
        title="Kiểm tra kết nối & Gửi thử nghiệm ZNS"
        style={{ marginBottom: 24, border: '1px dashed #1890ff', background: '#f0f5ff' }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Input
              placeholder="Nhập số điện thoại Zalo thử nghiệm (VD: 0938429210)"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={testingSend}
            onClick={handleTestSend}
            style={{ background: '#0068ff', borderColor: '#0068ff' }}
          >
            Gửi Thử Mẫu 632184 (400đ)
          </Button>
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
          💡 Lưu ý: Số điện thoại phải đã đăng ký tài khoản Zalo và tài khoản ZCA phải có số dư tối thiểu 50.000đ.
        </div>
      </Card>

      {/* BẢNG LOGS LỊCH SỬ GỬI TIN GẦN NHẤT */}
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HistoryOutlined />
            <span>Lịch Sử Gửi Tin ZNS Gần Nhất (25 lần)</span>
          </div>
        }
        extra={
          <Button size="small" onClick={fetchLogs} loading={loadingLogs}>
            Làm mới lịch sử
          </Button>
        }
      >
        <Table
          dataSource={logs}
          rowKey="id"
          size="small"
          pagination={false}
          loading={loadingLogs}
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'created_at',
              width: 130,
              render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm'),
            },
            {
              title: 'Loại tin / Mẫu',
              dataIndex: 'template_type',
              width: 140,
              render: (t: string, r: any) => (
                <div>
                  <Tag color={t === 'ORDER_CONFIRM' ? 'blue' : t === 'DELIVERY_NOTICE' ? 'cyan' : 'default'}>
                    {t === 'ORDER_CONFIRM' ? 'Xác nhận SO' : t === 'DELIVERY_NOTICE' ? 'Giao hàng' : t}
                  </Tag>
                  <div style={{ fontSize: 11, color: '#888' }}>ID: {r.template_id}</div>
                </div>
              ),
            },
            {
              title: 'Đơn hàng / Tracking',
              dataIndex: 'tracking_id',
              width: 130,
              render: (v: string) => v ? <b>{v}</b> : '-',
            },
            {
              title: 'Người nhận',
              render: (r: any) => (
                <div>
                  <div><b>{r.recipient_name || 'Khách hàng'}</b></div>
                  <div style={{ fontSize: 11, color: '#666' }}>{r.phone}</div>
                </div>
              ),
            },
            {
              title: 'Trạng thái',
              align: 'center' as const,
              width: 120,
              render: (r: any) => (
                r.status === 'SUCCESS' ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>Thành công</Tag>
                ) : (
                  <Tooltip title={r.error_message}>
                    <Tag color="red" icon={<CloseCircleOutlined />} style={{ cursor: 'pointer' }}>
                      Thất bại ({r.error_code})
                    </Tag>
                  </Tooltip>
                )
              ),
            },
            {
              title: 'Mã tin Zalo',
              dataIndex: 'msg_id',
              render: (v: string) => v ? <code>{v}</code> : '-',
            },
            {
              title: 'Ghi chú / Thông báo',
              dataIndex: 'error_message',
              render: (m: string) => <span style={{ fontSize: 12 }}>{m}</span>,
            },
            {
              title: 'Người gửi',
              dataIndex: 'sent_by',
              width: 100,
            },
          ]}
        />
      </Card>
    </div>
  );
};
