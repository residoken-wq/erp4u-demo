import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, message, Space, Tooltip, Popconfirm, Row, Col, Statistic, Progress, Badge, Tabs, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, MailOutlined, MessageOutlined, RocketOutlined, BarChartOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const { Option } = Select;
const { TextArea } = Input;

interface Campaign {
    id: number;
    name: string;
    description: string;
    type: string;
    status: string;
    segment_id: number;
    target_count: number;
    metrics: {
        sent?: number;
        delivered?: number;
        opened?: number;
        clicked?: number;
        converted?: number;
    };
    scheduled_at: string;
    created_at: string;
}

interface Segment {
    id: number;
    name: string;
    customer_count: number;
}

const MarketingPage: React.FC = () => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Campaign | null>(null);
    const [dashboardStats, setDashboardStats] = useState<any>({});
    const [form] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [campaignsRes, segmentsRes, statsRes] = await Promise.all([
                axios.get(`${API_URL}/marketing/campaigns`),
                axios.get(`${API_URL}/marketing/segments`),
                axios.get(`${API_URL}/marketing/dashboard`),
            ]);
            setCampaigns(campaignsRes.data);
            setSegments(segmentsRes.data);
            setDashboardStats(statsRes.data);
        } catch (e) {
            message.error('Lỗi tải dữ liệu');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async (values: any) => {
        try {
            if (editingItem) {
                await axios.put(`${API_URL}/marketing/campaigns/${editingItem.id}`, values);
                message.success('Cập nhật thành công');
            } else {
                await axios.post(`${API_URL}/marketing/campaigns`, values);
                message.success('Tạo chiến dịch thành công');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e) {
            message.error('Lỗi lưu');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`${API_URL}/marketing/campaigns/${id}`);
            message.success('Đã xóa');
            fetchData();
        } catch (e) {
            message.error('Lỗi xóa');
        }
    };

    const handleStatusChange = async (id: number, status: string) => {
        try {
            await axios.put(`${API_URL}/marketing/campaigns/${id}/status`, { status });
            message.success('Cập nhật trạng thái thành công');
            fetchData();
        } catch (e) {
            message.error('Lỗi cập nhật');
        }
    };

    const openEdit = (item: Campaign) => {
        setEditingItem(item);
        form.setFieldsValue(item);
        setIsModalOpen(true);
    };

    const openCreate = () => {
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'EMAIL': return <MailOutlined style={{ color: '#1890ff' }} />;
            case 'SMS': return <MessageOutlined style={{ color: '#52c41a' }} />;
            case 'SOCIAL_AD': return <RocketOutlined style={{ color: '#722ed1' }} />;
            default: return <ThunderboltOutlined />;
        }
    };

    const getStatusTag = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'default',
            SCHEDULED: 'processing',
            RUNNING: 'success',
            PAUSED: 'warning',
            COMPLETED: 'blue',
            CANCELLED: 'error',
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
    };

    const columns = [
        {
            title: 'Chiến dịch',
            key: 'name',
            render: (_: any, record: Campaign) => (
                <div>
                    <Space>
                        {getTypeIcon(record.type)}
                        <strong>{record.name}</strong>
                    </Space>
                    {record.description && (
                        <div style={{ color: '#999', fontSize: 12 }}>{record.description}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            width: 100,
            render: (type: string) => <Tag>{type}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 120,
            render: (status: string) => getStatusTag(status),
        },
        {
            title: 'Đối tượng',
            dataIndex: 'target_count',
            width: 100,
            render: (count: number) => <Badge count={count} showZero overflowCount={99999} style={{ backgroundColor: '#1890ff' }} />,
        },
        {
            title: 'Hiệu suất',
            key: 'metrics',
            width: 200,
            render: (_: any, record: Campaign) => {
                const m = record.metrics || {};
                const openRate = m.sent ? Math.round((m.opened || 0) / m.sent * 100) : 0;
                const clickRate = m.opened ? Math.round((m.clicked || 0) / m.opened * 100) : 0;
                return (
                    <Space direction="vertical" size="small">
                        <div>Mở: <Progress percent={openRate} size="small" style={{ width: 80 }} /></div>
                        <div>Click: <Progress percent={clickRate} size="small" style={{ width: 80 }} /></div>
                    </Space>
                );
            },
        },
        {
            title: 'Lịch gửi',
            dataIndex: 'scheduled_at',
            width: 160,
            render: (date: string) => date ? new Date(date).toLocaleString('vi-VN') : '-',
        },
        {
            title: '',
            key: 'actions',
            width: 160,
            render: (_: any, record: Campaign) => (
                <Space>
                    {record.status === 'DRAFT' && (
                        <Tooltip title="Bắt đầu">
                            <Button icon={<PlayCircleOutlined />} size="small" type="primary" onClick={() => handleStatusChange(record.id, 'RUNNING')} />
                        </Tooltip>
                    )}
                    {record.status === 'RUNNING' && (
                        <Tooltip title="Tạm dừng">
                            <Button icon={<PauseCircleOutlined />} size="small" onClick={() => handleStatusChange(record.id, 'PAUSED')} />
                        </Tooltip>
                    )}
                    <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
                    <Popconfirm title="Xóa chiến dịch này?" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={<span><RocketOutlined /> Quản lý Marketing</span>}
            extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Tạo Chiến dịch
                </Button>
            }
        >
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                    <Card size="small">
                        <Statistic title="Tổng chiến dịch" value={dashboardStats.total_campaigns || 0} prefix={<RocketOutlined />} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Đang chạy"
                            value={dashboardStats.active_campaigns || 0}
                            valueStyle={{ color: '#52c41a' }}
                            prefix={<PlayCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic title="Phân khúc" value={dashboardStats.total_segments || 0} prefix={<TeamOutlined />} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Automation"
                            value={dashboardStats.active_workflows || 0}
                            prefix={<ThunderboltOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <Tabs
                defaultActiveKey="campaigns"
                items={[
                    {
                        key: 'campaigns',
                        label: <span><RocketOutlined /> Chiến dịch</span>,
                        children: (
                            <Table
                                dataSource={campaigns}
                                columns={columns}
                                rowKey="id"
                                loading={loading}
                                size="small"
                            />
                        ),
                    },
                    {
                        key: 'segments',
                        label: <span><TeamOutlined /> Phân khúc</span>,
                        children: (
                            <Table
                                dataSource={segments}
                                columns={[
                                    { title: 'Tên phân khúc', dataIndex: 'name' },
                                    {
                                        title: 'Số khách hàng',
                                        dataIndex: 'customer_count',
                                        render: (count: number) => <Badge count={count} showZero overflowCount={99999} style={{ backgroundColor: '#1890ff' }} />,
                                    },
                                    {
                                        title: 'Loại',
                                        dataIndex: 'type',
                                        render: (type: string) => <Tag color={type === 'DYNAMIC' ? 'blue' : 'green'}>{type}</Tag>,
                                    },
                                ]}
                                rowKey="id"
                                loading={loading}
                                size="small"
                            />
                        ),
                    },
                ]}
            />

            <Modal
                title={editingItem ? 'Chỉnh sửa Chiến dịch' : 'Tạo Chiến dịch Mới'}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                okText="Lưu"
                width={700}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="name" label="Tên chiến dịch" rules={[{ required: true }]}>
                        <Input placeholder="VD: Flash Sale Tết 2024" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <TextArea rows={2} placeholder="Mô tả ngắn về chiến dịch..." />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
                                <Select placeholder="Chọn loại chiến dịch">
                                    <Option value="EMAIL"><MailOutlined /> Email Marketing</Option>
                                    <Option value="SMS"><MessageOutlined /> SMS Marketing</Option>
                                    <Option value="PUSH_NOTIFICATION">Push Notification</Option>
                                    <Option value="SOCIAL_AD"><RocketOutlined /> Social Ads</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="segment_id" label="Phân khúc khách hàng">
                                <Select placeholder="Chọn phân khúc" allowClear>
                                    {segments.map(s => (
                                        <Option key={s.id} value={s.id}>{s.name} ({s.customer_count} KH)</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="scheduled_at" label="Thời gian gửi">
                        <DatePicker showTime style={{ width: '100%' }} placeholder="Chọn thời gian (để trống = gửi ngay)" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default MarketingPage;
