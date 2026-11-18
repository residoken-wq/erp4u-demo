import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Drawer,
  Form,
  Space,
  Typography,
  Descriptions,
  DatePicker,
  Row,
  Col,
  message,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  SaveOutlined,
  UserOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../utils/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface RequestRow {
  id: string;
  code: string;
  type: string;
  status: string;
  owner_user_id: number | null;
  customer_id: number | null;
  summary: string;
  created_at: string;
}

interface RequestDetail extends RequestRow {
  conversation_id: string;
  brief_revision: number;
  contact: {
    name?: string;
    phone?: string;
    email?: string;
    zalo?: string;
    preferred_channel?: string;
  };
  customer?: {
    id: number;
    code: string;
    name: string;
    phone?: string;
  };
  internal_note?: string;
  promised_due_at?: string | null;
}

const STATUS_TAGS: Record<string, { color: string; label: string }> = {
  received: { color: 'blue', label: 'Mới tiếp nhận' },
  assigned: { color: 'purple', label: 'Đã phân công' },
  contacted: { color: 'cyan', label: 'Đã liên hệ' },
  quoted: { color: 'orange', label: 'Đã báo giá' },
  closed: { color: 'green', label: 'Hoàn tất / Đã chốt' },
  cancelled: { color: 'red', label: 'Đã hủy' },
};

// Valid transitions: received -> assigned -> contacted -> quoted -> closed; cancelled from any
const ALLOWED_NEXT_STATUS: Record<string, string[]> = {
  received: ['assigned', 'cancelled'],
  assigned: ['contacted', 'cancelled'],
  contacted: ['quoted', 'cancelled'],
  quoted: ['closed', 'cancelled'],
  closed: ['cancelled'],
  cancelled: [],
};

