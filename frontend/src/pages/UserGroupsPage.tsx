import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Checkbox, Row, Col, Divider, Tag, Space, Alert, Spin } from 'antd';
import { PlusOutlined, EditOutlined, SafetyCertificateOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../utils/api';

interface CatalogModule {
    code: string;
    name: string;
    group: string;
}

const UserGroupsPage: React.FC = () => {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [catalogModules, setCatalogModules] = useState<CatalogModule[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogFailed, setCatalogFailed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<any>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [form] = Form.useForm();

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users/groups');
            setGroups(res.data);
        } catch (e) {
            message.error('Lỗi tải dữ liệu');
        }
        setLoading(false);
    };

    const fetchCatalog = async () => {
        setCatalogLoading(true);
        try {
            const res = await api.get('/auth/permission-catalog');
            if (res.data?.modules && Array.isArray(res.data.modules)) {
                setCatalogModules(res.data.modules);
                setCatalogFailed(false);
            } else {
                throw new Error('Invalid format');
            }
        } catch (e) {
            setCatalogFailed(true);
            message.error('Không thể tải catalog quyền');
        } finally {
            setCatalogLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
        fetchCatalog();
    }, []);

    const buildPermissionsMatrix = useCallback((group: any, catalog: CatalogModule[]) => {
        const initialPerms = catalog.map(mod => {
            const exist = group?.permissions?.find((p: any) => p.module_code === mod.code);
            return {
                module_code: mod.code,
                module_name: mod.name,
                group: mod.group || 'Chung',
                can_view: exist?.can_view || false,
                can_create: exist?.can_create || false,
                can_update: exist?.can_update || false,
                can_delete: exist?.can_delete || false,
                view_cost_price: exist?.view_cost_price || false,
            };
        });
        setPermissions(initialPerms);
    }, []);

    // Rebuild matrix if catalogModules finishes loading while modal is open (A2-b)
    useEffect(() => {
        if (isModalOpen && catalogModules.length > 0) {
            buildPermissionsMatrix(editingGroup, catalogModules);
        }
    }, [catalogModules, isModalOpen, editingGroup, buildPermissionsMatrix]);

    const openModal = (group?: any) => {
        setEditingGroup(group);
        form.resetFields();

        // Init Permissions Matrix dynamically from loaded catalog
        buildPermissionsMatrix(group, catalogModules);

        if (group) form.setFieldsValue({ name: group.name, description: group.description });
        setIsModalOpen(true);
    };

    const handlePermissionChange = (moduleCode: string, field: string, checked: boolean) => {
        setPermissions((prev: any[]) => prev.map((p: any) =>
            p.module_code === moduleCode ? { ...p, [field]: checked } : p
        ));
    };

    const handleSave = async (values: any) => {
        if (catalogFailed || catalogModules.length === 0) {
            message.error('Không thể tải catalog quyền, vui lòng thử lại');
            return;
        }

        try {
            // Retain any existing group permissions whose module_code is not in the catalog (A2-d)
            const existingGroupPerms = editingGroup?.permissions || [];
            const uncataloguedPerms = existingGroupPerms.filter(
                (p: any) => !catalogModules.some(mod => mod.code === p.module_code)
            ).map(({ module_name, group, ...rest }: any) => rest);

            const activePerms = permissions.map(({ module_name, group, ...rest }: any) => rest);
            const mergedPermissions = [...activePerms, ...uncataloguedPerms];

            const payload = {
                ...values,
                permissions: mergedPermissions
            };

            if (editingGroup) {
                await api.post(`/users/groups/${editingGroup.id}/permissions`, { permissions: payload.permissions });
                message.success('Cập nhật quyền thành công');
            } else {
                await api.post('/users/groups', payload);
                message.success('Tạo nhóm mới thành công');
            }
            setIsModalOpen(false);
            fetchGroups();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi lưu dữ liệu');
        }
    };

    const isActionDisabled = catalogLoading || catalogFailed;

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
            render: (_: any, r: any) => (
                <Button
                    icon={<EditOutlined />}
                    onClick={() => openModal(r)}
                    disabled={isActionDisabled}
                >
                    Phân quyền
                </Button>
            )
        }
    ];

    // Group permissions dynamically by API 'group' values, preserving catalog order (A5)
    const uniqueGroups = Array.from(new Set(catalogModules.map(m => m.group || 'Chung')));
    const groupedPermissions = uniqueGroups.map(grpName => ({
        key: grpName,
        title: grpName,
        items: permissions.filter(p => (p.group || 'Chung') === grpName)
    })).filter(g => g.items.length > 0);

    return (
        <Card
            title="Quản lý Nhóm & Phân Quyền (Roles)"
            extra={
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => { fetchGroups(); fetchCatalog(); }}>Tải lại</Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openModal(null)}
                        disabled={isActionDisabled}
                    >
                        Tạo Nhóm Mới
                    </Button>
                </Space>
            }
        >
            <Table dataSource={groups} columns={columns} rowKey="id" loading={loading} />

            <Modal
                title={editingGroup ? `Phân quyền: ${editingGroup.name}` : "Tạo Nhóm Mới"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={850}
                okButtonProps={{ disabled: isActionDisabled }}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    {!editingGroup && (
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="name" label="Tên Nhóm" rules={[{ required: true, message: 'Vui lòng nhập tên nhóm' }]}><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="description" label="Mô tả"><Input /></Form.Item></Col>
                        </Row>
                    )}

                    <Divider orientation="left"><SafetyCertificateOutlined /> Ma trận phân quyền</Divider>

                    {catalogFailed && (
                        <Alert
                            type="error"
                            showIcon
                            message="Không thể tải catalog quyền. Vui lòng thử tải lại hoặc liên hệ quản trị."
                            style={{ marginBottom: 12 }}
                        />
                    )}

                    {catalogLoading ? (
                        <div style={{ textAlign: 'center', padding: 24 }}><Spin tip="Đang tải catalog quyền..." /></div>
                    ) : (
                        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8 }}>
                            <Row style={{ fontWeight: 'bold', marginBottom: 10, borderBottom: '1px solid #ddd', paddingBottom: 5 }}>
                                <Col span={7}>Chức năng (Module)</Col>
                                <Col span={3} style={{ textAlign: 'center' }}>Xem (View)</Col>
                                <Col span={3} style={{ textAlign: 'center' }}>Tạo (Create)</Col>
                                <Col span={3} style={{ textAlign: 'center' }}>Sửa (Update)</Col>
                                <Col span={3} style={{ textAlign: 'center' }}>Xóa (Delete)</Col>
                                <Col span={5} style={{ textAlign: 'center' }}>Xem Giá Vốn</Col>
                            </Row>

                            {groupedPermissions.map(group => (
                                <div key={group.key} style={{ marginBottom: 14 }}>
                                    <div style={{
                                        fontWeight: 600,
                                        color: '#1677ff',
                                        margin: '10px 0 6px',
                                        fontSize: 12,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                        borderBottom: '1px solid #e8e8e8',
                                        paddingBottom: 4
                                    }}>
                                        {group.title}
                                    </div>
                                    {group.items.map((p: any) => (
                                        <Row key={p.module_code} style={{ marginBottom: 8, borderBottom: '1px dashed #eee', paddingBottom: 5 }} align="middle">
                                            <Col span={7}>
                                                <b>{p.module_name}</b>
                                                <div style={{ color: '#888', fontSize: 11 }}>{p.module_code}</div>
                                            </Col>
                                            <Col span={3} style={{ textAlign: 'center' }}>
                                                <Checkbox checked={p.can_view} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_view', e.target.checked)} />
                                            </Col>
                                            <Col span={3} style={{ textAlign: 'center' }}>
                                                <Checkbox checked={p.can_create} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_create', e.target.checked)} />
                                            </Col>
                                            <Col span={3} style={{ textAlign: 'center' }}>
                                                <Checkbox checked={p.can_update} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_update', e.target.checked)} />
                                            </Col>
                                            <Col span={3} style={{ textAlign: 'center' }}>
                                                <Checkbox checked={p.can_delete} onChange={(e: any) => handlePermissionChange(p.module_code, 'can_delete', e.target.checked)} />
                                            </Col>
                                            <Col span={5} style={{ textAlign: 'center' }}>
                                                <Checkbox checked={p.view_cost_price} onChange={(e: any) => handlePermissionChange(p.module_code, 'view_cost_price', e.target.checked)} />
                                            </Col>
                                        </Row>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </Form>
            </Modal>
        </Card>
    );
};

export default UserGroupsPage;