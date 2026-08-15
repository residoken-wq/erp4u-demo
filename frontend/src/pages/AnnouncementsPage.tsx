import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Modal, Form, Input, Select, DatePicker, Switch, Space, Tag, Popconfirm, message, Tooltip
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, PushpinOutlined, NotificationOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import dayjs from 'dayjs';
import api from '../utils/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface Announcement {
    id: number;
    title: string;
    content: string;
    type: 'INFO' | 'WARNING' | 'IMPORTANT';
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    is_active: boolean;
    is_pinned: boolean;
    target_departments: string[] | null;
    start_date: string | null;
    end_date: string | null;
    created_by: number;
    creator?: { name: string };
    created_at: string;
    updated_at: string;
}

const TYPE_COLORS: Record<string, string> = {
    INFO: 'blue',
    WARNING: 'orange',
    IMPORTANT: 'red'
};

const PRIORITY_LABELS: Record<string, string> = {
    LOW: 'Thấp',
    NORMAL: 'Bình thường',
    HIGH: 'Cao'
};

const DEPARTMENTS = [
    'Kinh doanh', 'Sản xuất', 'Kế toán', 'Nhân sự', 'Kho vận', 'Marketing', 'IT', 'Ban giám đốc'
];

const AnnouncementsPage: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [form] = Form.useForm();

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/announcements');
            setAnnouncements(res.data);
        } catch (e) {
            console.error(e);
            message.error('Không thể tải danh sách thông báo');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            type: 'INFO',
            priority: 'NORMAL',
            is_active: true,
            is_pinned: false,
            target_departments: []
        });
        setModalOpen(true);
    };

    const openEdit = (record: Announcement) => {
        setEditing(record);
        form.setFieldsValue({
            ...record,
            dateRange: record.start_date && record.end_date
                ? [dayjs(record.start_date), dayjs(record.end_date)]
                : undefined,
            target_departments: record.target_departments || []
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const payload: any = {
                title: values.title,
                content: values.content,
                type: values.type,
                priority: values.priority,
                is_active: values.is_active,
                is_pinned: values.is_pinned,
                target_departments: values.target_departments?.length > 0 ? values.target_departments : null,
                start_date: values.dateRange?.[0]?.toISOString() || null,
                end_date: values.dateRange?.[1]?.toISOString() || null
            };

            if (editing) {
                await api.put(`/announcements/${editing.id}`, payload);
                message.success('Cập nhật thông báo thành công');
            } else {
                await api.post('/announcements', payload);
                message.success('Tạo thông báo mới thành công');
            }
            setModalOpen(false);
            loadData();
        } catch (e: any) {
            if (e.errorFields) return; // Validation error
            message.error('Lỗi khi lưu thông báo');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/announcements/${id}`);
            message.success('Xóa thông báo thành công');
            loadData();
        } catch (e) {
            message.error('Lỗi khi xóa thông báo');
        }
    };

    const handleToggleActive = async (id: number, is_active: boolean) => {
        try {
            await api.put(`/announcements/${id}`, { is_active });
            loadData();
        } catch (e) {
            message.error('Lỗi khi cập nhật trạng thái');
        }
    };

    const handleTogglePinned = async (id: number, is_pinned: boolean) => {
        try {
            await api.put(`/announcements/${id}`, { is_pinned });
            loadData();
        } catch (e) {
            message.error('Lỗi khi ghim thông báo');
        }
    };

    const columns = [
        {
            title: <PushpinOutlined />,
            dataIndex: 'is_pinned',
            width: 40,
            render: (pinned: boolean, record: Announcement) => (
                <Tooltip title={pinned ? 'Bỏ ghim' : 'Ghim'}>
                    <PushpinOutlined
                        style={{ color: pinned ? '#faad14' : '#d9d9d9', cursor: 'pointer' }}
                        onClick={() => handleTogglePinned(record.id, !pinned)}
                    />
                </Tooltip>
            )
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            ellipsis: true,
            render: (title: string, record: Announcement) => (
                <span style={{ fontWeight: record.is_pinned ? 600 : 400 }}>{title}</span>
            )
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            width: 100,
            render: (type: string) => <Tag color={TYPE_COLORS[type]}>{type}</Tag>
        },
        {
            title: 'Độ ưu tiên',
            dataIndex: 'priority',
            width: 110,
            render: (priority: string) => PRIORITY_LABELS[priority]
        },
        {
            title: 'Phòng ban',
            dataIndex: 'target_departments',
            width: 150,
            render: (depts: string[] | null) => depts?.length ? depts.join(', ') : <em>Tất cả</em>
        },
        {
            title: 'Hiệu lực',
            key: 'dateRange',
            width: 180,
            render: (_: any, record: Announcement) => {
                if (!record.start_date && !record.end_date) return <em>Không giới hạn</em>;
                const start = record.start_date ? dayjs(record.start_date).format('DD/MM/YY') : '...';
                const end = record.end_date ? dayjs(record.end_date).format('DD/MM/YY') : '...';
                return `${start} - ${end}`;
            }
        },
        {
            title: 'Kích hoạt',
            dataIndex: 'is_active',
            width: 90,
            render: (active: boolean, record: Announcement) => (
                <Switch
                    size="small"
                    checked={active}
                    onChange={(checked) => handleToggleActive(record.id, checked)}
                />
            )
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            render: (_: any, record: Announcement) => (
                <Space size="small">
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                    <Popconfirm title="Xóa thông báo này?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '12px 8px' }}>
            <Card
                title={<><NotificationOutlined /> Quản lý Thông báo</>}
                size="small"
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                        Tạo thông báo
                    </Button>
                }
            >
                <Table
                    dataSource={announcements}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                />
            </Card>

            <Modal
                title={editing ? 'Chỉnh sửa Thông báo' : 'Tạo Thông báo mới'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                width={800}
                okText="Lưu"
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="title"
                        label="Tiêu đề"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                    >
                        <Input placeholder="Tiêu đề thông báo" />
                    </Form.Item>

                    <Form.Item
                        name="content"
                        label="Nội dung"
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
                    >
                        <ReactQuill
                            theme="snow"
                            style={{ height: 200, marginBottom: 42 }}
                            placeholder="Nội dung thông báo..."
                        />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size="large">
                        <Form.Item name="type" label="Loại thông báo">
                            <Select style={{ width: 150 }}>
                                <Option value="INFO">Thông tin</Option>
                                <Option value="WARNING">Cảnh báo</Option>
                                <Option value="IMPORTANT">Quan trọng</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="priority" label="Độ ưu tiên">
                            <Select style={{ width: 150 }}>
                                <Option value="LOW">Thấp</Option>
                                <Option value="NORMAL">Bình thường</Option>
                                <Option value="HIGH">Cao</Option>
                            </Select>
                        </Form.Item>
                    </Space>

                    <Form.Item name="target_departments" label="Phòng ban mục tiêu (để trống = tất cả)">
                        <Select
                            mode="multiple"
                            placeholder="Chọn phòng ban..."
                            allowClear
                            style={{ width: '100%' }}
                        >
                            {DEPARTMENTS.map(d => <Option key={d} value={d}>{d}</Option>)}
                        </Select>
                    </Form.Item>

                    <Form.Item name="dateRange" label="Thời gian hiệu lực (để trống = không giới hạn)">
                        <RangePicker
                            showTime
                            format="DD/MM/YYYY HH:mm"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>

                    <Space size="large">
                        <Form.Item name="is_active" label="Kích hoạt" valuePropName="checked">
                            <Switch />
                        </Form.Item>

                        <Form.Item name="is_pinned" label="Ghim" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>

            <style>{`
                @media (max-width: 768px) {
                    .ant-table { font-size: 12px !important; }
                    .ant-modal { max-width: 95vw !important; margin: 8px auto !important; }
                }
            `}</style>
        </div>
    );
};

export default AnnouncementsPage;
