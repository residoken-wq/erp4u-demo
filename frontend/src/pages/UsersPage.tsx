import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Select, Tag, Switch, Space, Avatar, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, UserOutlined, LockOutlined, GlobalOutlined, DesktopOutlined, WifiOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [changePassUser, setChangePassUser] = useState<any>(null); // State cho modal đổi pass
    const [passForm] = Form.useForm();
    const [form] = Form.useForm();

    // Online Users State
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);

    const fetchOnlineUsers = async () => {
        try {
            const res = await api.get('/users/online');
            setOnlineUsers(res.data);
            setIsOnlineModalOpen(true);
        } catch (e) { message.error('Lỗi tải danh sách user online'); }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resUsers, resGroups] = await Promise.all([
                api.get('/users'),
                api.get('/users/groups')
            ]);
            setUsers(resUsers.data);
            setGroups(resGroups.data);
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async (values: any) => {
        try {
            if (editingUser) {
                // Logic Edit: Nếu không nhập password thì xóa field đó khỏi payload để không bị overwrite thành rỗng
                const payload = { ...values };
                if (!payload.password) {
                    delete payload.password;
                }

                await api.put(`/users/${editingUser.id}`, payload);
                message.success('Cập nhật thông tin thành công');
            } else {
                // Logic Create: Gửi toàn bộ values (bao gồm password bắt buộc)
                await api.post('/users', values);
                message.success('Tạo user mới thành công');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    const openModal = (record?: any) => {
        setEditingUser(record);
        if (record) {
            form.setFieldsValue({
                ...record,
                group_id: record.group?.id,
                password: '', // Reset password field khi edit để tránh hiện mật khẩu cũ (đã hash)
            });
        } else {
            form.resetFields();
        }
        setIsModalOpen(true);
    };

    const columns = [
        { title: 'Username', dataIndex: 'username', render: (t: any) => <b>{t}</b> },
        { title: 'Họ Tên', dataIndex: 'full_name' },
        {
            render: (g: any) => g ? <Tag color="blue">{g.name}</Tag> : <Tag color="red">Chưa phân nhóm</Tag>
        },
        {
            title: 'Trạng thái', dataIndex: 'is_active',
            render: (act: boolean) => <Switch size="small" checked={act} disabled />
        },
        {
            title: '', key: 'act', align: 'right' as const,
            render: (_: any, r: any) => (
                <Space>
                    <Tooltip title="Đổi mật khẩu">
                        <Button icon={<LockOutlined />} size="small" onClick={() => { setChangePassUser(r); passForm.resetFields(); }} />
                    </Tooltip>
                    <Button icon={<EditOutlined />} size="small" onClick={() => openModal(r)} />
                </Space>
            )
        }
    ];

    const handleChangePass = async (values: any) => {
        try {
            await api.post(`/users/${changePassUser.id}/change-password`, { password: values.password });
            message.success('Đổi mật khẩu thành công');
            setChangePassUser(null);
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    return (
        <Card title="Quản lý Người Dùng (Users)" extra={
            <Space>
                <Button icon={<GlobalOutlined />} onClick={fetchOnlineUsers}>Xem User Online</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Thêm User</Button>
            </Space>
        }>
            <Table dataSource={users} columns={columns} rowKey="id" loading={loading} />

            <Modal
                title={editingUser ? "Sửa thông tin User" : "Thêm User Mới"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ is_active: true }}>
                    <Form.Item
                        name="username"
                        label="Tên đăng nhập"
                        rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
                    >
                        <Input disabled={!!editingUser} prefix={<UserOutlined />} placeholder="Ví dụ: admin" />
                    </Form.Item>

                    {/* --- Password Field Only for Create --- */}
                    {!editingUser && (
                        <Form.Item
                            name="password"
                            label="Mật khẩu"
                            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu..." />
                        </Form.Item>
                    )}
                    {/* --------------------------- */}

                    <Form.Item
                        name="full_name"
                        label="Họ và tên"
                        rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                    >
                        <Input placeholder="Ví dụ: Nguyễn Văn A" />
                    </Form.Item>

                    <Form.Item
                        name="group_id"
                        label="Nhóm quyền (Role)"
                        rules={[{ required: true, message: 'Vui lòng chọn nhóm' }]}
                    >
                        <Select placeholder="Chọn nhóm">
                            {groups.map((g: any) => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
                        </Select>
                    </Form.Item>

                    <Form.Item name="email" label="Email">
                        <Input placeholder="email@example.com" />
                    </Form.Item>

                    {editingUser && (
                        <Form.Item name="is_active" valuePropName="checked" label="Trạng thái kích hoạt">
                            <Switch checkedChildren="Active" unCheckedChildren="Locked" />
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            <Modal
                title={<span><GlobalOutlined style={{ color: 'green' }} /> Danh sách User đang Online (15 phút gần nhất)</span>}
                open={isOnlineModalOpen}
                onCancel={() => setIsOnlineModalOpen(false)}
                footer={null}
                width={900}
            >
                <Table
                    dataSource={onlineUsers}
                    rowKey="id"
                    pagination={false}
                    columns={[
                        {
                            title: 'User',
                            dataIndex: 'username',
                            render: (t, r) => (
                                <Space>
                                    <Avatar style={{ backgroundColor: '#87d068' }}>{t[0]?.toUpperCase()}</Avatar>
                                    <div>
                                        <b>{r.full_name}</b><br />
                                        <span style={{ color: '#888', fontSize: 12 }}>@{t}</span>
                                    </div>
                                </Space>
                            )
                        },
                        {
                            title: 'Hoạt động cuối',
                            dataIndex: 'last_activity_at',
                            render: (t) => t ? <Tag color="blue">{dayjs(t).fromNow()}</Tag> : '-'
                        },
                        {
                            title: 'IP Address',
                            dataIndex: 'ip_address',
                            render: (t) => t ? <Tag icon={<WifiOutlined />}>{t}</Tag> : '-'
                        },
                        {
                            title: 'Thiết bị',
                            dataIndex: 'device_info',
                            ellipsis: true,
                            render: (t) => (
                                <Tooltip title={t}>
                                    <Space><DesktopOutlined /> <span style={{ fontSize: 12 }}>{t}</span></Space>
                                </Tooltip>
                            )
                        }
                    ]}
                />
            </Modal>
            <Modal
                title={`Đổi mật khẩu cho: ${changePassUser?.username}`}
                open={!!changePassUser}
                onCancel={() => setChangePassUser(null)}
                onOk={() => passForm.submit()}
            >
                <Form form={passForm} layout="vertical" onFinish={handleChangePass}>
                    <Form.Item
                        name="password"
                        label="Mật khẩu mới"
                        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới' }]}
                    >
                        <Input.Password placeholder="Nhập mật khẩu mới..." />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default UsersPage;