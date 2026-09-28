import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Badge,
  Alert,
  Avatar,
  Typography,
  Space,
  Divider,
  Descriptions,
  Collapse,
  Empty,
  Spin,
  message,
} from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  RobotOutlined,
  CustomerServiceOutlined,
  InfoCircleOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface ConversationItem {
  id: string;
  public_code: string;
  state: string;
  intent: string | null;
  segment: string | null;
  human_active: boolean;
  assigned_user_id: number | null;
  unread_staff: number;
  last_message_at: string | null;
  request_codes: string[];
}

interface MessageItem {
  id: string;
  role: 'customer' | 'ai' | 'staff' | 'system';
  text: string;
  sender_user_id?: number | null;
  created_at: string;
  payload?: any;
}

interface BriefItem {
  revision: number;
  data: Record<string, any>;
  changed_by: string;
  created_at: string;
}

interface RequestItem {
  id: string;
  code: string;
  type: string;
  status: string;
  summary: string;
  contact?: Record<string, any>;
  created_at: string;
}

interface ConversationDetail {
  conversation: ConversationItem;
  messages: MessageItem[];
  briefs: BriefItem[];
  requests: RequestItem[];
}

const STATE_COLORS: Record<string, string> = {
  new: 'default',
  collecting: 'processing',
  request_review: 'warning',
  submitted: 'success',
  waiting_sales: 'error',
  finished: 'default',
};

const STATE_LABELS: Record<string, string> = {
  new: 'Mới tạo',
  collecting: 'Đang thu thập',
  request_review: 'Xem lại brief',
  submitted: 'Đã gửi yêu cầu',
  waiting_sales: 'Chờ nhân viên',
  finished: 'Hoàn tất',
};

