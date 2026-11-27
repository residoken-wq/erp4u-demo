import React, { useEffect, useState, useCallback } from 'react';
import { Card, List, Button, Avatar, Tag, Modal, Form, Input, Select, message, Tabs, Typography, Space, Pagination } from 'antd';
import { MessageOutlined, PlusOutlined, UserOutlined, CommentOutlined, FlagOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import RichTextEditor from '../components/common/RichTextEditor';
import { brandColors } from '../theme/brand';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Option } = Select;
const { Title, Text } = Typography;

const DiscussionsPage: React.FC = () => {
    const navigate = useNavigate();
    const [discussions, setDiscussions] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [searchQuery, setSearchQuery] = useState('');
    const [groups, setGroups] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [activeGroupId, setActiveGroupId] = useState<string>('ALL');

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userGroupId = currentUser.groupId || currentUser.group_id;
    const isModerator = currentUser.username === 'admin' || !!(currentUser.permissions || []).find((p: any) => p.module_code === 'SYSTEM' && (p.can_update === true || p.can_update === 1));

    const visibleGroups = isModerator
        ? groups
        : groups.filter(g => Number(g.id) === Number(userGroupId));

    const fetchLookups = async () => {
        try {
            const [resGroups, resUsers] = await Promise.all([
                api.get('/users/groups').catch(() => ({ data: [] })),
                api.get('/lookups/users').catch(() => ({ data: [] })),
            ]);
            setGroups(Array.isArray(resGroups.data) ? resGroups.data : []);
            setUsers(Array.isArray(resUsers.data) ? resUsers.data : []);
        } catch (_) {}
    };

    const fetchDiscussions = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, any> = {
                page,
                limit,
            };
            if (searchQuery.trim()) {
                params.q = searchQuery.trim();
            }
            if (activeGroupId !== 'ALL') {
                if (activeGroupId === 'PUBLIC') {
                    // Public discussions (no group)
                } else {
                    params.group_id = parseInt(activeGroupId, 10);
                }
            }

            const res = await api.get('/discussions', { params });
            if (res.data && Array.isArray(res.data.data)) {
                setDiscussions(res.data.data);
                setTotal(res.data.total ?? res.data.data.length);
            } else if (Array.isArray(res.data)) {
                setDiscussions(res.data);
                setTotal(res.data.length);
            } else {
                setDiscussions([]);
                setTotal(0);
            }
        } catch (e) {
            message.error('Không thể tải danh sách thảo luận');
        }
        setLoading(false);
    }, [page, limit, searchQuery, activeGroupId]);

    useEffect(() => {
        fetchLookups();
    }, []);

    useEffect(() => {
        fetchDiscussions();
    }, [fetchDiscussions]);

    const handleSearch = (value: string) => {
        setSearchQuery(value);
        setPage(1);
    };

    const handleCreate = async (values: any) => {
        try {
            const payload = {
                title: values.title.trim(),
                content: values.content,
                group_id: values.group_id ? values.group_id : null,
                mentioned_user_ids: values.mentioned_user_ids && values.mentioned_user_ids.length > 0
                    ? values.mentioned_user_ids
                    : undefined,
            };
            await api.post('/discussions', payload);
            message.success('Đã tạo thảo luận thành công');
            setIsModalOpen(false);
            form.resetFields();
            setPage(1);
            fetchDiscussions();
        } catch (e) {
            message.error('Tạo thảo luận thất bại');
        }
    };

    const handleTabChange = (key: string) => {
        setActiveGroupId(key);
        setPage(1);
    };

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 20 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={3} style={{ margin: 0, color: brandColors.navy }}>Thảo luận</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalOpen(true)}
                    style={{ backgroundColor: brandColors.navy }}
                >
                    Thảo luận mới
                </Button>
            </div>

            <Card>
                <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Input.Search
                        placeholder="Tìm kiếm theo tiêu đề thảo luận..."
                        allowClear
                        enterButton={<SearchOutlined />}
                        onSearch={handleSearch}
                        style={{ maxWidth: 400 }}
                    />
                </div>

                <Tabs
                    activeKey={activeGroupId}
                    onChange={handleTabChange}
                    items={[
                        { key: 'ALL', label: 'Tất cả' },
                        { key: 'PUBLIC', label: 'Chung / Công khai' },
                        ...visibleGroups.map(g => ({ key: String(g.id), label: g.name }))
                    ]}
                />

                <List
                    itemLayout="horizontal"
                    dataSource={discussions}
                    loading={loading}
                    locale={{ emptyText: 'Chưa có thảo luận nào' }}
                    renderItem={(item) => (
                        <List.Item
                            actions={[
                                <span key="views"><UserOutlined /> {item.view_count ?? item.views_count ?? 0} người xem</span>,
                                <span key="replies"><CommentOutlined /> {item.comment_count ?? 0} bình luận</span>,
                                <Button type="link" onClick={() => navigate(`/workspace/discussions/${item.id}`)}>
                                    Xem chi tiết
                                </Button>
                            ]}
                        >
                            <List.Item.Meta
                                avatar={
                                    <Avatar style={{ backgroundColor: brandColors.navy }}>
                                        {item.creator?.full_name?.charAt(0) || 'U'}
                                    </Avatar>
                                }
                                title={
                                    <Space wrap>
                                        {item.is_new && (
                                            <Tag color={brandColors.orange} style={{ fontWeight: 600 }}>
                                                Mới
                                            </Tag>
                                        )}
                                        <a
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigate(`/workspace/discussions/${item.id}`);
                                            }}
                                            style={{ color: brandColors.navy, fontWeight: item.is_new ? 600 : 400 }}
                                        >
                                            {item.title}
                                        </a>
                                        {item.is_pinned && <FlagOutlined style={{ color: brandColors.orange }} title="Đã ghim" />}
                                        {item.edited_at && (
                                            <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                                                (đã sửa)
                                            </Text>
                                        )}
                                    </Space>
                                }
                                description={
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            Bắt đầu bởi {item.creator?.full_name || 'Người dùng'} • {dayjs(item.created_at).fromNow()}
                                        </Text>
                                        <div style={{ marginTop: 4 }}>
                                            {item.group ? <Tag color="blue">{item.group.name}</Tag> : <Tag color="green">Công khai</Tag>}
                                        </div>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />

                {total > limit && (
                    <div style={{ textAlign: 'right', marginTop: 16 }}>
                        <Pagination
                            current={page}
                            pageSize={limit}
                            total={total}
                            onChange={(p) => setPage(p)}
                            showSizeChanger={false}
                            showTotal={(tot) => `Tổng số ${tot} thảo luận`}
                        />
                    </div>
                )}
            </Card>

            <Modal
                title="Bắt đầu thảo luận mới"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                okText="Tạo thảo luận"
                cancelText="Hủy"
                width={700}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreate}
                    initialValues={{ group_id: null, mentioned_user_ids: [] }}
                >
                    <Form.Item
                        name="title"
                        label="Tiêu đề"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề thảo luận' }]}
                    >
                        <Input placeholder="Nhập tiêu đề thảo luận..." maxLength={200} showCount />
                    </Form.Item>

                    <Form.Item
                        name="content"
                        label="Nội dung"
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung thảo luận' }]}
                    >
                        <RichTextEditor minHeight={250} placeholder="Nhập nội dung thảo luận..." />
                    </Form.Item>

                    <Form.Item name="group_id" label="Nhóm (Tùy chọn)">
                        <Select allowClear placeholder="Chọn nhóm hoặc để trống (Công khai)">
                            {visibleGroups.map(g => (
                                <Option key={g.id} value={g.id}>{g.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="mentioned_user_ids" label="@Nhắc tên đồng nghiệp (Tùy chọn)">
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder="Chọn người nhận thông báo nhắc tên..."
                            optionFilterProp="children"
                        >
                            {users.map(u => (
                                <Option key={u.id} value={u.id}>
                                    {u.full_name} ({u.username})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default DiscussionsPage;
