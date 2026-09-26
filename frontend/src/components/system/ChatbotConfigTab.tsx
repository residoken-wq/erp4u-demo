import React, { useEffect, useState, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Switch,
  message,
  Spin,
  Row,
  Col,
  Card,
  Alert,
  Popconfirm,
  Select,
  Collapse,
  Tag,
  Typography,
  Checkbox,
  TimePicker,
  Upload,
  Divider,
} from 'antd';
import {
  SaveOutlined,
  UploadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  NotificationOutlined,
  SettingOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { API_URL } from '../../config';

const { Title, Text, Paragraph } = Typography;

const DAY_LABELS: Record<string, string> = {
  mon: 'Thứ 2',
  tue: 'Thứ 3',
  wed: 'Thứ 4',
  thu: 'Thứ 5',
  fri: 'Thứ 6',
  sat: 'Thứ 7',
  sun: 'Chủ Nhật',
};

export const ChatbotConfigTab: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [usersList, setUsersList] = useState<Array<{ id: number; full_name: string; username: string }>>([]);
  const [initialDefaults, setInitialDefaults] = useState<any>(null);

  // Live preview watch states
  const displayName = Form.useWatch('display_name', form) || 'Trợ lý AI';
  const shortName = Form.useWatch('short_name', form) || 'Trợ lý';
  const avatarUrl = Form.useWatch('avatar_url', form) || '';
  const greeting = Form.useWatch('greeting', form) || '';
  const workingHours = Form.useWatch('working_hours', form);

  const getFullImageUrl = (val: string) => {
    if (!val) return '';
    if (val.startsWith('http') || val.startsWith('data:')) return val;
    if (val.startsWith('/uploads/')) return `${API_URL}/upload/files/${val.replace('/uploads/', '')}`;
    return `${API_URL}${val}`;
  };

  const renderedPreviewGreeting = useMemo(() => {
    if (!greeting) return '';
    return greeting
      .replace(/{short_name}/g, shortName)
      .replace(/{display_name}/g, displayName);
  }, [greeting, shortName, displayName]);

  const isCurrentOpen = useMemo(() => {
    if (!workingHours?.days) return false;
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: workingHours.tz || 'Asia/Ho_Chi_Minh',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      const parts = formatter.formatToParts(now);
      let weekday = '';
      let hour = '0';
      let minute = '0';
      for (const p of parts) {
        if (p.type === 'weekday') weekday = p.value.toLowerCase().slice(0, 3);
        if (p.type === 'hour') hour = p.value;
        if (p.type === 'minute') minute = p.value;
      }
      const daySchedule = workingHours.days[weekday];
      if (!daySchedule || daySchedule.off) return false;
      if (!daySchedule.from || !daySchedule.to) return false;

      const [fh, fm] = daySchedule.from.split(':').map((s: string) => parseInt(s, 10));
      const [th, tm] = daySchedule.to.split(':').map((s: string) => parseInt(s, 10));
      const curM = parseInt(hour, 10) * 60 + parseInt(minute, 10);
      const fromM = fh * 60 + fm;
      const toM = th * 60 + tm;
      return curM >= fromM && curM < toM;
    } catch {
      return false;
    }
  }, [workingHours]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, statusRes, usersRes] = await Promise.all([
        api.get('/chatbot/admin/config'),
        api.get('/chatbot/admin/status').catch(() => ({ data: null })),
        api.get('/users').catch(() => ({ data: [] })),
      ]);

      const config = configRes.data;
      setInitialDefaults(config);
      setStatusData(statusRes.data);

      if (Array.isArray(usersRes.data)) {
        setUsersList(usersRes.data.filter((u: any) => u.is_active !== false));
      }

      form.setFieldsValue({
        ...config,
      });
    } catch (err: any) {
      message.error('Không thể tải cấu hình Trợ lý AI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', 'erp');

    const hide = message.loading('Đang tải ảnh avatar lên...', 0);
    try {
      const uploadRes = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = uploadRes.data?.url || uploadRes.data?.data?.url;
      if (url) {
        form.setFieldValue('avatar_url', url);
        message.success('Tải ảnh avatar thành công!');
      }
    } catch (e) {
      message.error('Lỗi khi tải ảnh avatar lên');
    } finally {
      hide();
    }
  };

  const handleResetField = (fieldName: string) => {
    if (initialDefaults && initialDefaults[fieldName] !== undefined) {
      form.setFieldValue(fieldName, initialDefaults[fieldName]);
      message.info(`Đã khôi phục ${fieldName} về mặc định`);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
      };

      const res = await api.put('/chatbot/admin/config', payload);
      message.success('Đã lưu cấu hình Trợ lý AI thành công!');
      form.setFieldsValue(res.data);
      // Reload status
      api.get('/chatbot/admin/status').then((r) => setStatusData(r.data)).catch(() => {});
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi lưu cấu hình';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" tip="Đang tải cấu hình Trợ lý AI..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
            <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            Cấu Hình Trợ Lý AI Website
          </h3>
          <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
            Thiết lập nhận diện, lời chào, kênh liên hệ, giờ làm việc và thông báo hộp thư khách hàng cho trợ lý AI.
          </p>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          size="large"
          loading={saving}
          onClick={() => form.submit()}
        >
          Lưu Cấu Hình
        </Button>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Cảnh báo P0 */}
        <Alert
          type="warning"
          showIcon
          message="Widget website đang được hoàn thiện"
          description="Widget website chưa được triển khai. Bật lúc này chỉ mở API backend."
          style={{ marginBottom: 24, borderRadius: 8 }}
        />

        <Row gutter={24}>
          {/* Main Edit Column */}
          <Col xs={24} lg={15}>
            {/* 1. Trạng thái hoạt động */}
            <Card
              size="small"
              title={<span style={{ fontWeight: 700 }}>Trạng Thái Hoạt Động</span>}
              style={{ marginBottom: 20, borderRadius: 8 }}
            >
              <Form.Item
                name="enabled"
                valuePropName="checked"
                style={{ marginBottom: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Popconfirm
                    title="Bật trợ lý cho khách trên website?"
                    onConfirm={() => form.setFieldValue('enabled', true)}
                    okText="Bật"
                    cancelText="Hủy"
                  >
                    <Switch
                      checked={form.getFieldValue('enabled')}
                      onChange={(checked) => {
                        if (!checked) form.setFieldValue('enabled', false);
                      }}
                      checkedChildren="BẬT"
                      unCheckedChildren="TẮT"
                    />
                  </Popconfirm>
                  <Text type="secondary">
                    Cho phép khách hàng truy cập API trợ lý AI trên website
                  </Text>
                </div>
              </Form.Item>
            </Card>

            {/* 2. Nhận diện Trợ lý */}
            <Card
              size="small"
              title={<span style={{ fontWeight: 700 }}>Nhận Diện & Lời Chào</span>}
              style={{ marginBottom: 20, borderRadius: 8 }}
            >
              <Form.Item
                name="display_name"
                label="Tên hiển thị đầy đủ"
                rules={[
                  { required: true, message: 'Nhập tên hiển thị (2–60 ký tự)' },
                  { min: 2, max: 60, message: 'Độ dài 2–60 ký tự' },
                ]}
                extra="Tên hiển thị trên website, email thông báo và lời chào"
              >
                <Input
                  placeholder="VD: Trợ lý AI ERP4U"
                  addonAfter={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleResetField('display_name')}
                      icon={<ReloadOutlined />}
                    >
                      Mặc định
                    </Button>
                  }
                />
              </Form.Item>

              <Form.Item
                name="short_name"
                label="Tên gọi ngắn gọn"
                rules={[
                  { required: true, message: 'Nhập tên ngắn gọn (2–30 ký tự)' },
                  { min: 2, max: 30, message: 'Độ dài 2–30 ký tự' },
                ]}
                extra="Dùng trong lời chào, tiêu đề email thông báo và nhãn trợ lý"
              >
                <Input
                  placeholder="VD: Bé Trợ Lý"
                  addonAfter={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleResetField('short_name')}
                      icon={<ReloadOutlined />}
                    >
                      Mặc định
                    </Button>
                  }
                />
              </Form.Item>

              <Form.Item
                name="avatar_url"
                label="Ảnh đại diện (Avatar)"
                rules={[{ required: true, message: 'Nhập đường dẫn avatar (/ hoặc https://)' }]}
                extra="Đường dẫn ảnh công khai hoặc tải ảnh từ máy tính"
              >
                <div style={{ display: 'flex', gap: 10 }}>
                  <Input placeholder="/images/chatbot/cuu-erp4u-192.webp" />
                  <Upload
                    beforeUpload={(file) => {
                      handleUploadAvatar(file);
                      return false;
                    }}
                    showUploadList={false}
                    accept="image/*"
                  >
                    <Button icon={<UploadOutlined />}>Tải ảnh</Button>
                  </Upload>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleResetField('avatar_url')}
                    icon={<ReloadOutlined />}
                  >
                    Mặc định
                  </Button>
                </div>
              </Form.Item>

              <Form.Item
                name="greeting"
                label="Lời chào mở đầu"
                rules={[{ required: true, message: 'Nhập lời chào mở đầu' }]}
                extra="Cho phép placeholder {short_name} và {display_name}"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Dạ em là {short_name}, trợ lý AI của ERP4U. Anh/chị đang chọn sản phẩm cho bé, đặt cho trường hay cần hỗ trợ đơn đã mua ạ?"
                />
              </Form.Item>
            </Card>

            {/* 3. Kênh liên hệ */}
            <Card
              size="small"
              title={<span style={{ fontWeight: 700 }}>Kênh Liên Hệ Khách Hàng</span>}
              style={{ marginBottom: 20, borderRadius: 8 }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['contact_channels', 'hotline']}
                    label="Hotline tư vấn"
                  >
                    <Input placeholder="Để trống = dùng hotline từ cài đặt website" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['contact_channels', 'zalo_url']}
                    label="Link Zalo OA / Chat"
                  >
                    <Input placeholder="Để trống = dùng Zalo từ cài đặt website" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['contact_channels', 'email_public']}
                    label="Email hỗ trợ công khai"
                  >
                    <Input placeholder="Để trống = dùng email từ cài đặt website" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['contact_channels', 'messenger_url']}
                    label="Link Facebook Messenger"
                  >
                    <Input placeholder="Để trống = dùng Facebook từ cài đặt website" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 4. Giờ làm việc */}
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>
                    <ClockCircleOutlined style={{ marginRight: 6 }} />
                    Khung Giờ Làm Việc (Giờ Việt Nam)
                  </span>
                  <div>
                    {isCurrentOpen ? (
                      <Tag color="success">Hiện tại: Đang trong giờ làm việc</Tag>
                    ) : (
                      <Tag color="warning">Hiện tại: Ngoài giờ làm việc</Tag>
                    )}
                  </div>
                </div>
              }
              style={{ marginBottom: 20, borderRadius: 8 }}
            >
              {Object.keys(DAY_LABELS).map((dayKey) => (
                <Row
                  key={dayKey}
                  gutter={16}
                  align="middle"
                  style={{ marginBottom: 10, paddingBottom: 6, borderBottom: '1px dashed #f0f0f0' }}
                >
                  <Col span={4}>
                    <Text strong>{DAY_LABELS[dayKey]}</Text>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name={['working_hours', 'days', dayKey, 'off']}
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Checkbox>Nghỉ cả ngày</Checkbox>
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item
                      name={['working_hours', 'days', dayKey, 'from']}
                      label="Bắt đầu"
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="08:00" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item
                      name={['working_hours', 'days', dayKey, 'to']}
                      label="Kết thúc"
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="17:30" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              ))}

              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Form.Item
                    name={['working_hours', 'holiday_note']}
                    label="Ghi chú lịch nghỉ lễ"
                  >
                    <Input placeholder="VD: Nghỉ Tết Nguyên Đán từ 28/01 đến 05/02" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="response_sla_text"
                    label="Cam kết phản hồi (SLA)"
                  >
                    <Input placeholder="VD: Phản hồi trong vòng 15 phút giờ hành chính" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 5. Thông báo hộp thư */}
            <Card
              size="small"
              title={
                <span style={{ fontWeight: 700 }}>
                  <NotificationOutlined style={{ marginRight: 6 }} />
                  Thông Báo Yêu Cầu & Bàn Giao Sales
                </span>
              }
              style={{ marginBottom: 20, borderRadius: 8 }}
            >
              <Form.Item
                name="notify_emails"
                label="Email nhận thông báo yêu cầu mới (Tối đa 10 email)"
                extra="Nhập email và ấn Enter để thêm người nhận"
              >
                <Select
                  mode="tags"
                  placeholder="VD: sales@demo.erp4u.local, hotro@demo.erp4u.local"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="notify_user_ids"
                label="Nhân viên nhận thông báo trong ERP"
                extra="Để trống người nhận trong ERP = gửi cho nhóm có quyền CHATBOT"
              >
                <Select
                  mode="multiple"
                  placeholder="Chọn nhân sự nhận việc từ trợ lý"
                  style={{ width: '100%' }}
                  optionFilterProp="children"
                >
                  {usersList.map((u) => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.full_name} ({u.username})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name={['limits', 'unassigned_alert_min']}
                label="Thời gian cảnh báo yêu cầu chưa xử lý (phút)"
              >
                <InputNumber min={5} max={1440} style={{ width: 160 }} />
              </Form.Item>
            </Card>

            {/* 6. Cấu hình Nâng cao (Collapse) */}
            <Collapse
              style={{ marginBottom: 24, borderRadius: 8, background: '#fff' }}
              items={[
                {
                  key: 'advanced',
                  label: (
                    <span style={{ fontWeight: 700 }}>
                      <SettingOutlined style={{ marginRight: 6 }} />
                      Cấu Hình Kỹ Thuật Nâng Cao & Trạng Thái LLM
                    </span>
                  ),
                  children: (
                    <div>
                      {/* Thẻ trạng thái LLM */}
                      <Card
                        size="small"
                        style={{ marginBottom: 16, background: '#f9f9f9', borderRadius: 8 }}
                      >
                        <Row gutter={16}>
                          <Col span={8}>
                            <Text type="secondary">Nhà cung cấp LLM:</Text>
                            <div>
                              <Tag color="blue">{statusData?.llm_provider || 'fake'}</Tag>
                            </div>
                          </Col>
                          <Col span={8}>
                            <Text type="secondary">Khóa LLM:</Text>
                            <div>
                              {statusData?.llm_key_configured ? (
                                <Tag color="success" icon={<CheckCircleOutlined />}>
                                  Đã cấu hình
                                </Tag>
                              ) : (
                                <Tag color="error" icon={<CloseCircleOutlined />}>
                                  Chưa cấu hình
                                </Tag>
                              )}
                            </div>
                          </Col>
                          <Col span={8}>
                            <Text type="secondary">Lượt gọi hôm nay:</Text>
                            <div>
                              <Text strong style={{ fontSize: 16 }}>
                                {statusData?.llm_calls_today ?? 0}
                              </Text>
                            </div>
                          </Col>
                        </Row>
                      </Card>

                      <Divider orientation="left" plain style={{ margin: '12px 0' }}>
                        Giới Hạn Tần Suất (Rate Limits)
                      </Divider>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item
                            name={['limits', 'session_per_ip_hour']}
                            label="Phiên chat / IP / giờ"
                          >
                            <InputNumber min={1} max={500} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name={['limits', 'msg_per_session_5m']}
                            label="Tin nhắn / phiên / 5p"
                          >
                            <InputNumber min={1} max={200} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name={['limits', 'msg_per_ip_5m']}
                            label="Tin nhắn / IP / 5p"
                          >
                            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name={['limits', 'submit_per_session_hour']}
                            label="Gửi yêu cầu / giờ"
                          >
                            <InputNumber min={1} max={100} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name={['limits', 'upload_per_session_hour']}
                            label="Tải file / giờ"
                          >
                            <InputNumber min={1} max={100} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name={['limits', 'llm_concurrency']}
                            label="LLM đồng thời"
                          >
                            <InputNumber min={1} max={50} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left" plain style={{ margin: '12px 0' }}>
                        Ngân Sách LLM & Thời Gian Chờ
                      </Divider>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            name={['llm', 'daily_call_budget']}
                            label="Hạn mức gọi LLM / ngày"
                          >
                            <InputNumber min={1} max={100000} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name={['llm', 'timeout_ms']}
                            label="Thời gian chờ LLM (ms)"
                          >
                            <InputNumber min={1000} max={120000} step={1000} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left" plain style={{ margin: '12px 0' }}>
                        Lưu Trữ Dữ Liệu (Retention Days)
                      </Divider>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item
                            name={['retention_days', 'chat']}
                            label="Lưu tin nhắn (ngày)"
                          >
                            <InputNumber min={30} max={3650} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name={['retention_days', 'attachment']}
                            label="Lưu file đính kèm (ngày)"
                          >
                            <InputNumber min={30} max={3650} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name={['retention_days', 'request']}
                            label="Lưu yêu cầu (ngày)"
                          >
                            <InputNumber min={30} max={3650} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left" plain style={{ margin: '12px 0' }}>
                        Tính Năng Nghiệp Vụ (Bật theo Phase)
                      </Divider>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Tag color="default">Ước tính giá (P1): Đang khóa</Tag>
                        <Tag color="default">Tra cứu đơn hàng (P4): Đang khóa</Tag>
                        <Tag color="default">Đính kèm file (P4): Đang khóa</Tag>
                        <Tag color="default">Yêu cầu xem mẫu: Đang khóa</Tag>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Col>

          {/* Live Preview Column */}
          <Col xs={24} lg={9}>
            <div style={{ position: 'sticky', top: 20 }}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>👁️</span>
                    <span style={{ fontWeight: 700 }}>Khung Xem Trước Trợ Lý</span>
                  </div>
                }
                bordered
                style={{
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  background: '#fcfcfc',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      margin: '0 auto 12px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      border: '2px solid #fff',
                      background: '#eee',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {avatarUrl ? (
                      <img
                        src={getFullImageUrl(avatarUrl)}
                        alt="Avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <RobotOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
                      {displayName}
                    </h4>
                    <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                      AI
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Tên gọi ngắn: <b>{shortName}</b>
                  </Text>
                </div>

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    border: '1px solid #ebebeb',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 6, fontWeight: 600 }}>
                    BONG BÓNG LỜI CHÀO MỞ ĐẦU:
                  </div>
                  <div
                    style={{
                      background: '#f0f7ff',
                      borderRadius: '12px 12px 12px 2px',
                      padding: '12px 14px',
                      color: '#1a1a1a',
                      fontSize: 13,
                      lineHeight: 1.5,
                      border: '1px solid #d0e7ff',
                    }}
                  >
                    {renderedPreviewGreeting || 'Chưa nhập lời chào...'}
                  </div>
                </div>

                <div
                  style={{
                    background: '#fafafa',
                    borderRadius: 8,
                    padding: 12,
                    border: '1px dashed #d9d9d9',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#555', marginBottom: 4 }}>
                    Kênh hỗ trợ trực tuyến:
                  </div>
                  <div style={{ color: '#888' }}>
                    Hotline: {form.getFieldValue(['contact_channels', 'hotline']) || 'Mặc định website'}
                  </div>
                  <div style={{ color: '#888' }}>
                    Trạng thái giờ làm: {isCurrentOpen ? '🟢 Đang mở cửa' : '🟡 Đã ngoài giờ'}
                  </div>
                </div>
              </Card>
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
