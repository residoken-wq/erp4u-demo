import React, { useEffect, useState } from 'react';
import { Card, Button, Avatar, Tag, Form, message, Typography, Divider, List, Input, Space, Tooltip, Spin, Modal } from 'antd';
import { ArrowLeftOutlined, CommentOutlined, CheckCircleOutlined, DeleteOutlined, UserOutlined, ClockCircleOutlined, FlagOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api from '../utils/api';
import RichTextEditor from '../components/common/RichTextEditor';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

const DiscussionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [discussion, setDiscussion] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [commentContent, setCommentContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = currentUser.username === 'admin' || (currentUser.role === 'ADMIN');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/discussions/${id}`);
            setDiscussion(res.data);
        } catch (e) {
            message.error('Không thể tải thông tin thảo luận');
            navigate('/workspace?tab=discussions');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const handleAddComment = async () => {
        if (!commentContent.trim()) {
            return message.warning('Vui lòng nhập nội dung bình luận');
        }
        setSubmitting(true);
        try {
            await api.post(`/discussions/${id}/comments`, {
                content: commentContent,
                user_id: currentUser.id
            });
            message.success('Đã gửi bình luận');
            setCommentContent('');
            fetchData();
        } catch (e) {
            message.error('Gửi bình luận thất bại');
        }
        setSubmitting(false);
    };

    const handleReview = async () => {
        try {
            await api.put(`/discussions/${id}/review`);
            message.success('Đã duyệt thảo luận');
            fetchData();
        } catch (e) {
            message.error('Duyệt thảo luận thất bại');
        }
    };

    const handleDeleteDiscussion = async () => {
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: 'Bạn có chắc chắn muốn xóa thảo luận này?',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await api.delete(`/discussions/${id}`);
                    message.success('Đã xóa thảo luận');
                    navigate('/workspace?tab=discussions');
                } catch (e) {
                    message.error('Xóa thất bại');
                }
            }
        });
    };

    const handleDeleteComment = async (commentId: number) => {
        try {
            await api.delete(`/discussions/comments/${commentId}`);
            message.success('Đã xóa bình luận');
            fetchData();
        } catch (e) {
            message.error('Xóa bình luận thất bại');
        }
    };

    if (loading && !discussion) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    if (!discussion) return null;

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 50 }}>
            <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/workspace?tab=discussions')} 
                style={{ marginBottom: 16 }}
            >
                Quay lại
            </Button>

            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Title level={4} style={{ margin: 0 }}>{discussion.title}</Title>
                            {discussion.is_pinned && <Tooltip title="Ghim"><FlagOutlined style={{ color: '#f5222d' }} /></Tooltip>}
                            {discussion.type === 'ANNOUNCEMENT' && <Tag color="volcano">Thông báo</Tag>}
                            {!discussion.is_reviewed && <Tag color="warning">Chưa duyệt</Tag>}
                            {discussion.group && <Tag color="blue">{discussion.group.name}</Tag>}
                        </div>
                        <Space>
                            {isAdmin && !discussion.is_reviewed && (
                                <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleReview}>Duyệt</Button>
                            )}
                            {(isAdmin || discussion.creator_id === currentUser.id) && (
                                <Button icon={<DeleteOutlined />} danger onClick={handleDeleteDiscussion}>Xóa</Button>
                            )}
                        </Space>
                    </div>
                }
            >
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                    <Text strong>{discussion.creator?.full_name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {dayjs(discussion.created_at).fromNow()}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>• {discussion.views_count} lượt xem</Text>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <div 
                    className="ck-content"
                    style={{ minHeight: 150, padding: '10px 0' }}
                    dangerouslySetInnerHTML={{ __html: discussion.content }} 
                />
            </Card>

            <div style={{ marginTop: 24 }}>
                <Title level={5}><CommentOutlined /> Bình luận ({discussion.comments?.length || 0})</Title>
                
                <List
                    dataSource={discussion.comments || []}
                    itemLayout="horizontal"
                    renderItem={(item: any) => (
                        <Card size="small" style={{ marginBottom: 12, border: 'none', background: '#f9f9f9', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <Avatar size="small" style={{ backgroundColor: '#87d068' }}>{item.user?.full_name?.charAt(0)}</Avatar>
                                    <div>
                                        <Text strong>{item.user?.full_name}</Text>
                                        <div style={{ margin: '4px 0' }} dangerouslySetInnerHTML={{ __html: item.content }} />
                                        <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(item.created_at).fromNow()}</Text>
                                    </div>
                                </div>
                                {(isAdmin || item.user_id === currentUser.id) && (
                                    <Button 
                                        type="text" 
                                        size="small" 
                                        danger 
                                        icon={<DeleteOutlined />} 
                                        onClick={() => handleDeleteComment(item.id)} 
                                    />
                                )}
                            </div>
                        </Card>
                    )}
                />

                <div style={{ marginTop: 24 }}>
                    <Title level={5}>Gửi bình luận</Title>
                    <RichTextEditor 
                        value={commentContent} 
                        onChange={setCommentContent} 
                        placeholder="Nhập nội dung bình luận..."
                        minHeight={150}
                    />
                    <div style={{ textAlign: 'right', marginTop: 12 }}>
                        <Button type="primary" onClick={handleAddComment} loading={submitting}>Gửi bình luận</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiscussionDetailPage;
