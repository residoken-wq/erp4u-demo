import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, message, Space, Tooltip, Popconfirm, Statistic, Row, Col, Badge, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined, LinkOutlined, DisconnectOutlined, FacebookOutlined, ShopOutlined, TikTokOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const { Option } = Select;

interface SocialChannel {
    id: number;
    platform: string;
    shop_name: string;
    shop_id: string;
    status: string;
    settings: any;
    last_sync_at: string;
    last_error: string;
    created_at: string;
}

const SocialChannelsPage: React.FC = () => {
    const [channels, setChannels] = useState<SocialChannel[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SocialChannel | null>(null);
    const [stats, setStats] = useState<Record<number, any>>({});
    const [form] = Form.useForm();

    const fetchChannels = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/social/channels`);
            setChannels(res.data);
            // Fetch stats for each channel
            for (const channel of res.data) {
                const statsRes = await axios.get(`${API_URL}/social/channels/${channel.id}/stats`);
                setStats(prev => ({ ...prev, [channel.id]: statsRes.data }));
            }
        } catch (e) {
            message.error('Lỗi tải danh sách kênh');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchChannels();
    }, []);

    const handleSave = async (values: any) => {
        try {
            if (editingItem) {
                await axios.put(`${API_URL}/social/channels/${editingItem.id}`, values);
                message.success('Cập nhật thành công');
            } else {
                await axios.post(`${API_URL}/social/channels`, values);
                message.success('Thêm kênh thành công');
            }
            setIsModalOpen(false);
            fetchChannels();
        } catch (e) {
            message.error('Lỗi lưu');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`${API_URL}/social/channels/${id}`);
            message.success('Đã xóa');
            fetchChannels();
        } catch (e) {
            message.error('Lỗi xóa');
        }
    };

    const openEdit = (item: SocialChannel) => {
        setEditingItem(item);
        form.setFieldsValue(item);
        setIsModalOpen(true);
    };

    const openCreate = () => {
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'FACEBOOK': return <FacebookOutlined style={{ color: '#1877F2' }} />;
            case 'SHOPEE': return <ShopOutlined style={{ color: '#EE4D2D' }} />;
            case 'TIKTOK': return <TikTokOutlined style={{ color: '#000' }} />;
            default: return <LinkOutlined />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'success';
            case 'DISCONNECTED': return 'error';
            case 'PENDING': return 'warning';
            case 'ERROR': return 'error';
            default: return 'default';
        }
    };

    const columns = [
        {
            title: 'Nền tảng',
            dataIndex: 'platform',
            width: 120,
            render: (platform: string) => (
                <Space>
                    {getPlatformIcon(platform)}
                    <strong>{platform}</strong>
                </Space>
            ),
        },
        {
            title: 'Tên Shop',
            dataIndex: 'shop_name',
            render: (name: string, record: SocialChannel) => (
                <div>
                    <div>{name || 'Chưa cấu hình'}</div>
                    <small style={{ color: '#999' }}>ID: {record.shop_id || '-'}</small>
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 130,
            render: (status: string) => (
                <Badge status={getStatusColor(status) as any} text={status} />
            ),
        },
        {
            title: 'Thống kê',
            key: 'stats',
            width: 200,
            render: (_: any, record: SocialChannel) => {
                const s = stats[record.id];
                if (!s) return '-';
                return (
                    <Space size="small">
                        <Tag>Đơn: {s.total_orders}</Tag>
                        <Tag color="orange">Chờ: {s.pending_orders}</Tag>
                        <Tag color="blue">SP: {s.total_products}</Tag>
                    </Space>
                );
            },
        },
        {
            title: 'Đồng bộ lần cuối',
            dataIndex: 'last_sync_at',
            width: 160,
            render: (date: string) => date ? new Date(date).toLocaleString('vi-VN') : '-',
        },
        {
            title: '',
            key: 'actions',
            width: 150,
            render: (_: any, record: SocialChannel) => (
                <Space>
                    <Tooltip title="Cài đặt">
                        <Button icon={<SettingOutlined />} size="small" onClick={() => openEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Đồng bộ ngay">
                        <Button icon={<SyncOutlined />} size="small" type="primary" ghost />
                    </Tooltip>
                    <Popconfirm title="Xóa kênh này?" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={<span><LinkOutlined /> Kênh Bán Hàng Social</span>}
            extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Thêm Kênh
                </Button>
            }
        >
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                    <Card size="small">
                        <Statistic title="Tổng số kênh" value={channels.length} prefix={<LinkOutlined />} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Kênh hoạt động"
                            value={channels.filter(c => c.status === 'ACTIVE').length}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Đơn chờ đồng bộ"
                            value={Object.values(stats).reduce((sum: number, s: any) => sum + (s?.pending_orders || 0), 0)}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Sản phẩm đã map"
                            value={Object.values(stats).reduce((sum: number, s: any) => sum + (s?.total_products || 0), 0)}
                        />
                    </Card>
                </Col>
            </Row>

            <Table
                dataSource={channels}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="small"
            />

            <Modal
                title={editingItem ? `Cấu hình: ${editingItem.shop_name || editingItem.platform}` : 'Thêm Kênh Mới'}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                okText="Lưu"
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="platform" label="Nền tảng" rules={[{ required: true }]}>
                        <Select placeholder="Chọn nền tảng">
                            <Option value="FACEBOOK"><FacebookOutlined /> Facebook</Option>
                            <Option value="SHOPEE"><ShopOutlined /> Shopee</Option>
                            <Option value="TIKTOK"><TikTokOutlined /> TikTok Shop</Option>
                            <Option value="LAZADA">Lazada</Option>
                            <Option value="ZALO">Zalo</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="shop_name" label="Tên Shop">
                        <Input placeholder="Tên hiển thị của shop" />
                    </Form.Item>
                    <Form.Item name="shop_id" label="Shop ID">
                        <Input placeholder="ID shop trên nền tảng" />
                    </Form.Item>
                    <Form.Item name="access_token" label="Access Token">
                        <Input.TextArea rows={3} placeholder="Paste access token từ nền tảng..." />
                    </Form.Item>
                    <Form.Item name="status" label="Trạng thái">
                        <Select>
                            <Option value="PENDING">Chờ kết nối</Option>
                            <Option value="ACTIVE">Hoạt động</Option>
                            <Option value="DISCONNECTED">Ngắt kết nối</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default SocialChannelsPage;
