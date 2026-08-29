import React, { useEffect, useState } from 'react';
import {
    Card, Table, Button, Tag, Input, Space, Statistic, Row, Col,
    message, Modal, Form, Select, Tooltip, Avatar, Badge, Empty, Spin
} from 'antd';
import {
    CommentOutlined, SyncOutlined, SendOutlined, LikeOutlined,
    SmileOutlined, FrownOutlined, MehOutlined, FilterOutlined,
    EyeOutlined, VideoCameraOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const { TextArea } = Input;
const { Option } = Select;

interface Comment {
    id: number;
    channel_id: number;
    video_id: string;
    comment_id: string;
    parent_comment_id: string | null;
    username: string;
    avatar_url: string;
    text: string;
    like_count: number;
    reply_count: number;
    is_replied: boolean;
    our_reply: string | null;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    platform_created_at: string;
}

interface CommentStats {
    total_comments: number;
    unreplied_comments: number;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    videos_with_comments: number;
}

const TikTokCommentsPage: React.FC = () => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [stats, setStats] = useState<CommentStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [replyModalOpen, setReplyModalOpen] = useState(false);
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [videoIdToSync, setVideoIdToSync] = useState('');
    const [channelIdToSync, setChannelIdToSync] = useState<number | null>(null);
    const [channels, setChannels] = useState<any[]>([]);

    // Filters
    const [filterSentiment, setFilterSentiment] = useState<string>('');
    const [filterReplied, setFilterReplied] = useState<string>('');
    const [filterVideoId, setFilterVideoId] = useState<string>('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filterSentiment) params.sentiment = filterSentiment;
            if (filterReplied) params.is_replied = filterReplied;
            if (filterVideoId) params.video_id = filterVideoId;

            const [commentsRes, statsRes, channelsRes] = await Promise.all([
                axios.get(`${API_URL}/tiktok/comments`, { params }),
                axios.get(`${API_URL}/tiktok/comments/stats`),
                axios.get(`${API_URL}/tiktok/auth/channels`),
            ]);
            setComments(commentsRes.data);
            setStats(statsRes.data);
            setChannels(channelsRes.data);
        } catch (e) {
            // May not have TikTok connected
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [filterSentiment, filterReplied, filterVideoId]);

    const handleSync = async () => {
        if (!channelIdToSync || !videoIdToSync.trim()) {
            message.warning('Vui lòng chọn kênh và nhập Video ID');
            return;
        }
        setSyncing(true);
        try {
            await axios.post(`${API_URL}/tiktok/comments/sync`, {
                channel_id: channelIdToSync,
                video_id: videoIdToSync.trim(),
            });
            message.success('Đồng bộ comments thành công');
            setSyncModalOpen(false);
            setVideoIdToSync('');
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi đồng bộ comments');
        }
        setSyncing(false);
    };

    const handleReply = async () => {
        if (!replyText.trim() || !selectedComment) return;
        setSendingReply(true);
        try {
            await axios.post(`${API_URL}/tiktok/comments/${selectedComment.id}/reply`, {
                text: replyText,
            });
            message.success('Đã trả lời comment');
            setReplyModalOpen(false);
            setReplyText('');
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi trả lời comment');
        }
        setSendingReply(false);
    };

    const openReplyModal = (comment: Comment) => {
        setSelectedComment(comment);
        setReplyText('');
        setReplyModalOpen(true);
    };

    const getSentimentTag = (sentiment: string) => {
        switch (sentiment) {
            case 'POSITIVE':
                return <Tag icon={<SmileOutlined />} color="success">Tích cực</Tag>;
            case 'NEGATIVE':
                return <Tag icon={<FrownOutlined />} color="error">Tiêu cực</Tag>;
            default:
                return <Tag icon={<MehOutlined />} color="default">Trung tính</Tag>;
        }
    };

    const columns = [
        {
            title: 'Người dùng',
            key: 'user',
            width: 160,
            render: (_: any, record: Comment) => (
                <Space>
                    <Avatar src={record.avatar_url} size="small" style={{ backgroundColor: '#fe2c55' }}>
                        {record.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>@{record.username}</span>
                </Space>
            ),
        },
        {
            title: 'Nội dung',
            dataIndex: 'text',
            ellipsis: true,
            render: (text: string, record: Comment) => (
                <div>
                    <div style={{ marginBottom: 4 }}>{text}</div>
                    {record.is_replied && record.our_reply && (
                        <div style={{
                            background: '#e6f7ff',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            borderLeft: '3px solid #1890ff',
                            marginTop: 4,
                        }}>
                            <strong>Đã trả lời:</strong> {record.our_reply}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Video ID',
            dataIndex: 'video_id',
            width: 130,
            render: (id: string) => (
                <Tooltip title={id}>
                    <Tag icon={<VideoCameraOutlined />} color="magenta">
                        {id.length > 10 ? `...${id.slice(-8)}` : id}
                    </Tag>
                </Tooltip>
            ),
        },
        {
            title: 'Cảm xúc',
            dataIndex: 'sentiment',
            width: 110,
            render: (sentiment: string) => getSentimentTag(sentiment),
        },
        {
            title: <LikeOutlined />,
            dataIndex: 'like_count',
            width: 60,
            align: 'center' as const,
            render: (count: number) => <Badge count={count} showZero style={{ backgroundColor: '#ff4d4f' }} />,
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 100,
            render: (_: any, record: Comment) => (
                record.is_replied
                    ? <Tag color="success">Đã trả lời</Tag>
                    : <Tag color="warning">Chưa trả lời</Tag>
            ),
        },
        {
            title: 'Thời gian',
            dataIndex: 'platform_created_at',
            width: 140,
            render: (date: string) => date ? new Date(date).toLocaleString('vi-VN') : '-',
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            render: (_: any, record: Comment) => (
                <Space>
                    <Tooltip title="Trả lời">
                        <Button
                            icon={<SendOutlined />}
                            size="small"
                            type={record.is_replied ? 'default' : 'primary'}
                            onClick={() => openReplyModal(record)}
                            style={!record.is_replied ? { backgroundColor: '#fe2c55', borderColor: '#fe2c55' } : {}}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div>
            {/* Stats */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={4}>
                    <Card size="small">
                        <Statistic
                            title="Tổng comments"
                            value={stats?.total_comments || 0}
                            prefix={<CommentOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic
                            title="Chưa trả lời"
                            value={stats?.unreplied_comments || 0}
                            valueStyle={{ color: stats?.unreplied_comments ? '#ff4d4f' : '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic
                            title="Tích cực"
                            value={stats?.positive_count || 0}
                            prefix={<SmileOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic
                            title="Tiêu cực"
                            value={stats?.negative_count || 0}
                            prefix={<FrownOutlined />}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic
                            title="Trung tính"
                            value={stats?.neutral_count || 0}
                            prefix={<MehOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic
                            title="Số video"
                            value={stats?.videos_with_comments || 0}
                            prefix={<VideoCameraOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters & Actions */}
            <Card
                size="small"
                title={
                    <Space>
                        <img src="https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop-islands/8152caf0.png" alt="TikTok" style={{ width: 20, height: 20 }} />
                        <span>TikTok Comments</span>
                    </Space>
                }
                extra={
                    <Button
                        icon={<SyncOutlined />}
                        onClick={() => setSyncModalOpen(true)}
                        style={{ backgroundColor: '#fe2c55', borderColor: '#fe2c55', color: '#fff' }}
                    >
                        Sync Comments
                    </Button>
                }
            >
                {/* Filter Bar */}
                <Space style={{ marginBottom: 16 }} wrap>
                    <FilterOutlined style={{ color: '#999' }} />
                    <Select
                        placeholder="Cảm xúc"
                        allowClear
                        style={{ width: 140 }}
                        value={filterSentiment || undefined}
                        onChange={(v) => setFilterSentiment(v || '')}
                    >
                        <Option value="POSITIVE"><SmileOutlined style={{ color: '#52c41a' }} /> Tích cực</Option>
                        <Option value="NEGATIVE"><FrownOutlined style={{ color: '#ff4d4f' }} /> Tiêu cực</Option>
                        <Option value="NEUTRAL"><MehOutlined /> Trung tính</Option>
                    </Select>
                    <Select
                        placeholder="Trạng thái"
                        allowClear
                        style={{ width: 140 }}
                        value={filterReplied || undefined}
                        onChange={(v) => setFilterReplied(v || '')}
                    >
                        <Option value="true">Đã trả lời</Option>
                        <Option value="false">Chưa trả lời</Option>
                    </Select>
                    <Input
                        placeholder="Video ID..."
                        style={{ width: 200 }}
                        value={filterVideoId}
                        onChange={(e) => setFilterVideoId(e.target.value)}
                        allowClear
                    />
                </Space>

                <Table
                    dataSource={comments}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} comments` }}
                />
            </Card>

            {/* Reply Modal */}
            <Modal
                title={
                    <Space>
                        <CommentOutlined />
                        Trả lời comment của @{selectedComment?.username}
                    </Space>
                }
                open={replyModalOpen}
                onCancel={() => setReplyModalOpen(false)}
                onOk={handleReply}
                okText="Gửi trả lời"
                okButtonProps={{ loading: sendingReply, style: { backgroundColor: '#fe2c55', borderColor: '#fe2c55' } }}
                width={600}
            >
                {selectedComment && (
                    <div style={{ marginBottom: 16 }}>
                        <Card size="small" style={{ background: '#fafafa' }}>
                            <Space>
                                <Avatar src={selectedComment.avatar_url} size="small">
                                    {selectedComment.username?.[0]?.toUpperCase()}
                                </Avatar>
                                <strong>@{selectedComment.username}</strong>
                                {getSentimentTag(selectedComment.sentiment)}
                            </Space>
                            <p style={{ marginTop: 8, marginBottom: 0 }}>{selectedComment.text}</p>
                        </Card>
                    </div>
                )}
                <TextArea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Nhập nội dung trả lời..."
                />
            </Modal>

            {/* Sync Modal */}
            <Modal
                title="Đồng bộ Comments từ Video"
                open={syncModalOpen}
                onCancel={() => setSyncModalOpen(false)}
                onOk={handleSync}
                okText="Đồng bộ"
                okButtonProps={{ loading: syncing }}
            >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Kênh TikTok</label>
                        <Select
                            placeholder="Chọn kênh TikTok"
                            style={{ width: '100%' }}
                            value={channelIdToSync}
                            onChange={(v) => setChannelIdToSync(v)}
                        >
                            {channels.map(ch => (
                                <Option key={ch.id} value={ch.id}>{ch.shop_name} (#{ch.id})</Option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Video ID</label>
                        <Input
                            placeholder="Nhập TikTok Video ID..."
                            value={videoIdToSync}
                            onChange={(e) => setVideoIdToSync(e.target.value)}
                        />
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            Lấy Video ID từ URL video TikTok (số cuối trong URL)
                        </div>
                    </div>
                </Space>
            </Modal>
        </div>
    );
};

export default TikTokCommentsPage;