const ChatbotRequestsPage: React.FC = () => {
  const { id: urlReqId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ownerFilter, setOwnerFilter] = useState<string>('');

  // Users for owner dropdown
  const [users, setUsers] = useState<Array<{ id: number; full_name: string; username: string }>>([]);

  // Drawer detail state
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const [form] = Form.useForm();

  // Fetch Users
  useEffect(() => {
    api
      .get('/users')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setUsers(res.data);
        } else if (Array.isArray(res.data?.items)) {
          setUsers(res.data.items);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Request List
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit };
      if (searchQuery) params.q = searchQuery;
      if (statusFilter) params.status = statusFilter;
      if (ownerFilter) params.owner = ownerFilter;

      const res = await api.get('/chatbot/admin/inbox/requests', { params });
      setRequests(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải danh sách yêu cầu');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter, ownerFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Fetch Request Detail
  const openDetail = useCallback(
    async (reqId: string) => {
      try {
        setDetailLoading(true);
        setDrawerOpen(true);
        const res = await api.get(`/chatbot/admin/inbox/requests/${reqId}`);
        const data: RequestDetail = res.data;
        setDetail(data);

        form.setFieldsValue({
          status: data.status,
          owner_user_id: data.owner_user_id || undefined,
          internal_note: data.internal_note || '',
          promised_due_at: data.promised_due_at ? dayjs(data.promised_due_at) : undefined,
        });
      } catch (err: any) {
        message.error(err.response?.data?.message || 'Không thể tải chi tiết yêu cầu');
        setDrawerOpen(false);
      } finally {
        setDetailLoading(false);
      }
    },
    [form]
  );

  // If url has ID, open it
  useEffect(() => {
    if (urlReqId) {
      openDetail(urlReqId);
    }
  }, [urlReqId, openDetail]);

  // Handle Save
  const handleSaveDetail = async () => {
    if (!detail) return;
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload: any = {
        status: values.status,
        owner_user_id: values.owner_user_id || null,
        internal_note: values.internal_note || '',
        promised_due_at: values.promised_due_at ? values.promised_due_at.toISOString() : null,
      };

      const res = await api.put(`/chatbot/admin/inbox/requests/${detail.id}`, payload);
      message.success('Cập nhật yêu cầu thành công');
      setDetail(res.data);
      fetchRequests();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi cập nhật yêu cầu');
    } finally {
      setSaving(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDetail(null);
    if (urlReqId) {
      navigate('/chatbot/requests', { replace: true });
    }
  };

  // Format date helper
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    return dayjs(isoString).format('DD/MM/YYYY HH:mm');
  };

  const columns = [
    {
      title: 'Mã yêu cầu',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (code: string, row: RequestRow) => (
        <a
          onClick={() => {
            navigate(`/chatbot/requests/${row.id}`);
            openDetail(row.id);
          }}
          style={{ fontWeight: 600, color: '#1677ff' }}
        >
          {code}
        </a>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => {
        const conf = STATUS_TAGS[status] || { color: 'default', label: status };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: 'Tóm tắt nhu cầu',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
    },
    {
      title: 'Người phụ trách',
      dataIndex: 'owner_user_id',
      key: 'owner_user_id',
      width: 160,
      render: (ownerId: number | null) => {
        if (!ownerId) return <Text type="secondary">Chưa phân công</Text>;
        const u = users.find((x) => x.id === ownerId);
        return <span>{u?.full_name || `User #${ownerId}`}</span>;
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => formatDate(val),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      render: (_: any, row: RequestRow) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            navigate(`/chatbot/requests/${row.id}`);
            openDetail(row.id);
          }}
        >
          Xem
        </Button>
      ),
    },
  ];

  // Options for Status transition in Drawer
  const currentStatus = detail?.status || 'received';
  const allowedNext = ALLOWED_NEXT_STATUS[currentStatus] || [];
  const statusOptions = [
    { label: `${STATUS_TAGS[currentStatus]?.label || currentStatus} (Hiện tại)`, value: currentStatus },
    ...allowedNext.map((st) => ({
      label: STATUS_TAGS[st]?.label || st,
      value: st,
    })),
  ];

  return (
    <div style={{ padding: 20 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            Quản lý yêu cầu tư vấn & báo giá
          </Title>
          <Button icon={<ReloadOutlined />} onClick={fetchRequests}>
            Làm mới
          </Button>
        </div>

        {/* Filters */}
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="Tìm mã YC, SĐT khách..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={fetchRequests}
              allowClear
            />
          </Col>
          <Col span={5}>
            <Select
              placeholder="Lọc trạng thái"
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
              allowClear
              style={{ width: '100%' }}
              options={[
                { label: 'Tất cả trạng thái', value: '' },
                { label: 'Mới tiếp nhận', value: 'received' },
                { label: 'Đã phân công', value: 'assigned' },
                { label: 'Đã liên hệ', value: 'contacted' },
                { label: 'Đã báo giá', value: 'quoted' },
                { label: 'Hoàn tất', value: 'closed' },
                { label: 'Đã hủy', value: 'cancelled' },
              ]}
            />
          </Col>
          <Col span={5}>
            <Select
              placeholder="Lọc người phụ trách"
              value={ownerFilter || undefined}
              onChange={(val) => setOwnerFilter(val || '')}
              allowClear
              style={{ width: '100%' }}
              options={[
                { label: 'Tất cả người phụ trách', value: '' },
                { label: 'Chưa phân công', value: 'unassigned' },
                ...users.map((u) => ({
                  label: u.full_name || u.username,
                  value: String(u.id),
                })),
              ]}
            />
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Button type="primary" onClick={fetchRequests}>
              Áp dụng lọc
            </Button>
          </Col>
        </Row>

        <Table
          dataSource={requests}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setLimit(ps);
            },
            showSizeChanger: true,
          }}
        />
      </Card>

      {/* Drawer Detail */}
      <Drawer
        title={
          <Space>
            <span>Chi tiết yêu cầu:</span>
            <Text strong style={{ color: '#1677ff' }}>
              {detail?.code}
            </Text>
          </Space>
        }
        width={560}
        open={drawerOpen}
        onClose={closeDrawer}
        loading={detailLoading}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveDetail}>
            Lưu thay đổi
          </Button>
        }
      >
        {detail && (
          <div>
            {/* Quick Links */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
              {detail.conversation_id && (
                <Link to={`/chatbot/inbox/${detail.conversation_id}`}>
                  <Button icon={<MessageOutlined />} size="small">
                    Mở hội thoại chat
                  </Button>
                </Link>
              )}

              {detail.customer && (
                <Link to={`/customers?q=${detail.customer.phone || detail.customer.code}`}>
                  <Button icon={<UserOutlined />} size="small" type="dashed">
                    Xem Lead CRM: {detail.customer.code}
                  </Button>
                </Link>
              )}
            </div>

            <Descriptions size="small" bordered column={1} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Mã yêu cầu">{detail.code}</Descriptions.Item>
              <Descriptions.Item label="Loại yêu cầu">{detail.type}</Descriptions.Item>
              <Descriptions.Item label="Tóm tắt nhu cầu">{detail.summary}</Descriptions.Item>
              <Descriptions.Item label="Thời gian tạo">{formatDate(detail.created_at)}</Descriptions.Item>

              {/* Contact info */}
              <Descriptions.Item label="Họ tên người liên hệ">
                {detail.contact?.name || 'Chưa cung cấp'}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {detail.contact?.phone ? (
                  <Text strong style={{ color: '#1677ff' }}>
                    {detail.contact.phone}
                  </Text>
                ) : (
                  'Không có'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Kênh liên hệ ưu tiên">
                <Tag color="blue">{detail.contact?.preferred_channel || 'phone'}</Tag>
              </Descriptions.Item>
              {detail.contact?.email && (
                <Descriptions.Item label="Email">{detail.contact.email}</Descriptions.Item>
              )}
              {detail.contact?.zalo && (
                <Descriptions.Item label="Zalo">{detail.contact.zalo}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 13 }}>
              Cập nhật xử lý
            </Divider>

            <Form form={form} layout="vertical">
              <Form.Item
                name="status"
                label="Trạng thái xử lý"
                rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
                help="Trạng thái chỉ được chuyển tiến theo quy trình hoặc chuyển sang Đã hủy."
              >
                <Select options={statusOptions} />
              </Form.Item>

              <Form.Item name="owner_user_id" label="Nhân viên phụ trách">
                <Select
                  placeholder="Chọn nhân viên phụ trách"
                  allowClear
                  options={users.map((u) => ({
                    label: `${u.full_name} (@${u.username})`,
                    value: u.id,
                  }))}
                />
              </Form.Item>

              <Form.Item name="promised_due_at" label="Hạn hẹn phản hồi khách hàng">
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="internal_note" label="Ghi chú nội bộ (Bảo mật, khách hàng không thấy)">
                <TextArea rows={4} placeholder="Nhập ghi chú theo dõi đơn, báo giá, yêu cầu riêng..." />
              </Form.Item>
            </Form>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ChatbotRequestsPage;
