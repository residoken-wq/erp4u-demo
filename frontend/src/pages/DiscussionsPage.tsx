import React, { useEffect, useState } from 'react';
import { Card, List, Button, Avatar, Tag, Modal, Form, Input, Select, message, Tabs, Typography, Space, Switch } from 'antd';
import { MessageOutlined, PlusOutlined, UserOutlined, CommentOutlined, FlagOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import RichTextEditor from '../components/common/RichTextEditor';

dayjs.extend(relativeTime);

const { Option } = Select;
const { Title, Text } = Typography;

const DiscussionsPage: React.FC = () => {
    const navigate = useNavigate();
    const [discussions, setDiscussions] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [activeGroupId, setActiveGroupId] = useState<string>('ALL');

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resDisc, resGroups] = await Promise.all([
                api.get('/discussions'),
                api.get('/users/groups') // Ensure this endpoint exists
            ]);
            setDiscussions(resDisc.data);
            setGroups(resGroups.data);
        } catch (e) { message.error('Failed to load discussions'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async (values: any) => {
        try {
            const payload = {
                ...values,
                creator_id: currentUser.id,
                group_id: values.group_id ? values.group_id : null // null means public
            };
            await api.post('/discussions', payload);
            message.success('Discussion started!');
            setIsModalOpen(false);
            form.resetFields();
            fetchData();
        } catch (e) { message.error('Failed to create discussion'); }
    };

    // Filter by group
    const filteredDiscussions = activeGroupId === 'ALL'
        ? discussions
        : discussions.filter(d => {
            if (activeGroupId === 'PUBLIC') return !d.group_id;
            return d.group_id === parseInt(activeGroupId);
        });

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 20 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={3}>Discussions & Announcements</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>New Topic</Button>
            </div>

            <Card>
                <Tabs
                    activeKey={activeGroupId}
                    onChange={setActiveGroupId}
                    items={[
                        { key: 'ALL', label: 'All Topics' },
                        { key: 'PUBLIC', label: 'General / Public' },
                        ...groups.map(g => ({ key: String(g.id), label: g.name }))
                    ]}
                />

                <List
                    itemLayout="horizontal"
                    dataSource={filteredDiscussions}
                    loading={loading}
                    renderItem={(item) => (
                        <List.Item
                            actions={[
                                <span key="views"><UserOutlined /> {item.views_count} xem</span>,
                                <span key="replies"><CommentOutlined /> {item.comment_count} phản hồi</span>,
                                <Button type="link" onClick={() => navigate(`/workspace/discussions/${item.id}`)}>Xem</Button>
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<Avatar style={{ backgroundColor: '#f56a00' }}>{item.creator?.full_name?.charAt(0)}</Avatar>}
                                title={
                                    <Space>
                                        <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/workspace/discussions/${item.id}`); }}>{item.title}</a>
                                        {item.is_pinned && <FlagOutlined style={{ color: '#f5222d' }} />}
                                        {item.type === 'ANNOUNCEMENT' && <Tag color="volcano">Thông báo</Tag>}
                                        {!item.is_reviewed && <Tag color="warning">Chưa duyệt</Tag>}
                                    </Space>
                                }
                                description={
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Bắt đầu bởi {item.creator?.full_name} • {dayjs(item.created_at).fromNow()}</Text>
                                        <div style={{ marginTop: 4 }}>
                                            {item.group ? <Tag color="blue">{item.group.name}</Tag> : <Tag color="green">Công khai</Tag>}
                                        </div>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Card>

            <Modal
                title="Start New Discussion"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form 
                    form={form} 
                    layout="vertical" 
                    onFinish={handleCreate}
                    initialValues={{ type: 'GENERAL', is_pinned: false }}
                >
                    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input placeholder="Nhập tiêu đề thảo luận..." /></Form.Item>
                    
                    <Form.Item name="content" label="Nội dung" rules={[{ required: true }]}>
                        <RichTextEditor minHeight={300} />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 20 }}>
                        <Form.Item name="group_id" label="Nhóm (Tùy chọn)" style={{ flex: 1 }}>
                            <Select allowClear placeholder="Chọn nhóm hoặc để trống (Công khai)">
                                {groups.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                            </Select>
                        </Form.Item>
                        
                        <Form.Item name="type" label="Loại" style={{ width: 150 }}>
                            <Select>
                                <Option value="GENERAL">Thường</Option>
                                <Option value="ANNOUNCEMENT">Thông báo</Option>
                            </Select>
                        </Form.Item>

                        {(currentUser.username === 'admin' || currentUser.role === 'ADMIN') && (
                            <Form.Item name="is_pinned" label="Ghim" valuePropName="checked" style={{ width: 100 }}>
                                <Switch />
                            </Form.Item>
                        )}
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default DiscussionsPage;
