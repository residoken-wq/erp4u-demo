import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Select, Tag, Space, Popconfirm, Row, Col, Divider, Drawer, List, DatePicker, InputNumber, Checkbox, Radio, Typography, Tooltip, Tabs, Statistic, Avatar, Segmented, Dropdown, Menu } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, BankOutlined, DollarOutlined, AppstoreOutlined, CalendarOutlined, StarFilled, StarOutlined, ShopOutlined, LinkOutlined, ReloadOutlined, HistoryOutlined, MoreOutlined, FilterOutlined, EnvironmentOutlined, PhoneOutlined, MailOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_URL } from '../config';
import useMobile from '../hooks/useMobile';
import RichTextEditor from '../components/common/RichTextEditor';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const SuppliersPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filterType, setFilterType] = useState<string>('ALL');
    const isMobile = useMobile();

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // DRAWER PRICE STATE
    const [priceDrawerOpen, setPriceDrawerOpen] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState<any>(null);
    const [priceList, setPriceList] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);

    // Input State for Price
    const [selectedMatId, setSelectedMatId] = useState<number | null>(null);
    const [inputPrice, setInputPrice] = useState<number>(0);
    const [dateRange, setDateRange] = useState<any>([dayjs(), dayjs().add(1, 'year')]);
    const [isDefault, setIsDefault] = useState(false);

    const [form] = Form.useForm();

    // 1. Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/suppliers`);
            setData(Array.isArray(res.data) ? res.data : []);
            // Load NPL
            const resMat = await axios.get(`${API_URL}/materials`);
            if (Array.isArray(resMat.data)) setMaterials(resMat.data.map((m: any) => ({ label: `${m.code} - ${m.name} (${m.unit})`, value: m.id })));
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // 2. Main CRUD
    const handleSave = async (values: any) => {
        try {
            if (editingItem) await axios.put(`${API_URL}/suppliers/${editingItem.id}`, values);
            else await axios.post(`${API_URL}/suppliers`, values);
            message.success('Thành công'); setIsModalOpen(false); fetchData();
        } catch (e) { message.error('Lỗi lưu'); }
    };

    const handleDelete = async (id: number) => {
        try { await axios.delete(`${API_URL}/suppliers/${id}`); fetchData(); } catch (e) { message.error('Lỗi xóa'); }
    };

    // DRAWER PRICE STATE REMOVED - MERGED INTO MAIN DRAWER
    // Just need a flag to set default tab

    // New State for PO History
    const [supplierPOs, setSupplierPOs] = useState<any[]>([]);

    // 3. Price Logic (Now inside Drawer)
    const openPriceList = async (supplier: any) => {
        setEditingItem(supplier);
        setCurrentSupplier(supplier);
        form.setFieldsValue(supplier);
        setPriceDrawerOpen(true); // Reuse this as 'IsPriceTabActive' or just set separate way
        // Hack: set IsModalOpen(true) and pass a prop? Or just IsModalOpen works.
        // Let's rely on standard open.
        // Actually, I need to pass default tab.
        setIsModalOpen(true);

        loadPrices(supplier.id);
        loadPOs(supplier.id);
        loadTransactions(supplier.id); // Fix: Load transactions
    };

    const loadPOs = async (supplierId: number) => {
        try {
            // Fallback to fetch all and filter if no endpoint
            const res = await axios.get(`${API_URL}/purchasing`);
            const all = Array.isArray(res.data) ? res.data : [];
            setSupplierPOs(all.filter((p: any) => p.supplier_id === supplierId || p.supplier?.id === supplierId));
        } catch (e) { }
    }

    const [supplierTransactions, setSupplierTransactions] = useState<any[]>([]);
    const [historyMode, setHistoryMode] = useState('PO'); // 'PO' | 'TRANS'

    const loadTransactions = async (supplierId: number) => {
        try {
            const res = await axios.get(`${API_URL}/suppliers/${supplierId}/transactions`); // New API
            setSupplierTransactions(res.data || []);
        } catch (e) { setSupplierTransactions([]); }
    }

    const loadPrices = async (id: number) => {
        try { const res = await axios.get(`${API_URL}/suppliers/${id}`); setPriceList(res.data.price_list || []); } catch (e) { setPriceList([]); }
    };

    const handleAddPrice = async () => {
        if (!selectedMatId || !inputPrice) return message.warning('Chọn NPL và nhập giá');
        try {
            await axios.post(`${API_URL}/suppliers/${currentSupplier.id}/material-price`, {
                material_id: selectedMatId,
                price: inputPrice,
                valid_from: dateRange?.[0], valid_to: dateRange?.[1],
                is_preferred: isDefault
            });
            message.success('Đã lưu giá');
            loadPrices(currentSupplier.id);
            // Reset nhẹ để nhập tiếp
            setSelectedMatId(null); setInputPrice(0); setIsDefault(false);
        } catch (e) { message.error('Lỗi thêm giá'); }
    };

    const handleRemovePrice = async (priceId: number) => {
        try {
            // Giả sử có API delete, nếu chưa có thì update controller
            await axios.delete(`${API_URL}/suppliers/material-price/${priceId}`).catch(() => message.info('Backend cần thêm API xóa'));
            loadPrices(currentSupplier.id);
        } catch (e) { }
    };

    // Columns Main Table
    const columns = [
        {
            title: 'Đối Tác / Nhà Cung Cấp',
            dataIndex: 'name',
            width: 300,
            render: (t: any, r: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar shape="square" size={48} style={{ backgroundColor: r.type === 'MATERIAL' ? '#1890ff' : r.type === 'PROCESSING' ? '#fa8c16' : '#722ed1', fontSize: 20 }}>
                        {t?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography.Text strong style={{ fontSize: 15, color: '#262626' }}>{t}</Typography.Text>
                        <Space size={4} style={{ fontSize: 12, color: '#8c8c8c' }}>
                            <Tag style={{ margin: 0 }}>{r.code}</Tag>
                            {r.legal_name && <Tooltip title={r.legal_name}><BankOutlined /></Tooltip>}
                            {r.phone && <Tooltip title={r.phone}><PhoneOutlined /></Tooltip>}
                            {r.email && <Tooltip title={r.email}><MailOutlined /></Tooltip>}
                        </Space>
                    </div>
                </div>
            )
        },
        {
            title: 'Loại hình', dataIndex: 'type', align: 'center' as const, width: 120, render: (t: any) => {
                const colors: any = { MATERIAL: 'blue', PROCESSING: 'orange', MIX: 'purple', SERVICE: 'cyan', LOGISTICS: 'geekblue', OTHER: 'default' };
                const labels: any = { MATERIAL: 'NPL', PROCESSING: 'Gia Công', MIX: 'Hỗn Hợp', SERVICE: 'Dịch Vụ', LOGISTICS: 'Vận Chuyển', OTHER: 'Khác' };
                return <Tag color={colors[t]} style={{ minWidth: 80, textAlign: 'center' }}>{labels[t] || t}</Tag>;
            }
        },
        {
            title: 'Địa chỉ / Ghi chú',
            dataIndex: 'address',
            ellipsis: true,
            render: (t: any, r: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {t ? <Text type="secondary" style={{ fontSize: 13 }}><EnvironmentOutlined /> {t}</Text> : null}
                    {r.note && <Text type="secondary" italic style={{ fontSize: 12 }}>{r.note}</Text>}
                </div>
            )
        },
        {
            title: 'Đã TT theo PO',
            dataIndex: 'paid_po',
            align: 'right' as const,
            width: 140,
            render: (v: any) => <span style={{ color: 'green', fontWeight: '500' }}>{Number(v || 0).toLocaleString()} ₫</span>
        },
        {
            title: 'Đã TT phiếu chi',
            dataIndex: 'paid_other',
            align: 'right' as const,
            width: 140,
            render: (v: any) => <span style={{ color: '#eb2f96', fontWeight: '500' }}>{Number(v || 0).toLocaleString()} ₫</span>
        },
        {
            title: 'Công nợ',
            dataIndex: 'debt',
            align: 'right' as const,
            width: 150,
            render: (v: any, r: any) => (
                <div>
                    <div style={{ fontWeight: 'bold', color: Number(v) > 0 ? '#cf1322' : '#52c41a' }}>
                        {Number(v || 0).toLocaleString()} <small>₫</small>
                    </div>
                    {Number(v) > 0 && <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => openDebtModal(r)}>Thanh toán ngay</Button>}
                </div>
            )
        },
        {
            key: 'act', align: 'right' as const, width: 80,
            render: (_: any, r: any) => (
                <Dropdown menu={{
                    items: [
                        { key: 'price', label: 'Bảng giá & Lịch sử', icon: <DollarOutlined />, onClick: () => openPriceList(r) },
                        { key: 'debt', label: 'Quản lý công nợ', icon: <BankOutlined />, onClick: () => openDebtModal(r) },
                        { type: 'divider' },
                        {
                            key: 'edit', label: 'Chỉnh sửa', icon: <EditOutlined />, onClick: () => {
                                setEditingItem(r);
                                form.setFieldsValue(r);
                                setPriceDrawerOpen(false);
                                setIsModalOpen(true);
                                loadPOs(r.id)
                            }
                        },
                        {
                            key: 'del', label: 'Xóa', icon: <DeleteOutlined />, danger: true, onClick: () => Modal.confirm({
                                title: 'Xóa Nhà Cung Cấp?', content: 'Hành động này không thể hoàn tác.', onOk: () => handleDelete(r.id)
                            })
                        },
                    ]
                }} trigger={['click']}>
                    <Button icon={<MoreOutlined />} type="text" />
                </Dropdown>
            )
        }
    ];

    const filteredData = data.filter(d => {
        const matchesSearch = d.name?.toLowerCase().includes(searchText.toLowerCase()) || d.code?.toLowerCase().includes(searchText.toLowerCase());
        const matchesType = filterType === 'ALL' || d.type === filterType;
        return matchesSearch && matchesType;
    });

    // --- LOGIC CÔNG NỢ & THANH TOÁN (MỚI) ---
    const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
    const [debtPOs, setDebtPOs] = useState<any[]>([]);
    const [selectedDebtPOs, setSelectedDebtPOs] = useState<any[]>([]);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentDate, setPaymentDate] = useState<any>(dayjs());
    const [vatCode, setVatCode] = useState('');
    const [vatUrl, setVatUrl] = useState('');
    const [allocations, setAllocations] = useState<Record<number, number>>({});

    const openDebtModal = async (supplier: any) => {
        setCurrentSupplier(supplier);
        setIsDebtModalOpen(true);
        // Fetch Unpaid POs
        try {
            const res = await axios.get(`${API_URL}/purchasing`); // Need filter by supplier & unpaid?
            // Since we don't have a dedicated endpoint yet, filter on client side for now or add endpoint.
            // Requirement: "user vào NCC... chọn các PO chưa thanh toán"
            // Let's filter client side from purchasing list for simplicity or fetch specific.
            // Better: GET /purchasing?supplier_id=X&status=UNPAID (if supported)
            // As fallback, let's just fetch all and filter.
            const allPOs = Array.isArray(res.data) ? res.data : [];
            const unpaid = allPOs.filter((p: any) =>
                (p.supplier?.id === supplier.id || p.supplier_id === supplier.id) &&
                (p.status !== 'CANCELLED') &&
                (Number(p.paid_amount || 0) < Number(p.total_amount))
            );
            setDebtPOs(unpaid);
            setSelectedDebtPOs([]);
            setAllocations({});
            setPaymentAmount(0);
        } catch (e) { message.error('Lỗi tải công nợ'); }
    };



    // ----------------------------------------

    const [activeTab, setActiveTab] = useState('1');

    // --- DEBT TAB LOGIC ---
    // Filter suppliers with debt > 0
    // Note: If debt column is not populated fully yet, we might fallback to checking 'debtPOs' but fetching POs for ALL suppliers is heavy.
    // For now, assume 'debt' field on Supplier is the source of truth or we iterate.
    // Actually, in fetch data, we load suppliers. Let's assume d.debt is present.
    // If not, we might need a separate endpoint /suppliers/with-debt.
    // Let's rely on what we have: `data` (list of suppliers).

    const suppliersWithDebt = data.filter(s => Number(s.debt) > 0);

    const debtColumns = [
        { title: 'Nhà Cung Cấp', dataIndex: 'name', render: (t: any, r: any) => <b>{t}</b> },
        { title: 'Tổng Công Nợ', dataIndex: 'debt', align: 'right' as const, render: (v: any) => <span style={{ color: 'red', fontWeight: 'bold' }}>{Number(v).toLocaleString()} ₫</span> },
        { title: 'SĐT', dataIndex: 'phone' },
        {
            title: 'Hành động', key: 'act', align: 'right' as const,
            render: (_: any, r: any) => (
                <Button type="primary" size="small" icon={<DollarOutlined />} onClick={() => openDebtModal(r)}>Thanh Toán</Button>
            )
        }
    ];

    const handleBulkPayment = async () => {
        try {
            const allocationData = selectedDebtPOs.map((p: any) => ({
                po_id: p.id,
                poCode: p.po_code,
                amount: allocations[p.id] || 0
            })).filter(a => a.amount > 0);

            if (allocationData.length === 0) {
                message.warning('Vui lòng nhập số tiền phân bổ lớn hơn 0 cho ít nhất 1 PO');
                return;
            }

            const totalAllocated = allocationData.reduce((sum, a) => sum + a.amount, 0);

            await axios.post(`${API_URL}/finance/payment/bulk-po`, {
                poCode: selectedDebtPOs.map((p: any) => p.id), // Send IDs array as fallback
                amount: totalAllocated,
                note: paymentNote,
                date: paymentDate,
                vatCode: vatCode,
                vatUrl: vatUrl,
                partnerName: currentSupplier.name,
                supplier_id: currentSupplier.id, // <--- IMPORTANT: Link Transaction to Supplier
                allocations: allocationData
            });
            message.success('Thanh toán thành công');
            setIsDebtModalOpen(false);
            fetchData(); // Reload main list
        } catch (e) { message.error('Lỗi thanh toán'); }
    };

    return (
        <div style={{ padding: isMobile ? '0 4px' : '0 12px' }}>
            {/* STATS CARDS - HORIZONTAL SCROLL ON MOBILE */}
            <div style={{ marginBottom: 24 }}>
                {!isMobile && <Title level={2} style={{ marginBottom: 24, fontWeight: 700 }}>Đối Tác & Nhà Cung Cấp</Title>}
                <div style={{ overflowX: isMobile ? 'auto' : 'visible' }}>
                    <Row gutter={[isMobile ? 8 : 16, 8]} wrap={!isMobile} style={{ flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: isMobile ? 600 : 'auto' }}>
                        <Col flex={isMobile ? '130px' : 1}>
                            <Card bordered={false} bodyStyle={{ padding: isMobile ? 10 : 16 }}>
                                <Statistic title={<span style={{ fontSize: isMobile ? 11 : 14 }}>Tổng NCC</span>} value={data.length} prefix={<ShopOutlined />} valueStyle={{ fontWeight: 'bold', fontSize: isMobile ? 18 : 24 }} />
                            </Card>
                        </Col>
                        <Col flex={isMobile ? '140px' : 1}>
                            <Card bordered={false} bodyStyle={{ padding: isMobile ? 10 : 16 }}>
                                <Statistic title={<span style={{ fontSize: isMobile ? 11 : 14 }}>Tổng Công Nợ</span>} value={suppliersWithDebt.reduce((acc, s) => acc + Number(s.debt), 0)} prefix={<DollarOutlined />} suffix="₫" valueStyle={{ color: '#cf1322', fontWeight: 'bold', fontSize: isMobile ? 16 : 24 }} />
                            </Card>
                        </Col>
                        <Col flex={isMobile ? '130px' : 1}>
                            <Card bordered={false} bodyStyle={{ padding: isMobile ? 10 : 16 }}>
                                <Statistic title={<span style={{ fontSize: isMobile ? 11 : 14 }}>NCC nợ</span>} value={suppliersWithDebt.length} prefix={<BankOutlined />} valueStyle={{ color: '#fa8c16', fontWeight: 'bold', fontSize: isMobile ? 18 : 24 }} />
                            </Card>
                        </Col>
                        <Col flex={isMobile ? '100px' : 1}>
                            <Card bordered={false} bodyStyle={{ padding: isMobile ? 10 : 16, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <Button type="primary" size={isMobile ? 'middle' : 'large'} icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true) }}>{isMobile ? '' : 'Thêm Mới'}</Button>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </div>

            <Card bordered={false} bodyStyle={{ padding: isMobile ? 8 : 0 }} style={{ overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 8 }}>
                <div style={{ padding: isMobile ? '8px' : '16px 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
                    <div style={{ display: 'flex', gap: isMobile ? 8 : 16, alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                        <Input placeholder="Tìm kiếm..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: isMobile ? '100%' : 280 }} size="middle" allowClear />
                        {!isMobile && <Divider type="vertical" />}
                        {isMobile ? (
                            <Select value={filterType} onChange={setFilterType} style={{ width: '100%' }} options={[
                                { label: 'Tất cả', value: 'ALL' },
                                { label: 'NPL', value: 'MATERIAL' },
                                { label: 'Gia Công', value: 'PROCESSING' },
                                { label: 'Dịch vụ', value: 'SERVICE' },
                                { label: 'Logistics', value: 'LOGISTICS' },
                            ]} />
                        ) : (
                            <>
                                <span style={{ color: '#8c8c8c' }}><FilterOutlined /> Lọc:</span>
                                <Segmented
                                    options={[
                                        { label: 'Tất cả', value: 'ALL' },
                                        { label: 'NPL', value: 'MATERIAL' },
                                        { label: 'Gia Công', value: 'PROCESSING' },
                                        { label: 'Dịch vụ', value: 'SERVICE' },
                                        { label: 'Logistics', value: 'LOGISTICS' },
                                        { label: 'Khác', value: 'OTHER' },
                                    ]}
                                    value={filterType}
                                    onChange={(v: string) => setFilterType(v)}
                                />
                            </>
                        )}
                    </div>
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    tabBarStyle={{ padding: '0 24px', marginBottom: 0 }}
                    items={[
                        {
                            key: '1',
                            label: `Danh sách (${loading ? '...' : filteredData.length})`,
                            children: <Table dataSource={filteredData} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total}` }} />
                        },
                        {
                            key: '2',
                            label: <span style={{ color: '#cf1322' }}>Quản Lý Công Nợ ({suppliersWithDebt.length})</span>,
                            children: (
                                <Table
                                    dataSource={suppliersWithDebt}
                                    rowKey="id"
                                    columns={[
                                        ...columns.slice(0, 3), // Reuse first 3 refined columns
                                        {
                                            title: 'Hành động', key: 'act', align: 'right' as const, width: 120,
                                            render: (_: any, r: any) => <Button type="primary" size="small" icon={<DollarOutlined />} onClick={() => openDebtModal(r)}>Thanh Toán</Button>
                                        }
                                    ]}
                                    loading={loading}
                                />
                            )
                        }
                    ]}
                />
            </Card>

            {/* UNIFIED DRAWER: DETAILS / EDIT / PRICE / HISTORY */}
            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar shape="square" style={{ backgroundColor: '#1890ff' }}>{editingItem?.name?.charAt(0).toUpperCase() || '+'}</Avatar>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{editingItem ? editingItem.name : "Thêm NCC Mới"}</div>
                            {editingItem && <div style={{ fontWeight: 400, fontSize: 12, color: '#888' }}>{editingItem.code} | {editingItem.type}</div>}
                        </div>
                    </div>
                }
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                width={850}
                extra={
                    <Space>
                        <Button onClick={() => setIsModalOpen(false)}>Đóng</Button>
                        <Button type="primary" onClick={() => form.submit()}>Lưu Thông Tin</Button>
                    </Space>
                }
            >
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ type: 'MATERIAL' }}>
                    <Tabs defaultActiveKey={priceDrawerOpen ? '2' : '1'} items={[
                        {
                            key: '1', label: 'Thông tin chung',
                            children: (
                                <div style={{ padding: '10px 0' }}>
                                    <Card size="small" bordered={false} style={{ background: '#f9f9f9', borderRadius: 8 }}>
                                        <Row gutter={16}>
                                            <Col span={8}><Form.Item name="code" label="Mã NCC" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                            <Col span={16}><Form.Item name="name" label="Tên Nhà Cung Cấp" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        </Row>
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="type" label="Loại hình"><Select options={[
                                                { label: 'Bán NPL', value: 'MATERIAL' },
                                                { label: 'Gia công', value: 'PROCESSING' },
                                                { label: 'Hỗn hợp', value: 'MIX' },
                                                { label: 'Dịch vụ', value: 'SERVICE' },
                                                { label: 'Vận chuyển', value: 'LOGISTICS' },
                                                { label: 'Khác', value: 'OTHER' }
                                            ]} /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="phone" label="SĐT Liên hệ"><Input /></Form.Item></Col>
                                        </Row>
                                        <Form.Item name="email" label="Email"><Input /></Form.Item>
                                        <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
                                        <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
                                    </Card>
                                    <Divider dashed >Thông tin Pháp nhân</Divider>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item name="legal_name" label="Tên Pháp Nhân VAT"><Input prefix={<BankOutlined />} /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="tax_code" label="Mã Số Thuế"><Input /></Form.Item></Col>
                                    </Row>
                                    <Form.Item name="vat_address" label="Đia chỉ ĐKKD"><Input /></Form.Item>
                                </div>
                            )
                        },
                        {
                            key: '2', label: 'Bảng giá & Nguyên liệu',
                            disabled: !editingItem,
                            children: (
                                <div>
                                    <div style={{ background: '#e6f7ff', padding: 15, marginBottom: 20, borderRadius: 8, border: '1px solid #91d5ff' }}>
                                        <div style={{ fontWeight: 'bold', color: '#0050b3', marginBottom: 10 }}><PlusOutlined /> Thêm giá mới</div>
                                        <Select showSearch placeholder="Chọn Nguyên Liệu..." style={{ width: '100%', marginBottom: 10 }} options={materials} value={selectedMatId} onChange={setSelectedMatId} filterOption={(input, option: any) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
                                        <Row gutter={10} style={{ marginBottom: 10 }}>
                                            <Col span={12}><InputNumber style={{ width: '100%' }} placeholder="Giá nhập" addonAfter="₫" value={inputPrice} onChange={(v: any) => setInputPrice(v)} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Col>
                                            <Col span={12}><RangePicker style={{ width: '100%' }} value={dateRange} onChange={setDateRange} format="DD/MM/YY" /></Col>
                                        </Row>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Checkbox checked={isDefault} onChange={e => setIsDefault(e.target.checked)}>Đặt làm giá mặc định (Tính BOM)</Checkbox>
                                            <Button type="primary" onClick={handleAddPrice}>Lưu Giá</Button>
                                        </div>
                                    </div>
                                    <List
                                        size="small"
                                        itemLayout="horizontal"
                                        dataSource={priceList}
                                        renderItem={(item: any) => (
                                            <List.Item actions={[<a key="del" style={{ color: 'red' }} onClick={() => handleRemovePrice(item.id)}>Xóa</a>]}>
                                                <List.Item.Meta
                                                    avatar={<Tag color="blue">{item.material?.unit}</Tag>}
                                                    title={<span>{item.material?.name} ({item.material?.code})</span>}
                                                    description={
                                                        <Space>
                                                            <b style={{ color: 'green' }}>{Number(item.price).toLocaleString()} ₫</b>
                                                            {item.is_preferred && <StarFilled style={{ color: '#faad14' }} />}
                                                            {item.valid_from && <span style={{ fontSize: 11, color: '#888' }}>{dayjs(item.valid_from).format('DD/MM')} - {item.valid_to ? dayjs(item.valid_to).format('DD/MM') : '∞'}</span>}
                                                        </Space>
                                                    }
                                                />
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            )
                        },
                        {
                            key: '3', label: <span style={{ color: '#096dd9' }}><HistoryOutlined /> Lịch sử Giao Dịch</span>,
                            disabled: !editingItem,
                            children: (
                                <div>
                                    <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                                        <Radio.Group value={historyMode} onChange={e => setHistoryMode(e.target.value)} buttonStyle="solid">
                                            <Radio.Button value="PO">Đơn Mua Hàng (PO)</Radio.Button>
                                            <Radio.Button value="TRANS">Giao Dịch (Phiếu Chi)</Radio.Button>
                                        </Radio.Group>
                                        <Button size="small" icon={<ReloadOutlined />} onClick={() => { loadPOs(editingItem?.id); loadTransactions(editingItem?.id); }}>Tải lại</Button>
                                    </div>

                                    {historyMode === 'PO' ? (
                                        <Table
                                            rowKey="id"
                                            size="small"
                                            dataSource={supplierPOs}
                                            scroll={{ y: 400 }}
                                            columns={[
                                                { title: 'Ngày', dataIndex: 'created_at', render: t => dayjs(t).format('DD/MM/YYYY') },
                                                { title: 'PO Code', dataIndex: 'po_code', render: t => <b>{t}</b> },
                                                { title: 'Trạng Thái', dataIndex: 'status', render: t => <Tag>{t}</Tag> },
                                                { title: 'Tổng Tiền', dataIndex: 'total_amount', align: 'right', render: v => Number(v).toLocaleString() },
                                                { title: 'Đã Trả', dataIndex: 'paid_amount', align: 'right', render: v => <span style={{ color: 'green' }}>{Number(v).toLocaleString()}</span> },
                                                { title: 'Còn Nợ', align: 'right', render: (t, r: any) => <b style={{ color: 'red' }}>{(Number(r.total_amount) - Number(r.paid_amount || 0)).toLocaleString()}</b> }
                                            ]}
                                        />
                                    ) : (
                                        <Table
                                            rowKey="id"
                                            size="small"
                                            dataSource={supplierTransactions}
                                            scroll={{ y: 400 }}
                                            columns={[
                                                { title: 'Mã GD', dataIndex: 'id', width: 80, render: t => `#${t}` },
                                                { title: 'Ngày', dataIndex: 'date', width: 100, render: t => dayjs(t).format('DD/MM/YYYY') },
                                                { title: 'Loại', dataIndex: 'type', width: 100, render: t => <Tag color={t === 'INCOME' ? 'green' : 'red'}>{t === 'INCOME' ? 'Thu' : 'Chi'}</Tag> },
                                                { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: (v, r: any) => <b style={{ color: r.type === 'INCOME' ? 'green' : 'red' }}>{Number(v).toLocaleString()}</b> },
                                                { title: 'Nội dung', dataIndex: 'description' },
                                                { title: 'Tham chiếu', dataIndex: 'reference_code', render: t => t ? <Tag>{t}</Tag> : '-' }
                                            ]}
                                        />
                                    )}

                                </div>
                            )
                        },
                        {
                            key: '4', label: <span style={{ color: '#eb2f96' }}><FileTextOutlined /> Template PO</span>,
                            disabled: !editingItem,
                            children: (
                                <div style={{ padding: '10px 0' }}>
                                    <div style={{ marginBottom: 16, background: '#fff0f6', padding: 16, borderRadius: 8, border: '1px solid #ffadd2' }}>
                                        <div style={{ fontWeight: 'bold', color: '#c41d7f', marginBottom: 8 }}>Mẫu In (Template) tùy chỉnh cho Đối tác này</div>
                                        <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                                            Sử dụng các biến số để tự động điền dữ liệu khi in PO: <br/>
                                            <Tag color="magenta">{'{{poCode}}'}</Tag>
                                            <Tag color="magenta">{'{{supplierName}}'}</Tag>
                                            <Tag color="magenta">{'{{date}}'}</Tag>
                                            <Tag color="magenta">{'{{totalAmount}}'}</Tag>
                                            <Tag color="magenta">{'{{itemsTable}}'}</Tag>
                                        </div>
                                        <Space>
                                            <Button size="small" onClick={() => form.setFieldsValue({ po_template: `<div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px;">ĐƠN ĐẶT HÀNG (NPL)</div>\n<div style="margin-bottom:10px;"><b>Kính gửi:</b> {{supplierName}}</div>\n<div style="margin-bottom:10px;"><b>Ngày:</b> {{date}}</div>\n<div style="margin-bottom:20px;"><b>Mã PO:</b> {{poCode}}</div>\n{{itemsTable}}\n<div style="margin-top: 20px; text-align: right; font-weight: bold; font-size: 16px;">Tổng cộng: {{totalAmount}}</div>`})}>
                                                Sử dụng Mẫu NPL Chuẩn
                                            </Button>
                                            <Button size="small" onClick={() => form.setFieldsValue({ po_template: `<div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px;">ĐƠN ĐẶT HÀNG GIA CÔNG</div>\n<div style="margin-bottom:10px;"><b>Nhà gia công:</b> {{supplierName}}</div>\n<div style="margin-bottom:10px;"><b>Ngày lập:</b> {{date}}</div>\n<div style="margin-bottom:20px;"><b>Mã Đơn:</b> {{poCode}}</div>\n{{itemsTable}}\n<div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center;">\n<div><b>Bên Giao</b><br/><br/><br/>(Ký, ghi rõ họ tên)</div>\n<div><b>Bên Nhận</b><br/><br/><br/>(Ký, ghi rõ họ tên)</div>\n</div>`})}>
                                                Sử dụng Mẫu Gia Công
                                            </Button>
                                            <Button size="small" danger onClick={() => form.setFieldsValue({ po_template: '' })}>Xóa trắng</Button>
                                        </Space>
                                    </div>
                                    <Form.Item name="po_template">
                                        <RichTextEditor />
                                    </Form.Item>
                                </div>
                            )
                        }
                    ]} />
                </Form>
            </Drawer>

            {/* MODAL CÔNG NỢ (DEBT) - For Bulk Payment Action */}
            <Modal title={`Quản Lý Công Nợ: ${currentSupplier?.name}`} open={isDebtModalOpen} onCancel={() => setIsDebtModalOpen(false)} width={900} footer={null}>
                <Row gutter={24}>
                    <Col span={16}>
                        <Table
                            dataSource={debtPOs}
                            rowKey="id"
                            size="small"
                            rowSelection={{
                                type: 'checkbox',
                                onChange: (_, rows) => {
                                    setSelectedDebtPOs(rows);
                                    
                                    // Auto fill remaining amount for newly selected rows
                                    const newAllocations = { ...allocations };
                                    rows.forEach(r => {
                                        if (!newAllocations[r.id]) {
                                            newAllocations[r.id] = Number(r.total_amount) - Number(r.paid_amount || 0);
                                        }
                                    });
                                    setAllocations(newAllocations);
                                    
                                    const total = rows.reduce((sum, r) => sum + (newAllocations[r.id] || 0), 0);
                                    setPaymentAmount(total);
                                }
                            }}
                            columns={[
                                { title: 'PO', dataIndex: 'po_code' },
                                { title: 'Ngày', dataIndex: 'created_at', render: t => dayjs(t).format('DD/MM/YYYY') },
                                { title: 'Tổng tiền', dataIndex: 'total_amount', align: 'right', render: v => Number(v).toLocaleString() },
                                { title: 'Đã trả', dataIndex: 'paid_amount', align: 'right', render: v => Number(v).toLocaleString() },
                                { title: 'Còn nợ', align: 'right', render: (t, r: any) => <b style={{ color: 'red' }}>{(Number(r.total_amount) - Number(r.paid_amount || 0)).toLocaleString()}</b> },
                                {
                                    title: 'Số tiền trả', align: 'right', width: 150,
                                    render: (t, r: any) => {
                                        const isSelected = selectedDebtPOs.some(p => p.id === r.id);
                                        return (
                                            <InputNumber
                                                disabled={!isSelected}
                                                style={{ width: '100%' }}
                                                min={0}
                                                max={Number(r.total_amount) - Number(r.paid_amount || 0)}
                                                value={allocations[r.id] || 0}
                                                onChange={(val) => {
                                                    const newAllocations = { ...allocations, [r.id]: Number(val) || 0 };
                                                    setAllocations(newAllocations);
                                                    
                                                    // Recalculate total payment
                                                    const total = selectedDebtPOs.reduce((sum, p) => sum + (newAllocations[p.id] || 0), 0);
                                                    setPaymentAmount(total);
                                                }}
                                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            />
                                        );
                                    }
                                }
                            ]}
                            pagination={false}
                            scroll={{ y: 300 }}
                        />
                    </Col>
                    <Col span={8} style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 16 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 16 }}>Thông tin Thanh Toán</div>
                        <Form layout="vertical">
                            <Form.Item label="Tổng thanh toán">
                                <InputNumber
                                    style={{ width: '100%', fontWeight: 'bold', color: 'blue' }}
                                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    addonAfter="₫"
                                    value={paymentAmount}
                                    disabled={true} // Tự tính tổng từ chi tiết
                                />
                            </Form.Item>
                            <Form.Item label="Ngày thanh toán">
                                <DatePicker style={{ width: '100%' }} value={paymentDate} onChange={setPaymentDate} format="DD/MM/YYYY" />
                            </Form.Item>
                            <Form.Item label="Số hóa đơn VAT">
                                <Input value={vatCode} onChange={e => setVatCode(e.target.value)} placeholder="VD: 00123..." />
                            </Form.Item>
                            <Form.Item label="Link hóa đơn">
                                <Input value={vatUrl} onChange={e => setVatUrl(e.target.value)} prefix={<LinkOutlined />} />
                            </Form.Item>
                            <Form.Item label="Ghi chú">
                                <Input.TextArea rows={2} value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
                            </Form.Item>
                            <Button type="primary" block icon={<DollarOutlined />} onClick={handleBulkPayment} disabled={selectedDebtPOs.length === 0}>
                                Thanh Toán ({selectedDebtPOs.length})
                            </Button>
                        </Form>
                    </Col>
                </Row>
            </Modal>
        </div>
    );
};

export default SuppliersPage;