const ChatbotInboxPage: React.FC = () => {
  const { id: urlConvId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(urlConvId || null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [failedCount, setFailedCount] = useState<number>(0);

  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [sendingMsg, setSendingMsg] = useState<boolean>(false);
  const [runningOutbox, setRunningOutbox] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [unassignedFilter, setUnassignedFilter] = useState<boolean | undefined>(undefined);
  const [humanActiveFilter, setHumanActiveFilter] = useState<boolean | undefined>(undefined);

  const [msgText, setMsgText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [detail?.messages]);

  // Load Outbox failed count
  const fetchOutboxStatus = useCallback(async () => {
    try {
      const res = await api.get('/chatbot/admin/inbox/outbox');
      setFailedCount(res.data?.failed_count || 0);
    } catch {
      // Ignore
    }
  }, []);

  // Run Outbox
  const handleRunOutbox = async () => {
    try {
      setRunningOutbox(true);
      const res = await api.post('/chatbot/admin/inbox/outbox/run');
      message.success(`Đã xử lý: ${res.data?.sent || 0} gửi thành công, ${res.data?.failed || 0} lỗi.`);
      fetchOutboxStatus();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể chạy lại hàng đợi gửi tin');
    } finally {
      setRunningOutbox(false);
    }
  };

  // Fetch Conversation List
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingList(true);
      const params: any = { limit: 50 };
      if (searchQuery) params.q = searchQuery;
      if (stateFilter) params.state = stateFilter;
      if (unassignedFilter !== undefined) params.unassigned = unassignedFilter;
      if (humanActiveFilter !== undefined) params.human_active = humanActiveFilter;

      const res = await api.get('/chatbot/admin/inbox/conversations', { params });
      const items: ConversationItem[] = res.data?.items || [];
      setConversations(items);

      // Auto-select first if none selected
      if (!selectedId && items.length > 0) {
        setSelectedId(items[0].id);
        navigate(`/chatbot/inbox/${items[0].id}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingList(false);
    }
  }, [searchQuery, stateFilter, unassignedFilter, humanActiveFilter, selectedId, navigate]);

  // Fetch Conversation Detail
  const fetchDetail = useCallback(async (convId: string) => {
    if (!convId) return;
    try {
      setLoadingDetail(true);
      const res = await api.get(`/chatbot/admin/inbox/conversations/${convId}`);
      setDetail(res.data);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải chi tiết cuộc hội thoại');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
    fetchOutboxStatus();
  }, [fetchConversations, fetchOutboxStatus]);

  // On selectedId change
  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
    }
  }, [selectedId, fetchDetail]);

  // URL id change sync
  useEffect(() => {
    if (urlConvId && urlConvId !== selectedId) {
      setSelectedId(urlConvId);
    }
  }, [urlConvId, selectedId]);

  // Polling every 5s if visible
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchConversations();
        if (selectedId) {
          fetchDetail(selectedId);
        }
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchConversations, fetchDetail, selectedId]);

  // Take conversation
  const handleTake = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/chatbot/admin/inbox/conversations/${selectedId}/take`);
      message.success('Đã nhận xử lý cuộc hội thoại này');
      fetchDetail(selectedId);
      fetchConversations();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi nhận xử lý');
    }
  };

  // Release conversation
  const handleRelease = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/chatbot/admin/inbox/conversations/${selectedId}/release`);
      message.success('Đã trả lại quyền cho bot tự động');
      fetchDetail(selectedId);
      fetchConversations();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi trả lại bot');
    }
  };

  // Send staff message
  const handleSendMessage = async () => {
    if (!selectedId || !msgText.trim()) return;
    try {
      setSendingMsg(true);
      await api.post(`/chatbot/admin/inbox/conversations/${selectedId}/messages`, {
        text: msgText.trim(),
      });
      setMsgText('');
      fetchDetail(selectedId);
      fetchConversations();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể gửi tin nhắn');
    } finally {
      setSendingMsg(false);
    }
  };

  // Format date helper
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const selectedConv = detail?.conversation || conversations.find((c) => c.id === selectedId);

  return (
    <div style={{ padding: '16px 20px', height: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column' }}>
      {/* Alert if Outbox has failed rows */}
      {failedCount > 0 && (
        <Alert
          type="error"
          showIcon
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <b>Cảnh báo:</b> Có {failedCount} email/thông báo gửi thất bại trong hàng đợi Outbox!
              </span>
              <Button
                size="small"
                danger
                type="primary"
                loading={runningOutbox}
                onClick={handleRunOutbox}
              >
                Gửi lại ngay
              </Button>
            </div>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        {/* Left Column: Conversation List */}
        <Col span={7} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card
            bodyStyle={{ padding: 12, display: 'flex', flexDirection: 'column', height: '100%' }}
            style={{ height: '100%' }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  Hộp thư hội thoại
                </Title>
                <Button
                  size="small"
                  type="text"
                  icon={<SyncOutlined spin={loadingList} />}
                  onClick={() => fetchConversations()}
                />
              </div>

              <Input
                placeholder="Tìm mã phiên, mã YC..."
                prefix={<SearchOutlined style={{ color: '#aaa' }} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                style={{ marginBottom: 8 }}
              />

              <Space orientation="horizontal" size={6} wrap style={{ width: '100%' }}>
                <Select
                  size="small"
                  placeholder="Trạng thái"
                  value={stateFilter || undefined}
                  onChange={(val) => setStateFilter(val || '')}
                  allowClear
                  style={{ width: 120 }}
                  options={[
                    { label: 'Tất cả trạng thái', value: '' },
                    { label: 'Mới tạo', value: 'new' },
                    { label: 'Đang thu thập', value: 'collecting' },
                    { label: 'Xem lại brief', value: 'request_review' },
                    { label: 'Đã gửi yêu cầu', value: 'submitted' },
                    { label: 'Chờ nhân viên', value: 'waiting_sales' },
                  ]}
                />

                <Select
                  size="small"
                  placeholder="Xử lý"
                  value={
                    humanActiveFilter !== undefined
                      ? humanActiveFilter
                        ? 'human'
                        : 'bot'
                      : unassignedFilter
                      ? 'unassigned'
                      : undefined
                  }
                  onChange={(val) => {
                    if (val === 'human') {
                      setHumanActiveFilter(true);
                      setUnassignedFilter(undefined);
                    } else if (val === 'bot') {
                      setHumanActiveFilter(false);
                      setUnassignedFilter(undefined);
                    } else if (val === 'unassigned') {
                      setUnassignedFilter(true);
                      setHumanActiveFilter(undefined);
                    } else {
                      setHumanActiveFilter(undefined);
                      setUnassignedFilter(undefined);
                    }
                  }}
                  allowClear
                  style={{ width: 130 }}
                  options={[
                    { label: 'Tất cả', value: '' },
                    { label: 'Người xử lý', value: 'human' },
                    { label: 'Bot tự động', value: 'bot' },
                    { label: 'Chưa ai nhận', value: 'unassigned' },
                  ]}
                />
              </Space>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* List Items */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingList && conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30 }}>
                  <Spin />
                </div>
              ) : conversations.length === 0 ? (
                <Empty description="Không có cuộc hội thoại nào" style={{ marginTop: 40 }} />
              ) : (
                conversations.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        navigate(`/chatbot/inbox/${item.id}`);
                      }}
                      style={{
                        padding: '10px 12px',
                        marginBottom: 6,
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: isSelected ? '#e6f4ff' : '#fafafa',
                        border: isSelected ? '1px solid #91caff' : '1px solid #f0f0f0',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={6}>
                          <Text strong style={{ fontSize: 14 }}>
                            {item.public_code}
                          </Text>
                          {item.human_active ? (
                            <Tag color="green" style={{ fontSize: 11, padding: '0 4px', margin: 0 }}>
                              Nhân viên
                            </Tag>
                          ) : (
                            <Tag color="cyan" style={{ fontSize: 11, padding: '0 4px', margin: 0 }}>
                              Bot
                            </Tag>
                          )}
                        </Space>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {formatDate(item.last_message_at)}
                        </Text>
                      </div>

                      <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag color={STATE_COLORS[item.state] || 'default'} style={{ fontSize: 11, margin: 0 }}>
                          {STATE_LABELS[item.state] || item.state}
                        </Tag>

                        {item.unread_staff > 0 && (
                          <Badge count={item.unread_staff} style={{ backgroundColor: '#f5222d' }} />
                        )}
                      </div>

                      {item.request_codes && item.request_codes.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {item.request_codes.map((rc) => (
                            <Tag key={rc} color="orange" style={{ fontSize: 11, padding: '0 4px', margin: 0 }}>
                              {rc}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </Col>

        {/* Center Column: Chat Stream */}
        <Col span={10} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card
            bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
            style={{ height: '100%' }}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <Space size={8}>
                  <Title level={5} style={{ margin: 0 }}>
                    {selectedConv ? `Phiên ${selectedConv.public_code}` : 'Chi tiết cuộc hội thoại'}
                  </Title>
                  {selectedConv && (
                    <Tag color={STATE_COLORS[selectedConv.state] || 'default'}>
                      {STATE_LABELS[selectedConv.state] || selectedConv.state}
                    </Tag>
                  )}
                </Space>
              </div>

              {selectedConv && (
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => selectedId && fetchDetail(selectedId)}
                >
                  Làm mới
                </Button>
              )}
            </div>

            {/* Messages Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                background: '#f9f9fb',
              }}
            >
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                  <Spin tip="Đang tải tin nhắn..." />
                </div>
              ) : !detail || !detail.messages || detail.messages.length === 0 ? (
                <Empty description="Chưa có tin nhắn trong hội thoại này" style={{ marginTop: 60 }} />
              ) : (
                detail.messages.map((m) => {
                  const isCustomer = m.role === 'customer';
                  const isAi = m.role === 'ai';
                  const isStaff = m.role === 'staff';
                  const isSystem = m.role === 'system';

                  if (isSystem) {
                    return (
                      <div key={m.id} style={{ textAlign: 'center', margin: '10px 0' }}>
                        <Tag color="#d9d9d9" style={{ color: '#555', whiteSpace: 'pre-wrap', padding: '4px 10px' }}>
                          {m.text}
                        </Tag>
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{formatDate(m.created_at)}</div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        flexDirection: isStaff ? 'row-reverse' : 'row',
                        marginBottom: 14,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Avatar
                        size="small"
                        icon={isCustomer ? <UserOutlined /> : isAi ? <RobotOutlined /> : <CustomerServiceOutlined />}
                        style={{
                          backgroundColor: isCustomer ? '#1677ff' : isAi ? '#722ed1' : '#52c41a',
                          margin: isStaff ? '0 0 0 8px' : '0 8px 0 0',
                        }}
                      />
                      <div style={{ maxWidth: '78%' }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#8c8c8c',
                            marginBottom: 2,
                            textAlign: isStaff ? 'right' : 'left',
                          }}
                        >
                          {isCustomer ? 'Khách hàng' : isAi ? 'Cừu ERP4U (AI)' : 'Nhân viên hỗ trợ'} ·{' '}
                          {formatDate(m.created_at)}
                        </div>

                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: 13,
                            lineHeight: 1.5,
                            background: isCustomer ? '#e6f4ff' : isAi ? '#fff' : '#f6ffed',
                            color: isCustomer ? '#003eb3' : '#262626',
                            border: isCustomer
                              ? '1px solid #bae0ff'
                              : isAi
                              ? '1px solid #e8e8e8'
                              : '1px solid #b7eb8f',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          {m.text}

                          {/* Render summary card if payload exists */}
                          {m.payload && m.payload.type === 'summary' && (
                            <Card
                              size="small"
                              style={{
                                marginTop: 8,
                                background: '#fafafa',
                                border: '1px solid #d9d9d9',
                                borderRadius: 6,
                              }}
                            >
                              <Text strong style={{ fontSize: 12 }}>
                                📋 Tóm tắt nhu cầu (Bản #{m.payload.brief_revision}):
                              </Text>
                              <div style={{ marginTop: 4, fontSize: 12 }}>
                                {m.payload.fields?.quantity && (
                                  <div>
                                    <b>Số lượng:</b> {m.payload.fields.quantity} bộ
                                  </div>
                                )}
                                {m.payload.fields?.items && (
                                  <div>
                                    <b>Mặt hàng:</b> {m.payload.fields.items.join(', ')}
                                  </div>
                                )}
                                {m.payload.fields?.colors && (
                                  <div>
                                    <b>Màu sắc:</b> {m.payload.fields.colors}
                                  </div>
                                )}
                              </div>
                            </Card>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', background: '#fff' }}>
              {selectedConv?.human_active ? (
                <div>
                  <TextArea
                    rows={2}
                    placeholder="Nhập tin nhắn trả lời khách hàng (Enter để gửi)..."
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={sendingMsg}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Nhân viên gửi tin sẽ làm bot im lặng. Nhấn Shift+Enter để xuống dòng.
                    </Text>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={sendingMsg}
                      onClick={handleSendMessage}
                      disabled={!msgText.trim()}
                    >
                      Gửi tin
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    🤖 Hội thoại đang do Bot xử lý tự động. Nhấn <b>Nhận xử lý</b> ở cột bên phải để tiếp quản và nhắn tin trực tiếp.
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Right Column: Brief & Requests info */}
        <Col span={7} style={{ height: '100%', overflowY: 'auto' }}>
          <Card
            title={
              <Space>
                <InfoCircleOutlined />
                <span>Thông tin & Thao tác</span>
              </Space>
            }
            bodyStyle={{ padding: 14 }}
          >
            {/* Take / Release Actions */}
            <div style={{ marginBottom: 16 }}>
              {selectedConv?.human_active ? (
                <Button
                  block
                  danger
                  onClick={handleRelease}
                  icon={<SyncOutlined />}
                  style={{ height: 38 }}
                >
                  Trả lại cho Bot tự động
                </Button>
              ) : (
                <Button
                  block
                  type="primary"
                  onClick={handleTake}
                  icon={<CheckCircleOutlined />}
                  style={{ height: 38, background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Nhận xử lý hội thoại
                </Button>
              )}
            </div>

            {/* Current Brief */}
            <Title level={5} style={{ fontSize: 13, marginBottom: 8 }}>
              📋 Thông tin nhu cầu (Brief)
            </Title>
            {detail?.briefs && detail.briefs.length > 0 ? (
              <div>
                <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Phiên bản">
                    #{detail.briefs[0].revision} (bởi {detail.briefs[0].changed_by})
                  </Descriptions.Item>
                  <Descriptions.Item label="Phân khúc">
                    {detail.briefs[0].data?.segment === 'school'
                      ? 'Trường mầm non'
                      : detail.briefs[0].data?.segment === 'parent'
                      ? 'Phụ huynh'
                      : detail.briefs[0].data?.segment || 'Chưa rõ'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Số lượng">
                    {detail.briefs[0].data?.quantity ? `${detail.briefs[0].data.quantity} bộ` : 'Chưa có'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Mặt hàng">
                    {detail.briefs[0].data?.items?.join(', ') || 'Chưa có'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Màu sắc">
                    {detail.briefs[0].data?.colors || 'Chưa có'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tên trường">
                    {detail.briefs[0].data?.school_name || 'Chưa có'}
                  </Descriptions.Item>
                </Descriptions>

                {/* Brief revision history */}
                {detail.briefs.length > 1 && (
                  <Collapse size="small" style={{ marginBottom: 16 }}>
                    <Panel header={`Lịch sử chỉnh sửa (${detail.briefs.length} bản)`} key="hist">
                      {detail.briefs.map((b) => (
                        <div
                          key={b.revision}
                          style={{
                            padding: '6px 0',
                            borderBottom: '1px solid #f0f0f0',
                            fontSize: 11,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong>Bản #{b.revision}</Text>
                            <Text type="secondary">{formatDate(b.created_at)}</Text>
                          </div>
                          <div>Sửa bởi: {b.changed_by}</div>
                          <Paragraph
                            ellipsis={{ rows: 2, expandable: true }}
                            style={{ margin: 0, color: '#666', fontSize: 11 }}
                          >
                            {JSON.stringify(b.data)}
                          </Paragraph>
                        </div>
                      ))}
                    </Panel>
                  </Collapse>
                )}
              </div>
            ) : (
              <Empty description="Chưa có brief nào" style={{ margin: '16px 0' }} />
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* Created Requests */}
            <Title level={5} style={{ fontSize: 13, marginBottom: 8 }}>
              📄 Yêu cầu tư vấn đã tạo ({detail?.requests?.length || 0})
            </Title>
            {detail?.requests && detail.requests.length > 0 ? (
              detail.requests.map((r) => (
                <Card
                  key={r.id}
                  size="small"
                  style={{ marginBottom: 8, background: '#fdfdfd' }}
                  actions={[
                    <Link to={`/chatbot/requests/${r.id}`} key="view">
                      <Space size={4}>
                        <LinkOutlined />
                        <span>Xem chi tiết</span>
                      </Space>
                    </Link>,
                  ]}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ color: '#1677ff' }}>
                      {r.code}
                    </Text>
                    <Tag color={r.status === 'received' ? 'blue' : 'green'}>{r.status}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                    <b>Tóm tắt:</b> {r.summary || 'Không có'}
                  </div>
                  {r.contact && (
                    <div style={{ fontSize: 11, color: '#888' }}>
                      Liên hệ: {r.contact.name || ''} ({r.contact.phone || r.contact.preferred_channel})
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <Empty description="Chưa có yêu cầu nào" style={{ margin: '16px 0' }} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ChatbotInboxPage;
