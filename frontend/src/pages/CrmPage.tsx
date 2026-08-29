import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Select, Space, Timeline, Drawer, Row, Col, Statistic, Divider, Popconfirm, Tooltip, Progress, Avatar, Tag, Badge, Tabs, InputNumber, Typography, DatePicker, List, Checkbox } from 'antd'; // <--- Đã thêm Tabs
import { UserOutlined, ClockCircleOutlined, CheckOutlined, CloseOutlined, SendOutlined, DollarOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, LinkOutlined, CopyOutlined, UnorderedListOutlined, BellOutlined, SearchOutlined, FilterOutlined, RiseOutlined, TagOutlined, CalendarOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import QuotationTemplate from '../components/QuotationTemplate';
import SalesOrderDetail from '../components/SalesOrderDetail';
import QuickTaskModal from '../components/QuickTaskModal';
import useMobile from '../hooks/useMobile';
import usePermission from '../hooks/usePermission';

dayjs.extend(isBetween);

const { Text } = Typography;

const CrmPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isMobile = useMobile();
    const { canCreate, canUpdate, canDelete } = usePermission('SALES');
    const { RangePicker } = DatePicker;

    // --- FILTER STATE ---
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
    const [selectedYear, setSelectedYear] = useState(dayjs().year());
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

    // Generate years
    const years = Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i);

    const handleMonthClick = (month: number) => {
        setSelectedMonth(month);
        const start = dayjs().year(selectedYear).month(month - 1).startOf('month');
        const end = dayjs().year(selectedYear).month(month - 1).endOf('month');
        setDateRange([start, end]);
    };

    const handleAllMonthClick = () => {
        setSelectedMonth(null);
        const start = dayjs().year(selectedYear).startOf('year');
        const end = dayjs().year(selectedYear).endOf('year');
        setDateRange([start, end]);
    };

    const handleYearChange = (val: number) => {
        setSelectedYear(val);
        if (selectedMonth !== null) {
            const start = dayjs().year(val).month(selectedMonth - 1).startOf('month');
            const end = dayjs().year(val).month(selectedMonth - 1).endOf('month');
            setDateRange([start, end]);
        } else {
            // If All selected, update year range
            const start = dayjs().year(val).startOf('year');
            const end = dayjs().year(val).endOf('year');
            setDateRange([start, end]);
        }
    };

    const [activeTab, setActiveTab] = useState('LEAD');
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState(''); // State tìm kiếm

    // Data
    const [allCustomers, setAllCustomers] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // UI State
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [followDrawerOpen, setFollowDrawerOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Task Modal
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskInitialValues, setTaskInitialValues] = useState<any>({});

    // Sales Order Detail
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<any>(null);
    const [isQuotationMode, setIsQuotationMode] = useState(false);

    // Lead Modal
    const [currentCustomer, setCurrentCustomer] = useState<any>(null);
    const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
    const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
    const [formLead] = Form.useForm();
    const [followNote, setFollowNote] = useState('');
    const [isReturningCustomer, setIsReturningCustomer] = useState(false);

    const customerOptionsForLead = useMemo(() => allCustomers.map((c: any) => ({
        label: `${c.code} - ${c.name} (${c.phone || 'N/A'})`,
        value: c.id,
        name: c.name,
        phone: c.phone
    })), [allCustomers]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resCust, resSales, resProd, resUsers] = await Promise.all([
                api.get('/customers').catch(e => ({ data: [] })),
                api.get('/sales').catch(e => ({ data: [] })),
                api.get('/products').catch(e => ({ data: [] })),
                api.get('/users').catch(e => ({ data: [] }))
            ]);

            // Customers
            const custData = Array.isArray(resCust.data) ? resCust.data : [];
            setAllCustomers(custData);
            setLeads(custData.filter((c: any) => c.type === 'LEAD').sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

            // Sales
            const salesData = Array.isArray(resSales.data) ? resSales.data : [];
            setQuotes(salesData.filter((s: any) => s.status === 'QUOTATION' || s.status === 'CANCELLED'));
            setOrders(salesData.filter((s: any) => !['QUOTATION', 'CANCELLED'].includes(s.status)));

            // Products
            if (Array.isArray(resProd.data)) {
                setProducts(resProd.data.map((p: any) => ({
                    label: p.name,
                    value: p.sku,
                    price: Number(p.base_price) || 0,
                    unit: p.unit,
                    description: p.customer_description,
                    vat_description: p.vat_description,
                    type: p.product_type,
                    image_url: p.image_url,
                    quantity_in_stock: p.quantity_in_stock,
                    booking_stock: p.booking_stock,
                    approved_booking_stock: p.approved_booking_stock
                })));
            }

            // Users
            setUsers(Array.isArray(resUsers.data) ? resUsers.data : []);

        } catch (error) {
            console.error("Error fetching data:", error);
            message.error("Có lỗi khi tải dữ liệu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const customerId = searchParams.get('customer');
        const orderId = searchParams.get('order');

        let shouldUpdateParams = false;

        if (customerId && allCustomers.length > 0) {
            const customer = allCustomers.find(c => c.id === parseInt(customerId, 10));
            if (customer) {
                setCurrentCustomer(customer);
                setFollowDrawerOpen(true);
            }
            searchParams.delete('customer');
            shouldUpdateParams = true;
        }

        if (orderId && quotes.length > 0) {
            const openOrderById = async () => {
                try {
                    const res = await api.get(`/sales/${orderId}`);
                    if (res.data) {
                        setEditingOrder(res.data);
                        setIsQuotationMode(res.data.status === 'QUOTATION');
                        setDetailModalOpen(true);
                    }
                } catch (e) {
                    const found = quotes.find(q => q.id === parseInt(orderId, 10));
                    if (found) {
                        setEditingOrder(found);
                        setIsQuotationMode(true);
                        setDetailModalOpen(true);
                    }
                }
            };
            openOrderById();
            searchParams.delete('order');
            searchParams.delete('highlight');
            searchParams.delete('tab');
            shouldUpdateParams = true;
        }

        if (shouldUpdateParams) {
            setSearchParams(searchParams);
        }
    }, [searchParams, allCustomers, quotes]);

    // --- FILTERING ---
    const filterByDate = (list: any[]) => {
        if (!dateRange[0] || !dateRange[1]) return list;
        return list.filter(item => {
            const date = dayjs(item.created_at);
            return date.isBetween(dateRange[0], dateRange[1], 'day', '[]');
        });
    };

    const dateFilteredLeads = useMemo(() => filterByDate(leads), [leads, dateRange]);
    const dateFilteredQuotes = useMemo(() => filterByDate(quotes), [quotes, dateRange]);
    const dateFilteredOrders = useMemo(() => filterByDate(orders), [orders, dateRange]);

    // --- LOGIC LỌC DỮ LIỆU (SEARCH) ---
    const getFilteredData = (data: any[]) => {
        let filtered = data;
        // Search
        if (searchText) {
            const lower = searchText.toLowerCase();
            filtered = filtered.filter(item =>
                item.code?.toLowerCase().includes(lower) ||
                item.name?.toLowerCase().includes(lower) ||
                item.phone?.toLowerCase().includes(lower) ||
                item.customer?.name?.toLowerCase().includes(lower) ||
                item.order_code?.toLowerCase().includes(lower)
            );
        }
        return filtered;
    };

    // --- ACTIONS ---
    const openCreateLead = () => {
        setEditingLeadId(null);
        const autoCode = `LEAD-${dayjs().format('YYMMDD')}-${Math.floor(Math.random() * 1000)}`;
        formLead.setFieldsValue({ code: autoCode });
        formLead.resetFields(['name', 'phone', 'customer_id']);
        setIsNewCustomerMode(false);
        setIsReturningCustomer(false);
        setIsLeadModalOpen(true);
    };

    // Detect returning customer when selecting from existing list
    const handleCustomerSelect = (customerId: number) => {
        const selected = allCustomers.find((c: any) => c.id === customerId);
        if (selected) {
            const hasOrders = selected.orders && selected.orders.length > 0;
            const isExistingCustomer = selected.type === 'CUSTOMER';
            const isExistingLead = selected.type === 'LEAD';

            if (hasOrders || isExistingCustomer) {
                setIsReturningCustomer(true);
                formLead.setFieldsValue({ lead_source: 'RETURNING_CUSTOMER' });
                if (isExistingLead) {
                    // Existing lead - will update instead of creating new
                    setEditingLeadId(selected.id);
                    formLead.setFieldsValue({
                        name: selected.name,
                        phone: selected.phone,
                        lead_status: selected.lead_status || 'NEW',
                        potential_value: selected.potential_value,
                        assigned_to_id: selected.assigned_to_id,
                    });
                    message.info('Khách hàng này đã có Lead. Hệ thống sẽ cập nhật Lead cũ.');
                }
            } else {
                setIsReturningCustomer(false);
            }
        }
    };

    const handleEditLead = (lead: any) => {
        setEditingLeadId(lead.id);
        setIsNewCustomerMode(false); // Default to existing customer mode technically, but for editing we reuse the form
        // Pre-fill
        formLead.setFieldsValue({
            ...lead,
            customer_id: lead.id, // For display logic mainly
            name: lead.name,
            phone: lead.phone,
            created_at: lead.created_at ? dayjs(lead.created_at) : dayjs()
        });
        setIsLeadModalOpen(true);
    };

    const handleDeleteLead = async (id: number) => {
        try {
            await api.delete(`/customers/${id}`);
            message.success('Đã xóa Lead'); fetchData();
        } catch (e: any) { message.error('Không thể xóa'); }
    };

    const handleCreateTask = (record: any, type: 'CRM' | 'SALES') => {
        setTaskInitialValues({
            title: type === 'CRM' ? `CSKH: ${record.name}` : `Follow đơn: ${record.order_code}`,
            reference_code: type === 'CRM' ? record.code : record.order_code,
            reference_type: type,
            description: type === 'CRM' ? `SĐT: ${record.phone}` : `Khách: ${record.customer?.name}`
        });
        setTaskModalOpen(true);
    };

    const handleSaveLead = async (values: any) => {
        try {
            const { code, customer_id, name, phone, lead_status, potential_value, assigned_to_id, lead_source, created_at } = values;
            const payload = {
                name, phone, lead_status, lead_source,
                potential_value: Number(potential_value) || 0,
                assigned_to_id,
                created_at: created_at ? created_at.toISOString() : undefined
            };

            if (editingLeadId) {
                await api.put(`/customers/${editingLeadId}`, payload);
                if (isReturningCustomer) {
                    await api.post(`/customers/${editingLeadId}/follow`, { note: '🔄 Khách hàng cũ quay lại đặt hàng' });
                }
                message.success('Cập nhật thành công!');
            } else {
                if (isNewCustomerMode) {
                    if (!name || !phone) { message.error('Nhập Tên và SĐT'); return; }
                    await api.post('/customers', { code, type: 'LEAD', ...payload });
                } else {
                    if (!customer_id) { message.error('Chọn khách hàng'); return; }
                    await api.put(`/customers/${customer_id}`, { type: 'LEAD', ...payload });
                    const followNote = isReturningCustomer
                        ? '🔄 Khách hàng cũ quay lại đặt hàng - Tạo Lead mới'
                        : 'Lead created';
                    await api.post(`/customers/${customer_id}/follow`, { note: followNote });
                }
                message.success('Tạo Lead thành công!');
            }
            setIsLeadModalOpen(false); setIsReturningCustomer(false); fetchData();
        } catch (e: any) { message.error('Lỗi lưu Lead'); }
    };

    const handleFollowLead = async () => {
        if (!followNote) return;
        try {
            await api.post(`/customers/${currentCustomer.id}/follow`, { note: followNote });
            message.success('Đã lưu ghi chú'); setFollowNote('');
            const res = await api.get(`/customers/${currentCustomer.id}`);
            setCurrentCustomer(res.data); fetchData();
        } catch (e) { message.error('Lỗi'); }
    };

    // --- Quick Status Change ---
    const handleChangeStatus = async (id: number, status: string) => {
        try {
            await api.put(`/customers/${id}`, { lead_status: status });
            message.success('Đã cập nhật trạng thái');
            fetchData();
        } catch (e) { message.error('Lỗi'); }
    };

    const statusColors: any = {
        NEW: 'blue', CONTACTED: 'cyan', QUALIFIED: 'purple', NEGOTIATION: 'orange', WON: 'green', LOST: 'red'
    };
    const statusLabels: any = {
        NEW: 'Mới', CONTACTED: 'Đã liên hệ', QUALIFIED: 'Tiềm năng', NEGOTIATION: 'Đàm phán', WON: 'Thành công', LOST: 'Thất bại'
    };

    const handleConvertQuote = async (id: number, accepted: boolean) => {
        try {
            await api.post(`/sales/${id}/convert`, { accepted });
            message.success(accepted ? 'Đã chốt báo giá!' : 'Đã hủy'); fetchData();
        } catch (e: any) { Modal.error({ title: 'Lỗi', content: e.response?.data?.message }); }
    };

    const handleDeleteQuote = (id: number) => {
        let cascade = false;
        Modal.confirm({
            title: 'Xác nhận Xóa Báo Giá',
            content: (
                <div>
                    <p style={{ marginBottom: 10 }}>Bạn có chắc chắn muốn xóa báo giá này không?</p>
                    <Checkbox onChange={(e) => { cascade = e.target.checked; }}>
                        Xóa luôn các dữ liệu liên quan (Dự án, Task, Lịch sử...) nếu có
                    </Checkbox>
                </div>
            ),
            okText: 'Xóa',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try { 
                    await api.delete(`/sales/quote/${id}?cascade=${cascade}`); 
                    message.success('Đã xóa'); 
                    fetchData(); 
                } catch (e: any) { 
                    Modal.error({ title: 'Lỗi', content: e.response?.data?.message || 'Không thể xóa báo giá' }); 
                }
            }
        });
    };

    const openDetailModal = async (record?: any, isQuote = false) => {
        if (record) {
            try {
                const res = await api.get(`/sales/${record.order_code}`);
                setEditingOrder(res.data);
            } catch (e) { }
        } else { setEditingOrder(null); }
        setIsQuotationMode(record ? (record.status === 'QUOTATION') : isQuote);
        setDetailModalOpen(true);
    };

    const handleCopyLink = (uuid: string) => {
        if (!uuid) return message.warning('Chưa có Link');
        const link = `${window.location.protocol}//${window.location.host}/portal/quote/${uuid}`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => message.success('Copied!')).catch(() => { });
        } else {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = link;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                message.success('Copied!');
            } catch (err) {
                message.error('Oops, unable to copy');
            }
            document.body.removeChild(textArea);
        }
    };

    const handleCloneQuote = async (record: any) => {
        try {
            const res = await api.get(`/sales/${record.order_code}`);
            const clonedData = { ...res.data, isClone: true };
            setEditingOrder(clonedData);
            setIsQuotationMode(true);
            setDetailModalOpen(true);
        } catch (e) {
            message.error('Không thể tải dữ liệu để nhân bản');
        }
    };

    // --- COLUMNS DEFINITION ---
    const leadColumns = [
        {
            title: 'Ngày tạo', dataIndex: 'created_at', width: 110,
            render: (t: any) => <span style={{ color: '#888' }}>{dayjs(t).format('DD/MM/YYYY')}</span>
        },
        {
            title: 'Trạng Thái', dataIndex: 'lead_status', width: 150,
            render: (st: string, r: any) => (
                <Select
                    value={st || 'NEW'}
                    size="small"
                    style={{ width: 120 }}
                    onChange={(v) => handleChangeStatus(r.id, v)}
                    dropdownMatchSelectWidth={false}
                >
                    {Object.keys(statusLabels).map(k => (
                        <Select.Option key={k} value={k}>
                            <Tag color={statusColors[k]}>{statusLabels[k]}</Tag>
                        </Select.Option>
                    ))}
                </Select>
            )
        },
        {
            title: 'Giá Trị (Dự kiến)', dataIndex: 'potential_value', width: 140, align: 'right' as const,
            render: (v: any) => v ? <span style={{ color: '#fa8c16', fontWeight: 600 }}>{Number(v).toLocaleString()}</span> : '-'
        },
        {
            title: 'Phụ trách', dataIndex: 'assigned_to', width: 120,
            render: (u: any) => u ? <Tag color="blue">{u.full_name || u.username}</Tag> : '-'
        },
        {
            title: 'Khách Hàng', dataIndex: 'name', width: 280,
            render: (t: any, r: any) => (
                <Space>
                    <Avatar style={{ backgroundColor: '#1890ff', verticalAlign: 'middle' }} size="small">
                        {t ? t.charAt(0).toUpperCase() : 'U'}
                    </Avatar>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <a onClick={() => { setCurrentCustomer(r); setFollowDrawerOpen(true) }} style={{ fontWeight: 500 }}>{t}</a>
                        <small style={{ color: '#888' }}>
                            {r.code} -
                            <Tooltip title={r.phone}>
                                <span style={{ cursor: 'pointer' }}>
                                    {r.phone && r.phone.length > 3
                                        ? '*******' + r.phone.slice(-3)
                                        : r.phone}
                                </span>
                            </Tooltip>
                        </small>
                    </div>
                </Space>
            )
        },
        {
            title: 'Tiến Độ', key: 'progress', width: 180,
            render: (_: any, r: any) => {
                const leadId = r.id;
                const myOrders = orders.filter((o: any) => o.customer?.id === leadId);
                const myQuotes = quotes.filter((q: any) => q.customer?.id === leadId);

                let pct = 10, status = 'normal', text = 'Mới tiếp cận';
                if (myQuotes.length > 0) { pct = 50; status = 'active'; text = 'Đang báo giá'; }
                if (myOrders.some((o: any) => o.status === 'SO_PENDING')) { pct = 70; status = 'active'; text = 'Chốt đơn/HĐ'; }
                if (myOrders.some((o: any) => o.status === 'DEPOSITED')) { pct = 90; status = 'success'; text = 'Đang sản xuất'; }

                return <Tooltip title={text}><Progress percent={pct} size="small" status={status as any} showInfo={false} strokeColor={pct === 90 ? '#52c41a' : '#1890ff'} /></Tooltip>
            }
        },
        {
            title: 'Ghi chú gần nhất', dataIndex: 'history', ellipsis: true, width: 200,
            render: (h: any[]) => h && h.length > 0 ? (
                <Tooltip title={h[0].note}>
                    <span><ClockCircleOutlined style={{ fontSize: 10, marginRight: 5 }} /> {h[0].note}</span>
                </Tooltip>
            ) : <span style={{ color: '#ccc' }}>-</span>
        },
        {
            title: '', key: 'act', align: 'right' as const, width: 140,
            render: (_: any, r: any) => (
                <Space size="small">
                    <Tooltip title="Chăm sóc"><Button size="small" icon={<ClockCircleOutlined />} onClick={() => { setCurrentCustomer(r); setFollowDrawerOpen(true) }} /></Tooltip>
                    <Tooltip title="Tạo Nhắc nhở"><Button size="small" icon={<BellOutlined />} onClick={() => handleCreateTask(r, 'CRM')} /></Tooltip>
                    {canUpdate && <Tooltip title="Sửa"><Button size="small" icon={<EditOutlined />} onClick={() => handleEditLead(r)} /></Tooltip>}
                    {canDelete && <Popconfirm title="Xóa?" onConfirm={() => handleDeleteLead(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
                </Space>
            )
        }
    ];

    const quoteColumns = [
        { title: 'Mã BG', dataIndex: 'order_code', render: (t: any) => <Tag color="orange">#{t}</Tag> },
        { title: 'Khách Hàng', dataIndex: 'customer', render: (c: any) => <b>{c?.name}</b> },
        { title: 'Giá Trị', dataIndex: 'total_amount', align: 'right' as const, render: (v: any) => <b style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</b> },
        { title: 'Phụ trách', dataIndex: 'assigned_to', render: (u: any) => u ? <Tag color="blue">{u.full_name || u.username}</Tag> : '-' },
        { title: 'Ngày tạo', dataIndex: 'order_date', render: (t: any) => <small>{t ? dayjs(t).format('DD/MM/YYYY') : '-'}</small> },
        {
            title: 'Thao tác', key: 'act', align: 'center' as const, width: 220,
            render: (_: any, r: any) => r.status === 'QUOTATION' ? (
                <Space size="small">
                    <Tooltip title="Nhân bản">{canUpdate && <Button icon={<CopyOutlined />} size="small" onClick={() => handleCloneQuote(r)} />}</Tooltip>
                    <Tooltip title="Link"><Button icon={<LinkOutlined />} size="small" onClick={() => handleCopyLink(r.uuid)} /></Tooltip>
                    <Tooltip title="Xem"><Button icon={<PrinterOutlined />} size="small" onClick={() => { openDetailModal(r); setTimeout(() => setIsPreviewOpen(true), 500) }} /></Tooltip>
                    <Tooltip title="Sửa">{canUpdate && <Button icon={<EditOutlined />} size="small" onClick={() => openDetailModal(r, true)} />}</Tooltip>
                    <Tooltip title="Task"><Button size="small" icon={<BellOutlined />} onClick={() => handleCreateTask(r, 'SALES')} /></Tooltip>
                    {canUpdate && <Popconfirm title="Xác nhận chốt đơn?" onConfirm={() => handleConvertQuote(r.id, true)}><Button type="primary" size="small" icon={<CheckOutlined />} /></Popconfirm>}
                    {canDelete && <Tooltip title="Xóa"><Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDeleteQuote(r.id)} /></Tooltip>}
                </Space>
            ) : <Tag color="default">Đã chốt</Tag>
        }
    ];

    return (
        <div>
            {/* FILTER BAR - MOBILE FRIENDLY */}
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}><CalendarOutlined /> Thống kê:</span>
                    <Select
                        value={selectedYear}
                        onChange={handleYearChange}
                        style={{ width: isMobile ? 100 : 120 }}
                        options={years.map(y => ({ label: `${y}`, value: y }))}
                    />
                    {/* Month Blocks - HIDE ON MOBILE */}
                    {!isMobile && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                const isActive = selectedMonth === m;
                                return (
                                    <div
                                        key={m}
                                        onClick={() => handleMonthClick(m)}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            border: isActive ? '1px solid #1890ff' : '1px solid #d9d9d9',
                                            background: isActive ? '#e6f7ff' : '#fff',
                                            color: isActive ? '#1890ff' : '#666',
                                            fontSize: 13,
                                            transition: 'all 0.2s',
                                            fontWeight: isActive ? 500 : 400
                                        }}
                                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = '#40a9ff'; }}
                                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = '#d9d9d9'; }}
                                    >
                                        T{m}
                                    </div>
                                )
                            })}
                            {/* ALL BLOCK */}
                            <div
                                onClick={handleAllMonthClick}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    border: selectedMonth === null ? '1px solid #722ed1' : '1px solid #d9d9d9',
                                    background: selectedMonth === null ? '#f9f0ff' : '#fff',
                                    color: selectedMonth === null ? '#722ed1' : '#666',
                                    fontSize: 13,
                                    transition: 'all 0.2s',
                                    fontWeight: selectedMonth === null ? 500 : 400
                                }}
                                onMouseEnter={(e) => { if (selectedMonth !== null) e.currentTarget.style.borderColor = '#b37feb'; }}
                                onMouseLeave={(e) => { if (selectedMonth !== null) e.currentTarget.style.borderColor = '#d9d9d9'; }}
                            >
                                All
                            </div>
                        </div>
                    )}
                </div>
                <RangePicker
                    style={{ width: isMobile ? '100%' : 260 }}
                    placeholder={['Từ ngày', 'Đến ngày']}
                    value={dateRange as any}
                    onChange={(dates) => {
                        setDateRange(dates as any);
                        if (dates) setSelectedMonth(null);
                    }}
                />
            </div>

            {/* KPI DASHBOARD - HORIZONTAL SCROLL ON MOBILE */}
            <div style={{ overflowX: isMobile ? 'auto' : 'visible', marginBottom: 16 }}>
                <Row gutter={[isMobile ? 8 : 16, 8]} wrap={!isMobile} style={{ flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: isMobile ? 500 : 'auto' }}>
                    <Col flex={isMobile ? '160px' : 1}><Card bordered={false} bodyStyle={{ padding: isMobile ? 8 : 12 }} style={{ background: 'linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%)' }}><Statistic title="Leads" value={dateFilteredLeads.length} prefix={<UserOutlined style={{ color: '#1890ff' }} />} valueStyle={{ fontSize: isMobile ? 16 : 24 }} /></Card></Col>
                    <Col flex={isMobile ? '160px' : 1}><Card bordered={false} bodyStyle={{ padding: isMobile ? 8 : 12 }} style={{ background: 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)' }}><Statistic title="Báo Giá" value={dateFilteredQuotes.length} prefix={<FileTextOutlined style={{ color: '#fa8c16' }} />} valueStyle={{ fontSize: isMobile ? 16 : 24 }} /></Card></Col>
                    <Col flex={isMobile ? '160px' : 1}><Card bordered={false} bodyStyle={{ padding: isMobile ? 8 : 12 }} style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #ffffff 100%)' }}><Statistic title="Chuyển đổi" value={dateFilteredLeads.length > 0 ? ((dateFilteredOrders.length / dateFilteredLeads.length) * 100).toFixed(1) : 0} suffix="%" prefix={<RiseOutlined style={{ color: '#52c41a' }} />} valueStyle={{ fontSize: isMobile ? 16 : 24 }} /></Card></Col>
                </Row>
            </div>

            <Card
                bodyStyle={{ padding: isMobile ? '8px 12px' : '12px 24px' }}
                title={
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 10 }}>
                        <span style={{ fontSize: isMobile ? 16 : 18 }}>CRM</span>
                        <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm..." style={{ width: isMobile ? '100%' : 250, fontSize: 13 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
                    </div>
                }
                extra={
                    isMobile ? (
                        <Button icon={<ReloadOutlined />} onClick={fetchData} />
                    ) : (
                        <Space>
                            <Button icon={<UnorderedListOutlined />} onClick={() => navigate('/sales/pricelist')}>Bảng Giá</Button>
                            <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
                        </Space>
                    )
                }
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    type="card"
                    items={[
                        {
                            key: 'LEAD', label: <span><UserOutlined /> Leads ({leads.length})</span>,
                            children: (
                                <>
                                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                        {canCreate && <Button type="primary" onClick={openCreateLead} icon={<PlusOutlined />}>{isMobile ? 'Tạo' : 'Tạo Lead Mới'}</Button>}
                                    </div>
                                    {isMobile ? (
                                        <List
                                            dataSource={getFilteredData(dateFilteredLeads)}
                                            pagination={{ pageSize: 8 }}
                                            renderItem={(r: any) => (
                                                <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                                                    <div style={{ width: '100%' }} onClick={() => handleEditLead(r)}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{r.customer?.name || '-'}</div>
                                                                <div style={{ fontSize: 12, color: '#666' }}>{r.customer?.phone || '-'}</div>
                                                            </div>
                                                            <Tag color={r.status === 'WON' ? 'green' : r.status === 'LOST' ? 'red' : 'blue'}>{r.status}</Tag>
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#999' }}>
                                                            {r.assigned_to?.full_name || 'Chưa gán'} • {r.created_at ? dayjs(r.created_at).format('DD/MM/YYYY') : '-'}
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            )}
                                        />
                                    ) : (
                                        <Table
                                            dataSource={getFilteredData(dateFilteredLeads)}
                                            columns={leadColumns}
                                            rowKey="id"
                                            scroll={{ x: 1300 }}
                                            pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} leads` }}
                                        />
                                    )}
                                </>
                            )
                        },
                        {
                            key: 'QUOTE', label: <span><FileTextOutlined /> Báo Giá ({quotes.length})</span>,
                            children: (
                                <>
                                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                        {canCreate && <Button type="primary" onClick={() => openDetailModal(null, true)} icon={<PlusOutlined />}>{isMobile ? 'Tạo' : 'Tạo Báo Giá'}</Button>}
                                    </div>
                                    {isMobile ? (
                                        <List
                                            dataSource={getFilteredData(dateFilteredQuotes)}
                                            pagination={{ pageSize: 8 }}
                                            renderItem={(r: any) => {
                                                const total = Number(r.total_amount) || 0;
                                                return (
                                                    <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                                                        <div style={{ width: '100%' }} onClick={() => openDetailModal(r, true)}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                                <div>
                                                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1890ff' }}>{r.order_code || '-'}</div>
                                                                    <div style={{ fontSize: 13, color: '#333' }}>{r.customer?.name || '-'}</div>
                                                                </div>
                                                                <Tag color="orange">Báo Giá</Tag>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                                                                <span>{total.toLocaleString()}đ</span>
                                                                <span>{r.order_date ? dayjs(r.order_date).format('DD/MM/YYYY') : '-'}</span>
                                                            </div>
                                                        </div>
                                                    </List.Item>
                                                );
                                            }}
                                        />
                                    ) : (
                                        <Table dataSource={getFilteredData(dateFilteredQuotes)} columns={quoteColumns} rowKey="id" pagination={{ pageSize: 8 }} />
                                    )}
                                </>
                            )
                        }
                    ]} />
            </Card>

            <SalesOrderDetail 
                open={detailModalOpen} 
                onClose={() => setDetailModalOpen(false)} 
                onSuccess={() => {
                    fetchData();
                    if (editingOrder && editingOrder.order_code) {
                        api.get(`/sales/${editingOrder.order_code}`).then(res => setEditingOrder(res.data)).catch(() => {});
                    }
                }} 
                initialData={editingOrder} 
                isQuotation={isQuotationMode} 
                customers={allCustomers} 
                products={products} 
                users={users} 
            />
            <Modal title="Xem Trước" open={isPreviewOpen} onCancel={() => setIsPreviewOpen(false)} footer={null} width={900}>
                <div id="printableArea"><QuotationTemplate data={editingOrder} /></div>
                <div style={{ textAlign: 'center', marginTop: 20 }}><Button type="primary" onClick={() => { const c = document.getElementById('printableArea'); const w = window.open(); if (w && c) { w.document.write(c.innerHTML); w.print(); } }}>In Ngay</Button></div>
            </Modal>
            <QuickTaskModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} initialValues={taskInitialValues} />

            <Modal title={editingLeadId ? "Cập nhật Lead" : "Tạo Lead"} open={isLeadModalOpen} onCancel={() => { setIsLeadModalOpen(false); formLead.resetFields(); }} onOk={() => formLead.submit()}>
                <Form form={formLead} layout="vertical" onFinish={handleSaveLead}>
                    <Form.Item name="code" label="Mã Lead"><Input disabled /></Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="created_at" label="Ngày tạo Lead" initialValue={dayjs()} rules={[{ required: true, message: 'Vui lòng chọn ngày tạo' }]}>
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="lead_status" label="Trạng thái" initialValue="NEW">
                                <Select>
                                    {Object.keys(statusLabels).map(k => <Select.Option key={k} value={k}>{statusLabels[k]}</Select.Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    {!isNewCustomerMode ? (
                        <>
                        <Form.Item label="Khách hàng có sẵn" name="customer_id" rules={[{ required: !isNewCustomerMode }]}>
                            <Select showSearch placeholder="Tìm theo tên/sđt" optionFilterProp="label" options={customerOptionsForLead} allowClear onChange={(v) => v && handleCustomerSelect(v)} />
                        </Form.Item>
                        {isReturningCustomer && (
                            <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                                <span style={{ color: '#d48806', fontWeight: 500 }}>🔄 Khách hàng cũ quay lại</span>
                                <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>Nguồn Lead sẽ tự động chọn "Khách hàng cũ"</span>
                            </div>
                        )}
                        </>
                    ) : (
                        <>
                            <Divider orientation="left">KH Mới</Divider>
                            <Form.Item name="name" label="Tên KH" rules={[{ required: isNewCustomerMode }]}><Input /></Form.Item>
                            <Form.Item name="phone" label="SĐT" rules={[{ required: isNewCustomerMode }]}><Input /></Form.Item>
                        </>
                    )}

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item name="potential_value" label="Giá trị đơn hàng (dự kiến)">
                                <InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(value: any) => value.replace(/\$\s?|(,*)/g, '')} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row>
                        <Col span={24}>
                            <Form.Item name="assigned_to_id" label="Nhân viên phụ trách">
                                <Select allowClear showSearch optionFilterProp="label" options={users.map(u => ({ label: u.full_name || u.username, value: u.id }))} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={24}>
                            <Form.Item name="lead_source" label="Nguồn Lead">
                                <Select allowClear placeholder="Chọn nguồn Lead">
                                    <Select.Option value="OUTBOUND">Đi thị trường (Outbound)</Select.Option>
                                    <Select.Option value="REFERRAL">Khách cũ giới thiệu (Referral)</Select.Option>
                                    <Select.Option value="RETURNING_CUSTOMER">Khách hàng cũ</Select.Option>
                                    <Select.Option value="FACEBOOK">Facebook / Ads</Select.Option>
                                    <Select.Option value="WEBSITE">Website</Select.Option>
                                    <Select.Option value="OTHER">Khác</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Button type="link" onClick={() => { setIsNewCustomerMode(!isNewCustomerMode); formLead.resetFields(['name', 'phone', 'customer_id']); }}>
                        {isNewCustomerMode ? "Chọn KH có sẵn" : "+ Thêm KH Mới"}
                    </Button>
                </Form>
            </Modal>

            <Drawer title={`Chăm sóc: ${currentCustomer?.name}`} width={450} open={followDrawerOpen} onClose={() => setFollowDrawerOpen(false)} footer={<Button type="primary" block onClick={() => { setFollowDrawerOpen(false); setEditingOrder({ customer_id: currentCustomer.id }); setIsQuotationMode(true); setDetailModalOpen(true); }}>Tạo Báo Giá Ngay</Button>}>
                {/* Customer Info Section */}
                <div style={{ background: '#f6f8fa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{currentCustomer?.name}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{currentCustomer?.code}</div>
                        </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#555' }}>
                        {currentCustomer?.phone && <div>📞 {currentCustomer.phone}</div>}
                        {currentCustomer?.email && <div>📧 {currentCustomer.email}</div>}
                        {currentCustomer?.address && <div>📍 {currentCustomer.address}</div>}
                    </div>
                </div>

                {/* Add Note Section */}
                <div style={{ marginBottom: 20 }}>
                    <Input.TextArea rows={3} value={followNote} onChange={e => setFollowNote(e.target.value)} placeholder="Nhập nội dung trao đổi..." />
                    <Button block type="primary" style={{ marginTop: 10 }} onClick={handleFollowLead}>Lưu Ghi Chú</Button>
                </div>
                <Divider>Lịch sử tương tác</Divider>
                <Timeline mode="left">
                    {currentCustomer?.history?.map((h: any, i: number) => {
                        // Check if this is a website-created lead
                        const isWebsiteLead = h.action === 'CREATED_FROM_WEBSITE';
                        const timestamp = h.timestamp || h.date;

                        return (
                            <Timeline.Item
                                key={i}
                                color={isWebsiteLead ? 'green' : 'blue'}
                                label={<span style={{ fontSize: 11, color: '#999' }}>{dayjs(timestamp).format('DD/MM HH:mm')}</span>}
                            >
                                {isWebsiteLead ? (
                                    <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: 10 }}>
                                        <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 6 }}>🌐 Đăng ký từ Website</div>
                                        {h.data?.contact_person && <div style={{ fontSize: 13 }}>👤 Người liên hệ: <b>{h.data.contact_person}</b></div>}
                                        {h.data?.expected_quantity && <div style={{ fontSize: 13 }}>📦 Số lượng dự kiến: <b>{h.data.expected_quantity}</b></div>}
                                        {h.data?.notes && <div style={{ fontSize: 13, marginTop: 4 }}>📝 Ghi chú: {h.data.notes}</div>}
                                    </div>
                                ) : (
                                    <span>{h.note}</span>
                                )}
                            </Timeline.Item>
                        );
                    })}
                </Timeline>
            </Drawer>
        </div>
    );
};

export default CrmPage;