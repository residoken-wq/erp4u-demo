import React, { useEffect, useState, useCallback } from 'react';
import SafeHtml from '../components/common/SafeHtml';
import { Card, Button, Avatar, Tag, Form, message, Typography, Divider, List, Input, Space, Tooltip, Spin, Modal, Select } from 'antd';
import { ArrowLeftOutlined, CommentOutlined, DeleteOutlined, EditOutlined, UserOutlined, ClockCircleOutlined, FlagOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import api from '../utils/api';
import RichTextEditor from '../components/common/RichTextEditor';
import { brandColors } from '../theme/brand';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;
const { Option } = Select;

const DiscussionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [discussion, setDiscussion] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [commentContent, setCommentContent] = useState('');
    const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    // Edit discussion modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm] = Form.useForm();

    // Edit comment modal
    const [editingComment, setEditingComment] = useState<any>(null);
    const [commentEditContent, setCommentEditContent] = useState('');
    const [isCommentEditModalOpen, setIsCommentEditModalOpen] = useState(false);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchUsers = async () => {
        try {
            const res = await api.get('/lookups/users').catch(() => ({ data: [] }));
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (_) {}
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/discussions/${id}`);
            setDiscussion(res.data);
        } catch (e) {
            message.error('Không thể tải thông tin thảo luận');
            navigate('/workspace?tab=discussions');
        }
        setLoading(false);
    }, [id, navigate]);

    useEffect(() => {
        if (id) {
            fetchData();
            fetchUsers();
        }
    }, [id, fetchData]);

    const handleAddComment = async () => {
        if (!commentContent.trim()) {
            return message.warning('Vui lòng nhập nội dung bình luận');
        }
        setSubmitting(true);
        try {
            await api.post(`/discussions/${id}/comments`, {
                content: commentContent,
                mentioned_user_ids: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
            });
            message.success('Đã gửi bình luận');
            setCommentContent('');
            setMentionedUserIds([]);
            fetchData();
        } catch (e) {
            message.error('Gửi bình luận thất bại');
        }
        setSubmitting(false);
    };

    const handleTogglePin = async () => {
        try {
            await api.put(`/discussions/${id}/pin`, { pinned: !discussion.is_pinned });
            message.success(discussion.is_pinned ? 'Đã bỏ ghim thảo luận' : 'Đã ghim thảo luận');
            fetchData();
        } catch (e) {
            message.error('Thao tác ghim thất bại');
        }
    };

    const handleOpenEditDiscussion = () => {
        editForm.setFieldsValue({
            title: discussion.title,
            content: discussion.content,
        });
        setIsEditModalOpen(true);
    };

    const handleSaveDiscussionEdit = async (values: any) => {
        try {
            await api.put(`/discussions/${id}`, {
                title: values.title.trim(),
                content: values.content,
            });
            message.success('Cập nhật thảo luận thành công');
            setIsEditModalOpen(false);
            fetchData();
        } catch (e) {
            message.error('Cập nhật thảo luận thất bại');
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
                    message.error('Xóa thảo luận thất bại');
                }
            }
        });
    };

    const handleOpenEditComment = (comment: any) => {
        setEditingComment(comment);
        setCommentEditContent(comment.content);
        setIsCommentEditModalOpen(true);
    };

    const handleSaveCommentEdit = async () => {
        if (!commentEditContent.trim()) {
            return message.warning('Nội dung bình luận không được để trống');
        }
        try {
            await api.put(`/discussions/comments/${editingComment.id}`, {
                content: commentEditContent,
            });
            message.success('Cập nhật bình luận thành công');
            setIsCommentEditModalOpen(false);
            setEditingComment(null);
            fetchData();
        } catch (e) {
            message.error('Cập nhật bình luận thất bại');
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa bình luận',
            content: 'Bạn có chắc chắn muốn xóa bình luận này?',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await api.delete(`/discussions/comments/${commentId}`);
                    message.success('Đã xóa bình luận');
                    fetchData();
                } catch (e) {
                    message.error('Xóa bình luận thất bại');
                }
            }
        });
    };

    if (loading && !discussion) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    if (!discussion) return null;

    const isDiscussionOwner = Boolean(currentUser?.id && discussion.creator_id === currentUser.id);

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <Title level={4} style={{ margin: 0, color: brandColors.navy }}>{discussion.title}</Title>
                            {discussion.is_pinned && (
                                <Tooltip title="Đã ghim">
                                    <FlagOutlined style={{ color: brandColors.orange }} />
                                </Tooltip>
                            )}
                            {discussion.edited_at && (
                                <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>
                                    (đã sửa)
                                </Text>
                            )}
                            {discussion.group && <Tag color="blue">{discussion.group.name}</Tag>}
                        </div>
                        <Space>
                            {discussion.can_pin && (
                                <Button
                                    icon={<FlagOutlined />}
                                    type={discussion.is_pinned ? 'primary' : 'default'}
                                    danger={discussion.is_pinned}
                                    onClick={handleTogglePin}
                                >
                                    {discussion.is_pinned ? 'Bỏ ghim' : 'Ghim'}
                                </Button>
                            )}
                            {isDiscussionOwner && (
                                <Button icon={<EditOutlined />} onClick={handleOpenEditDiscussion}>
                                    Sửa
                                </Button>
                            )}
                            {discussion.can_delete && (
                                <Button icon={<DeleteOutlined />} danger onClick={handleDeleteDiscussion}>
                                    Xóa
                                </Button>
                            )}
                        </Space>
                    </div>
                }
            >
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: brandColors.navy }} />
                    <Text strong>{discussion.creator?.full_name || 'Người dùng'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {dayjs(discussion.created_at).fromNow()}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        • {discussion.view_count ?? discussion.views_count ?? 0} người xem
                    </Text>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <SafeHtml
                    className="ck-content"
                    style={{ minHeight: 150, padding: '10px 0' }}
                    html={discussion.content}
                />
            </Card>

            <div style={{ marginTop: 24 }}>
                <Title level={5}><CommentOutlined /> Bình luận ({discussion.comments?.length || 0})</Title>

                <List
                    dataSource={discussion.comments || []}
                    itemLayout="horizontal"
                    locale={{ emptyText: 'Chưa có bình luận nào' }}
                    renderItem={(item: any) => {
                        const isCommentAuthor = Boolean(currentUser?.id && item.user_id === currentUser.id);
                        return (
                            <Card size="small" style={{ marginBottom: 12, border: 'none', background: '#f9f9f9', borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                                        <Avatar size="small" style={{ backgroundColor: brandColors.navy }}>
                                            {item.user?.full_name?.charAt(0) || 'U'}
                                        </Avatar>
                                        <div style={{ flex: 1 }}>
                                            <Space>
                                                <Text strong>{item.user?.full_name || 'Người dùng'}</Text>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {dayjs(item.created_at).fromNow()}
                                                </Text>
                                                {item.edited_at && (
                                                    <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 11 }}>
                                                        (đã sửa)
                                                    </Text>
                                                )}
                                            </Space>
                                            <SafeHtml style={{ margin: '6px 0' }} html={item.content} />
                                        </div>
                                    </div>
                                    <Space>
                                        {isCommentAuthor && (
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EditOutlined />}
                                                onClick={() => handleOpenEditComment(item)}
                                                title="Sửa bình luận"
                                            />
                                        )}
                                        {item.can_delete && (
                                            <Button
                                                type="text"
                                                size="small"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => handleDeleteComment(item.id)}
                                                title="Xóa bình luận"
                                            />
                                        )}
                                    </Space>
                                </div>
                            </Card>
                        );
                    }}
                />

                <div style={{ marginTop: 24 }}>
                    <Title level={5}>Gửi bình luận</Title>
                    <div style={{ marginBottom: 12 }}>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="@Nhắc tên đồng nghiệp trong bình luận (Tùy chọn)..."
                            value={mentionedUserIds}
                            onChange={setMentionedUserIds}
                            optionFilterProp="children"
                        >
                            {users.map(u => (
                                <Option key={u.id} value={u.id}>
                                    {u.full_name} ({u.username})
                                </Option>
                            ))}
                        </Select>
                    </div>
                    <RichTextEditor
                        value={commentContent}
                        onChange={setCommentContent}
                        placeholder="Nhập nội dung bình luận..."
                        minHeight={150}
                    />
                    <div style={{ textAlign: 'right', marginTop: 12 }}>
                        <Button
                            type="primary"
                            onClick={handleAddComment}
                            loading={submitting}
                            style={{ backgroundColor: brandColors.navy }}
                        >
                            Gửi bình luận
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal chỉnh sửa thảo luận */}
            <Modal
                title="Sửa thảo luận"
                open={isEditModalOpen}
                onCancel={() => setIsEditModalOpen(false)}
                onOk={() => editForm.submit()}
                okText="Lưu thay đổi"
                cancelText="Hủy"
                width={700}
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleSaveDiscussionEdit}
                >
                    <Form.Item
                        name="title"
                        label="Tiêu đề"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề thảo luận' }]}
                    >
                        <Input maxLength={200} showCount />
                    </Form.Item>
                    <Form.Item
                        name="content"
                        label="Nội dung"
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung thảo luận' }]}
                    >
                        <RichTextEditor minHeight={250} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal chỉnh sửa bình luận */}
            <Modal
                title="Sửa bình luận"
                open={isCommentEditModalOpen}
                onCancel={() => {
                    setIsCommentEditModalOpen(false);
                    setEditingComment(null);
                }}
                onOk={handleSaveCommentEdit}
                okText="Lưu thay đổi"
                cancelText="Hủy"
                width={600}
            >
                <RichTextEditor
                    value={commentEditContent}
                    onChange={setCommentEditContent}
                    minHeight={180}
                />
            </Modal>
        </div>
    );
};

export default DiscussionDetailPage;
