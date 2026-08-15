import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Checkbox, Row, Col, Divider, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import api from '../utils/api';

// Danh sách các Module trong hệ thống để phân quyền
const SYSTEM_MODULES = [
    { code: 'DASHBOARD', name: 'Tổng quan' },
    { code: 'PRODUCT', name: 'Quản lý Sản phẩm' },
    { code: 'SALES', name: 'Bán hàng (Sales/CRM)' },
    { code: 'INVENTORY', name: 'Kho & Tồn kho' },
    { code: 'PURCHASE', name: 'Mua hàng (PO)' },
    { code: 'PRODUCTION', name: 'Sản xuất (MRP)' },
    { code: 'FINANCE', name: 'Tài chính (Thu/Chi)' },
    { code: 'HR', name: 'Nhân sự (HR)' },
    { code: 'USERS', name: 'Hệ thống & User' },
    { code: 'CMS', name: 'CMS Website' },
    { code: 'FUP_SALES', name: 'BOD FollowUp - Cột Sales (Chăm sóc, Giao hàng)' },
    { code: 'FUP_PURCHASE', name: 'BOD FollowUp - Cột Mua hàng (NPL)' },
    { code: 'FUP_PRODUCTION', name: 'BOD FollowUp - Cột Sản xuất (Sản xuất, Thiết kế...)' },
    { code: 'FUP_ACCOUNTING', name: 'BOD FollowUp - Cột Công Nợ' },
    { code: 'FUP_MEDIA', name: 'BOD FollowUp - Cột Chụp Mẫu (Media)' },
    { code: 'FUP_OTHER', name: 'BOD FollowUp - Cột Ghi chú Khác' },
];

const UserGroupsPage: React.FC = () => {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<any>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [form] = Form.useForm();

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users/groups');
            setGroups(res.data);
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchGroups(); }, []);

    const openModal = (group?: any) => {
        setEditingGroup(group);
        form.resetFields();

        // Init Permissions Matrix
        const initialPerms = SYSTEM_MODULES.map(mod => {
            const exist = group?.permissions?.find((p: any) => p.module_code === mod.code);
            return {
                module_code: mod.code,
                module_name: mod.name,
                can_view: exist?.can_view || false,
                can_create: exist?.can_create || false,
                can_update: exist?.can_update || false,
                can_delete: exist?.can_delete || false,
                view_cost_price: exist?.view_cost_price || false, // Thêm dòng này
            };
        });
        setPermissions(initialPerms);

        if (group) form.setFieldsValue({ name: group.name, description: group.description });
        setIsModalOpen(true);
    };

    const handlePermissionChange = (moduleCode: string, field: string, checked: boolean) => {
        setPermissions((prev: any[]) => prev.map((p: any) =>
            p.module_code === moduleCode ? { ...p, [field]: checked } : p
        ));
    };

    const handleSave = async (values: any) => {
        try {
            const payload = {
                ...values,
                permissions: permissions.map(({ module_name, ...rest }: any) => rest) // Bỏ tên hiển thị, chỉ lấy data
            };
            if (editingGroup) {
                // Update Logic (API chưa viết full update group name, ở đây giả định update permission)
                await api.post(`/users/groups/${editingGroup.id}/permissions`, { permissions: payload.permissions });
                message.success('Cập nhật quyền thành công');
            } else {
                await api.post('/users/groups', payload);
                message.success('Tạo nhóm mới thành công');
            }
            setIsModalOpen(false);
            fetchGroups();
        } catch (e) { message.error('Lỗi lưu dữ liệu'); }
    };

    const columns = [
        { title: 'Tên Nhóm', dataIndex: 'name', render: (t: any) => <b>{t}</b> },
        { title: 'Mô tả', dataIndex: 'description' },
        {
            title: 'Quyền hạn',
            render: (_: any, r: any) => (
                <Tag color="blue">{r.permissions?.length || 0} modules được cấu hình</Tag>
            )
        },
        {
            title: '', key: 'action', align: 'right' as const,
            render: (_: any, r: any) => <Button icon={<EditOutlined />} onClick={() => openModal(r)}>Phân quyền</Button>
        }
    ];

    return (
        <Card title="Quản lý Nhóm & Phân Quyền (Roles)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Tạo Nhóm Mới</Button>}>
            <Table dataSource={groups} columns={columns} rowKey="id" loading={loading} />

            <Modal title={editingGroup ? `Phân quyền: ${editingGroup.name}` : "Tạo Nhóm Mới"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} width={800}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    {!editingGroup && (
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="name" label="Tên Nhóm" rules={[{ required: true }]}><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="description" label="Mô tả"><Input /></Form.Item></Col>
                        </Row>
                    )}

                    <Divider orientation="left"><SafetyCertificateOutlined /> Ma trận phân quyền</Divider>

                    <div style={{ background: '#fafafa', padding: 10, borderRadius: 8 }}>
                        <Row style={{ fontWeight: 'bold', marginBottom: 10, borderBottom: '1px solid #ddd', paddingBottom: 5 }}>
                            <Col span={7}>Chức năng (Module)</Col>
                            <Col span={3} style={{ textAlign: 'center' }}>Xem (View)</Col>
                            <Col span={3} style={{ textAlign: 'center' }}>Tạo (Create)</Col>
                            <Col span={3} style={{ textAlign: 'center' }}>Sửa (Update)</Col>
                            <Col span={3} style={{ textAlign: 'center' }}>Xóa (Delete)</Col>
                            <Col span={5} style={{ textAlign: 'center' }}>Xem Giá Vốn</Col> {/* Thêm Header */}
                        </Row>
                        {permissions.map((p: any) => (
                            <Row key={p.module_code} style={{ marginBottom: 8, borderBottom: '1px dashed #eee', paddingBottom: 5 }} align="middle">
                                <Col span={7}><b>{p.module_name}</b></Col>
                                <Col span={3} style={{ textAlign: 'center' }}><Checkbox checked={p.can_view} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_view', e.target.checked)} /></Col>
                                <Col span={3} style={{ textAlign: 'center' }}><Checkbox checked={p.can_create} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_create', e.target.checked)} /></Col>
                                <Col span={3} style={{ textAlign: 'center' }}><Checkbox checked={p.can_update} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_update', e.target.checked)} /></Col>
                                <Col span={3} style={{ textAlign: 'center' }}><Checkbox checked={p.can_delete} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_delete', e.target.checked)} /></Col>
                                <Col span={5} style={{ textAlign: 'center' }}><Checkbox checked={p.view_cost_price} onChange={(e: any) => handlePermissionChange(p.module_code, 'view_cost_price', e.target.checked)} /></Col> {/* Thêm Checkbox */}
                            </Row>
                        ))}
                    </div>
                </Form>
            </Modal>
        </Card>
    );
};

export default UserGroupsPage;