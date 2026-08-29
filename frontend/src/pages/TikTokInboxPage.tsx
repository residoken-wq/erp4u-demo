import React, { useEffect, useState, useRef } from 'react';
import {
    Card, Row, Col, List, Avatar, Input, Button, Badge, Tag, Space,
    Statistic, Spin, Empty, message, Tooltip, Typography
} from 'antd';
import {
    MessageOutlined, SendOutlined, SyncOutlined, UserOutlined,
    InboxOutlined, CheckCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const { Text, Paragraph } = Typography;
const { Search } = Input;

interface Conversation {
    id: number;
    conversation_id: string;
    buyer_name: string;
    buyer_avatar: string;
    buyer_id: string;
    status: string;
    unread_count: number;
    last_message: string;
    last_message_at: string;
    message_count: number;
}

interface Message {
    id: number;
    message_id: string;
    sender_type: 'BUYER' | 'SELLER' | 'SYSTEM';
    content_type: string;
    content: string;
    buyer_name: string;
    buyer_avatar: string;
    platform_created_at: string;
    created_at: string;
}

interface InboxStats {
    total_conversations: number;
    unread_conversations: number;
    total_messages: number;
    today_messages: number;
}

const TikTokInboxPage: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [stats, setStats] = useState<InboxStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [msgLoading, setMsgLoading] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [searchText, setSearchText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchConversations = async () => {
        setLoading(true);
        try {
            const [convRes, statsRes] = await Promise.all([
                axios.get(`${API_URL}/tiktok/inbox/conversations`),
                axios.get(`${API_URL}/tiktok/inbox/stats`),
            ]);
            setConversations(convRes.data);
            setStats(statsRes.data);
        } catch (e) {
            // Silently handle - might not have TikTok connected yet
        }
        setLoading(false);
    };

    const syncConversations = async () => {
        setSyncing(true);
        try {
            await axios.post(`${API_URL}/tiktok/inbox/sync`);
            message.success('Đồng bộ hội thoại thành công');
            await fetchConversations();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi đồng bộ. Kiểm tra kết nối TikTok Shop.');
        }
        setSyncing(false);
    };

    const fetchMessages = async (conv: Conversation) => {
        setSelectedConv(conv);
        setMsgLoading(true);
        try {
            // Sync first, then get local
            await axios.post(`${API_URL}/tiktok/inbox/conversations/${conv.id}/sync`);
            const res = await axios.get(`${API_URL}/tiktok/inbox/conversations/${conv.id}/messages`);
            setMessages(res.data);
        } catch (e) {
            // Try local only
            try {
                const res = await axios.get(`${API_URL}/tiktok/inbox/conversations/${conv.id}/messages`);
                setMessages(res.data);
            } catch {
                setMessages([]);
            }
        }
        setMsgLoading(false);
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedConv) return;
        setSending(true);
        try {
            await axios.post(`${API_URL}/tiktok/inbox/conversations/${selectedConv.id}/reply`, {
                text: replyText,
            });
            setReplyText('');
            // Refresh messages
            const res = await axios.get(`${API_URL}/tiktok/inbox/conversations/${selectedConv.id}/messages`);
            setMessages(res.data);
            message.success('Đã gửi tin nhắn');
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Gửi thất bại');
        }
        setSending(false);
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const filteredConversations = conversations.filter(c =>
        !searchText || c.buyer_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        c.last_message?.toLowerCase().includes(searchText.toLowerCase())
    );

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (mins < 1) return 'Vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        return date.toLocaleDateString('vi-VN');
    };

    return (
        <div>
            {/* Stats Row */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Tổng hội thoại"
                            value={stats?.total_conversations || 0}
                            prefix={<InboxOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Chưa đọc"
                            value={stats?.unread_conversations || 0}
                            valueStyle={{ color: stats?.unread_conversations ? '#ff4d4f' : '#52c41a' }}
                            prefix={<MessageOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Tổng tin nhắn"
                            value={stats?.total_messages || 0}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Hôm nay"
                            value={stats?.today_messages || 0}
                            valueStyle={{ color: '#1890ff' }}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Chat Layout */}
            <Row gutter={16} style={{ height: 'calc(100vh - 300px)', minHeight: 500 }}>
                {/* Conversation List */}
                <Col span={8}>
                    <Card
                        size="small"
                        title={
                            <Space>
                                <img src="https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop-islands/8152caf0.png" alt="TikTok" style={{ width: 20, height: 20 }} />
                                <span>TikTok Inbox</span>
                            </Space>
                        }
                        extra={
                            <Tooltip title="Đồng bộ từ TikTok Shop">
                                <Button
                                    icon={<SyncOutlined spin={syncing} />}
                                    size="small"
                                    onClick={syncConversations}
                                    loading={syncing}
                                >
                                    Sync
                                </Button>
                            </Tooltip>
                        }
                        style={{ height: '100%' }}
                        bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto', padding: 0 }}
                    >
                        <div style={{ padding: '8px 12px' }}>
                            <Search
                                placeholder="Tìm khách hàng..."
                                size="small"
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                            />
                        </div>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                        ) : filteredConversations.length === 0 ? (
                            <Empty
                                description="Chưa có hội thoại"
                                style={{ padding: 40 }}
                            />
                        ) : (
                            <List
                                dataSource={filteredConversations}
                                renderItem={(conv) => (
                                    <List.Item
                                        onClick={() => fetchMessages(conv)}
                                        style={{
                                            cursor: 'pointer',
                                            padding: '10px 16px',
                                            background: selectedConv?.id === conv.id ? '#e6f7ff' : 'transparent',
                                            borderLeft: selectedConv?.id === conv.id ? '3px solid #1890ff' : '3px solid transparent',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <List.Item.Meta
                                            avatar={
                                                <Badge count={conv.unread_count} size="small">
                                                    <Avatar
                                                        src={conv.buyer_avatar}
                                                        icon={<UserOutlined />}
                                                        style={{ backgroundColor: '#fe2c55' }}
                                                    />
                                                </Badge>
                                            }
                                            title={
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text strong style={{ fontSize: 13 }}>
                                                        {conv.buyer_name || 'Khách hàng'}
                                                    </Text>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        {formatTime(conv.last_message_at)}
                                                    </Text>
                                                </div>
                                            }
                                            description={
                                                <Text
                                                    type="secondary"
                                                    ellipsis
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: conv.unread_count > 0 ? 'bold' : 'normal',
                                                    }}
                                                >
                                                    {conv.last_message || 'Chưa có tin nhắn'}
                                                </Text>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </Col>

                {/* Message Area */}
                <Col span={16}>
                    <Card
                        size="small"
                        title={
                            selectedConv ? (
                                <Space>
                                    <Avatar
                                        src={selectedConv.buyer_avatar}
                                        icon={<UserOutlined />}
                                        size="small"
                                        style={{ backgroundColor: '#fe2c55' }}
                                    />
                                    <span>{selectedConv.buyer_name || 'Khách hàng'}</span>
                                    <Tag color="green" style={{ fontSize: 11 }}>{selectedConv.status}</Tag>
                                </Space>
                            ) : (
                                <span style={{ color: '#999' }}>Chọn hội thoại để xem tin nhắn</span>
                            )
                        }
                        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                        bodyStyle={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 0,
                            overflow: 'hidden',
                        }}
                    >
                        {!selectedConv ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Empty description="Chọn một hội thoại từ danh sách bên trái" />
                            </div>
                        ) : (
                            <>
                                {/* Messages */}
                                <div style={{
                                    flex: 1,
                                    overflow: 'auto',
                                    padding: '16px',
                                    background: '#f5f5f5',
                                }}>
                                    {msgLoading ? (
                                        <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="Đang tải..." /></div>
                                    ) : messages.length === 0 ? (
                                        <Empty description="Chưa có tin nhắn" />
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: msg.sender_type === 'SELLER' ? 'flex-end' : 'flex-start',
                                                    marginBottom: 12,
                                                }}
                                            >
                                                {msg.sender_type !== 'SELLER' && (
                                                    <Avatar
                                                        src={msg.buyer_avatar}
                                                        icon={<UserOutlined />}
                                                        size="small"
                                                        style={{ marginRight: 8, backgroundColor: '#fe2c55', flexShrink: 0 }}
                                                    />
                                                )}
                                                <div
                                                    style={{
                                                        maxWidth: '70%',
                                                        padding: '8px 14px',
                                                        borderRadius: msg.sender_type === 'SELLER'
                                                            ? '16px 16px 4px 16px'
                                                            : '16px 16px 16px 4px',
                                                        background: msg.sender_type === 'SELLER' ? '#1890ff' : '#fff',
                                                        color: msg.sender_type === 'SELLER' ? '#fff' : '#333',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                    }}
                                                >
                                                    <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{msg.content}</div>
                                                    <div style={{
                                                        fontSize: 10,
                                                        marginTop: 4,
                                                        opacity: 0.7,
                                                        textAlign: msg.sender_type === 'SELLER' ? 'right' : 'left',
                                                    }}>
                                                        {msg.platform_created_at
                                                            ? new Date(msg.platform_created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                                            : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Reply Input */}
                                <div style={{
                                    padding: '12px 16px',
                                    borderTop: '1px solid #f0f0f0',
                                    display: 'flex',
                                    gap: 8,
                                    background: '#fff',
                                }}>
                                    <Input
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onPressEnter={handleSendReply}
                                        placeholder="Nhập tin nhắn..."
                                        disabled={sending}
                                        style={{ borderRadius: 20 }}
                                    />
                                    <Button
                                        type="primary"
                                        icon={<SendOutlined />}
                                        onClick={handleSendReply}
                                        loading={sending}
                                        disabled={!replyText.trim()}
                                        shape="circle"
                                        style={{ backgroundColor: '#fe2c55', borderColor: '#fe2c55' }}
                                    />
                                </div>
                            </>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TikTokInboxPage;
