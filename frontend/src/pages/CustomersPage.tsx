import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, InputNumber, Popconfirm, Space, Tag, Row, Col, Select, Tabs, Divider, DatePicker, Statistic, Tooltip } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SearchOutlined, AuditOutlined, MinusCircleOutlined, BranchesOutlined, HistoryOutlined, DollarOutlined, MessageOutlined, RobotOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import { API_URL } from '../config';
import LeadCarePanel from '../components/crm/LeadCarePanel';
import CustomerPortrait360Tab from '../components/crm/CustomerPortrait360Tab';
import useMobile from '../hooks/useMobile';
import usePermission from '../hooks/usePermission';

const { Option } = Select;

const CustomersPage: React.FC = () => {
    const [customers, setCustomers] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [filteredData, setFilteredData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const isMobile = useMobile();
    const { canCreate, canUpdate, canDelete } = usePermission('SALES');

    // State Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [activeTabKey, setActiveTabKey] = useState('1');

    // State History Orders
    const [historyOrders, setHistoryOrders] = useState<any[]>([]);
    const [filterYear, setFilterYear] = useState<dayjs.Dayjs | null>(null); // Mặc định = ALL

    const [form] = Form.useForm();

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [res, resUsers] = await Promise.all([
                api.get('/customers'),
                api.get('/users')
            ]);
            setCustomers(res.data);
            setUsers(resUsers.data);
            setFilteredData(res.data);
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // Fetch Orders khi mở Modal Edit
    const fetchOrders = async (customerId: number) => {
        try {
            const res = await api.get(`/customers/${customerId}/orders`);
            setHistoryOrders(res.data);
        } catch (e) { setHistoryOrders([]); }
    };

    // Search Logic
    useEffect(() => {
        const lower = searchText.toLowerCase();
        const filtered = customers.filter(c =>
            (c.name && c.name.toLowerCase().includes(lower)) ||
            (c.code && c.code.toLowerCase().includes(lower)) ||
            (c.phone && c.phone.includes(lower))
        );
        setFilteredData(filtered);
    }, [searchText, customers]);

    // Logic Filter & Calculate Revenue theo Năm
    const { filteredOrders, revenueStats } = useMemo(() => {
        // Nếu không chọn năm (null) => hiển thị ALL
        const list = filterYear ? historyOrders.filter(o => dayjs(o.order_date).year() === filterYear.year()) : historyOrders;

        const stats = list.reduce((acc, curr) => ({
            total: acc.total + Number(curr.total_amount),
            paid: acc.paid + Number(curr.paid_amount),
            debt: acc.debt + (Number(curr.total_amount) - Number(curr.paid_amount))
        }), { total: 0, paid: 0, debt: 0 });

        return { filteredOrders: list, revenueStats: stats };
    }, [historyOrders, filterYear]);

    // Save
    const handleSave = async (values: any) => {
        try {
            if (editingItem) {
                await api.put(`/customers/${editingItem.id}`, values);
                message.success('Cập nhật thành công');
            } else {
                await api.post('/customers', values);
                message.success('Thêm mới thành công');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    // Delete
    const handleDelete = async (id: number) => {
        try { await api.delete(`/customers/${id}`); message.success('Đã xóa'); fetchData(); }
        catch (e) { message.error('Không thể xóa (KH đã có dữ liệu ràng buộc)'); }
    };

    const handleImpersonate = async (id: number) => {
        try {
            const res = await api.post(`/customers/${id}/impersonate`);
            const { token, slug } = res.data;
            sessionStorage.setItem('portal_token', token);
            window.open(`/portal/${slug}`, '_blank');
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể xem portal khách hàng này');
        }
    };

    // Helper to mask phone
    const renderMaskedPhone = (phone: string) => {
        if (!phone) return '';
        if (phone.includes('@')) return phone; // Email
        if (phone.length <= 3) return phone;
        const visible = phone.slice(-3);
        const masked = '*'.repeat(phone.length - 3) + visible;
        return (
            <Tooltip title={phone}>
                <span style={{ cursor: 'pointer' }}>{masked}</span>
            </Tooltip>
        );
    };

    const columns = [
        { title: 'Mã KH', dataIndex: 'code', width: 100, render: (t: any) => <b>{t}</b> },
        {
            title: 'Tên Khách Hàng', dataIndex: 'name',
            render: (t: any, r: any) => (
                <div>
                    <div style={{ fontWeight: 500, color: '#1890ff' }}>{t}</div>
                    {r.parent && <Tag icon={<BranchesOutlined />} color="purple" style={{ marginTop: 4 }}>Thuộc: {r.parent.name}</Tag>}
                    <div style={{ color: '#888', fontSize: 12 }}>{r.address}</div>
                </div>
            )
        },
        {
            title: 'Phân Loại', dataIndex: 'type', width: 100, align: 'center' as const,
            render: (t: any) => t === 'CUSTOMER' ? <Tag color="blue">Khách Hàng</Tag> : <Tag color="orange">Tiềm Năng</Tag>
        },
        {
            title: 'Liên Hệ', key: 'contact', width: 200,
            render: (_: any, r: any) => {
                if (r.contacts && r.contacts.length > 0) {
                    const c = r.contacts[0];
                    return (
                        <div>
                            <UserOutlined /> {c.full_name} <br />
                            <small>{c.phone ? renderMaskedPhone(c.phone) : c.email}</small>
                            {r.contacts.length > 1 && <Tag style={{ marginLeft: 5 }}>+{r.contacts.length - 1}</Tag>}
                        </div>
                    )
                }
                return <div><UserOutlined /> {renderMaskedPhone(r.phone)}</div>
            }
        },
        {
            title: 'Doanh Thu', dataIndex: 'total_revenue', align: 'right' as const, width: 120,
            render: (v: any) => <b>{Number(v || 0).toLocaleString()}</b>
        },
        {
            title: 'Công Nợ', dataIndex: 'current_debt', align: 'right' as const, width: 120,
            render: (v: any) => <span style={{ color: v > 0 ? 'red' : 'green' }}>{Number(v).toLocaleString()}</span>
        },
        {
            title: 'Phụ trách', dataIndex: 'assigned_to', width: 120,
            render: (u: any) => u ? <Tag color="blue">{u.full_name || u.username}</Tag> : '-'
        },
        {
            title: '', key: 'action', width: 140, align: 'right' as const,
            render: (_: any, r: any) => (
                <Space>
                    <Tooltip title="Chân dung 360°">
                        <Button
                            icon={<RobotOutlined style={{ color: '#722ed1' }} />}
                            size="small"
                            onClick={() => {
                                setEditingItem(r);
                                form.setFieldsValue({
                                    ...r,
                                    assigned_to_id: r.assigned_to?.id
                                });
                                setActiveTabKey('7');
                                setIsModalOpen(true);
                                fetchOrders(r.id);
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="View Portal (Impersonate)">
                        <Button icon={<UserOutlined />} size="small" onClick={() => handleImpersonate(r.id)} />
                    </Tooltip>
                    {canUpdate && <Button icon={<EditOutlined />} size="small" onClick={() => {
                        setEditingItem(r);
                        form.setFieldsValue({
                            ...r,
                            assigned_to_id: r.assigned_to?.id // Map assigned user
                        });
                        setActiveTabKey('1');
                        setIsModalOpen(true);
                        fetchOrders(r.id); // Load lịch sử mua hàng
                    }} />}
                    {canDelete && <Popconfirm title="Xóa?" onConfirm={() => handleDelete(r.id)}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>}
                </Space>
            ),
        },
    ];

    const historyColumns = [
        { title: 'Ngày Đơn', dataIndex: 'order_date', render: (t: any) => dayjs(t).format('DD/MM/YYYY') },
        { title: 'Mã Đơn', dataIndex: 'order_code', render: (t: any) => <b>{t}</b> },
        { title: 'Trạng Thái', dataIndex: 'status', render: (t: any) => <Tag>{t}</Tag> },
        { title: 'Tổng Tiền', dataIndex: 'total_amount', align: 'right' as const, render: (v: any) => <b>{Number(v).toLocaleString()}</b> },
        { title: 'Đã Thanh Toán', dataIndex: 'paid_amount', align: 'right' as const, render: (v: any) => <span style={{ color: 'green' }}>{Number(v).toLocaleString()}</span> },
    ];

    return (
        <div>
            <Card
                bodyStyle={{ padding: isMobile ? '8px 12px' : undefined }}
                title={<span style={{ fontSize: isMobile ? 14 : 16 }}>Khách Hàng</span>}
                extra={
                    isMobile ? (
                        <Space size={4}>
                            {canCreate && <Button icon={<PlusOutlined />} type="primary" onClick={() => { setEditingItem(null); form.resetFields(); setActiveTabKey('1'); setIsModalOpen(true); setHistoryOrders([]); }} />}
                            <Button icon={<ReloadOutlined />} onClick={fetchData} />
                        </Space>
                    ) : (
                        <Space>
                            {canCreate && <Button icon={<PlusOutlined />} type="primary" onClick={() => { setEditingItem(null); form.resetFields(); setActiveTabKey('1'); setIsModalOpen(true); setHistoryOrders([]); }}>Thêm Mới</Button>}
                            <Button icon={<ReloadOutlined />} onClick={fetchData}>Tải lại</Button>
                        </Space>
                    )
                }
            >
                <div style={{ marginBottom: 16 }}>
                    <Input placeholder="Tìm kiếm..." prefix={<SearchOutlined style={{ color: '#ccc' }} />} style={{ width: isMobile ? '100%' : 300 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
                </div>
                <Table columns={columns} dataSource={filteredData} rowKey="id" loading={loading} bordered pagination={{ pageSize: 10 }} />
            </Card>

            <Modal
                title={editingItem ? `Sửa: ${editingItem.name}` : "Thêm Khách Hàng"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={1150}
                style={{ top: 20 }}
            >
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ type: 'LEAD', credit_limit: 0 }}>
                    <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={[
                        {
                            key: '1', label: 'Thông tin khách hàng',
                            children: (
                                <>
                                    <Row gutter={16}>
                                        <Col span={8}><Form.Item name="code" label="Mã KH" tooltip="Để trống để tự động tạo mã"><Input disabled={!!editingItem} placeholder="Tự động: KH-YYMM-XXXX" /></Form.Item></Col>
                                        <Col span={16}><Form.Item name="name" label="Tên Khách Hàng" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                    </Row>
                                    <Row gutter={16}><Col span={12}><Form.Item name="phone" label="SĐT"><Input /></Form.Item></Col><Col span={12}><Form.Item name="email" label="Email"><Input /></Form.Item></Col></Row>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item name="facebook" label="Facebook"><Input placeholder="Link Facebook" /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="website" label="Website"><Input placeholder="Link Website" /></Form.Item></Col>
                                    </Row>
                                    <Form.Item name="address" label="Địa Chỉ (Trụ sở chính)"><Input /></Form.Item>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item name="province" label="Tỉnh/Thành phố"><Input placeholder="VD: Hà Nội, TP.HCM..." /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="district" label="Quận/Huyện"><Input placeholder="VD: Cầu Giấy, Quận 1..." /></Form.Item></Col>
                                    </Row>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item name="parent_id" label="Công ty mẹ"><Select allowClear showSearch optionFilterProp="label" options={customers.filter(c => c.id !== editingItem?.id).map(c => ({ label: c.name, value: c.id }))} /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="credit_limit" label="Hạn Mức Nợ"><InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                    </Row>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item name="type" label="Phân Loại"><Select><Option value="LEAD">Tiềm Năng</Option><Option value="CUSTOMER">Khách Hàng</Option></Select></Form.Item></Col>
                                        <Col span={12}>
                                            <Form.Item name="assigned_to_id" label="Nhân viên phụ trách">
                                                <Select allowClear showSearch optionFilterProp="label" options={users.map(u => ({ label: u.full_name || u.username, value: u.id }))} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )
                        },
                        {
                            key: '2', label: 'Liên hệ',
                            children: (
                                <Form.List name="contacts">
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8, borderBottom: '1px dashed #eee', paddingBottom: 5 }}>
                                                    <Col span={8}><Form.Item {...restField} name={[name, 'full_name']} noStyle rules={[{ required: true }]}><Input placeholder="Họ Tên" prefix={<UserOutlined />} /></Form.Item></Col>
                                                    <Col span={6}><Form.Item {...restField} name={[name, 'job_title']} noStyle><Input placeholder="Chức danh" /></Form.Item></Col>
                                                    <Col span={8}><Form.Item {...restField} name={[name, 'phone']} noStyle><Input placeholder="SĐT/Email" /></Form.Item></Col>
                                                    <Col span={2}><MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} /></Col>
                                                </Row>
                                            ))}
                                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm liên hệ</Button>
                                        </>
                                    )}
                                </Form.List>
                            )
                        },
                        {
                            key: '3', label: 'Pháp nhân',
                            children: (
                                <>
                                    <Form.Item name="legal_name" label="Tên Pháp Nhân (Trên Hóa Đơn)"><Input /></Form.Item>
                                    <Form.Item name="legal_address" label="Địa Chỉ Pháp Lý"><Input /></Form.Item>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item name="tax_code" label="Mã Số Thuế"><Input /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="legal_representative" label="Người Đại Diện"><Input /></Form.Item></Col>
                                    </Row>
                                    <Form.Item name="einvoice_email" label="Email Nhận Hóa Đơn eInvoice"><Input /></Form.Item>
                                </>
                            )
                        },
                        {
                            key: '4', label: 'Thông tin giao hàng',
                            children: (
                                <Form.List name="delivery_addresses">
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <div key={key} style={{ marginBottom: 12, border: '1px solid #f0f0f0', padding: 10, borderRadius: 5, background: '#fafafa' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                        <b>Chi nhánh / Kho {name + 1}</b>
                                                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red', cursor: 'pointer' }} />
                                                    </div>
                                                    <Row gutter={8}>
                                                        <Col span={8}><Form.Item {...restField} name={[name, 'name']} label="Tên Chi Nhánh / Kho" rules={[{ required: true }]}><Input placeholder="Vd: Kho HCM..." /></Form.Item></Col>
                                                        <Col span={16}><Form.Item {...restField} name={[name, 'address']} label="Địa chỉ giao hàng" rules={[{ required: true }]}><Input placeholder="Số nhà, đường..." /></Form.Item></Col>
                                                    </Row>
                                                </div>
                                            ))}
                                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm Chi nhánh / Địa chỉ</Button>
                                        </>
                                    )}
                                </Form.List>
                            )
                        },
                        {
                            key: '5', label: <span style={{ color: '#1890ff' }}><HistoryOutlined /> Lịch sử Mua Hàng</span>,
                            disabled: !editingItem,
                            children: (
                                <div>
                                    <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 10, borderRadius: 8 }}>
                                        <Space size={20} align="center">
                                            <span>Lọc theo năm:</span>
                                            <DatePicker picker="year" value={filterYear} onChange={setFilterYear} allowClear placeholder="Tất cả" />
                                            <Divider type="vertical" />
                                            <Statistic title="Doanh Thu" value={revenueStats.total} prefix={<DollarOutlined />} valueStyle={{ fontSize: 16, color: '#1890ff' }} />
                                            <Statistic title="Đã Thu" value={revenueStats.paid} valueStyle={{ fontSize: 16, color: 'green' }} />
                                            <Statistic title="Công Nợ" value={revenueStats.debt} valueStyle={{ fontSize: 16, color: 'red' }} />
                                        </Space>
                                    </div>
                                    <Table
                                        columns={historyColumns}
                                        dataSource={filteredOrders}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 5 }}
                                        scroll={{ y: 200 }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: '6', label: <span style={{ color: '#52c41a' }}><MessageOutlined /> Chăm sóc Lead</span>,
                            children: (
                                editingItem ? (
                                    <LeadCarePanel customerId={editingItem.id} customerName={editingItem.name} />
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chọn khách hàng để xem</div>
                                )
                            )
                        },
                        {
                            key: '7', label: <span style={{ color: '#722ed1', fontWeight: 600 }}><RobotOutlined /> Chân dung 360°</span>,
                            children: (
                                editingItem ? (
                                    <CustomerPortrait360Tab customerId={editingItem.id} customerName={editingItem.name} />
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chọn khách hàng để xem Chân dung 360°</div>
                                )
                            )
                        }
                    ]} />
                </Form>
            </Modal>
        </div>
    );
};

export default CustomersPage;