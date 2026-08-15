import React, { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Button, message, Card, Input, Space, Row, Col, Tabs, Progress, Tooltip, Statistic, DatePicker, Select, List, Dropdown, MenuProps, FloatButton } from 'antd';
// --- FIX: Thêm PlusOutlined đã bị thiếu trước đó ---
import { PlusOutlined, ReloadOutlined, DollarOutlined, SearchOutlined, BellOutlined, EditOutlined, LinkOutlined, ShoppingCartOutlined, FileTextOutlined, CalendarOutlined, WalletOutlined, AuditOutlined, AppstoreAddOutlined, ShopOutlined, RightOutlined, MoreOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import QuickTaskModal from '../components/QuickTaskModal';
import SalesOrderDetail from '../components/SalesOrderDetail';
import { SalesKpiDashboard } from '../components/sales/SalesKpiDashboard';
import useMobile from '../hooks/useMobile';
import usePermission from '../hooks/usePermission';

dayjs.extend(isBetween);

const { RangePicker } = DatePicker;

const SalesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isMobile = useMobile();
    const { canCreate, canUpdate } = usePermission('SALES');
    const [activeTab, setActiveTab] = useState('ALL');
    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // State Modals
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskInitialValues, setTaskInitialValues] = useState<any>({});
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<any>(null);

    // Deep link params from URL (for notifications)
    const [deepLinkTab, setDeepLinkTab] = useState<string | null>(null);
    const [deepLinkHighlight, setDeepLinkHighlight] = useState<string | null>(null);

    // --- STATS FILTER STATE ---
    const [selectedYear, setSelectedYear] = useState(dayjs().year());
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

    // Handle URL params from notifications (deep linking)
    useEffect(() => {
        const orderId = searchParams.get('order');
        const tab = searchParams.get('tab');
        const highlight = searchParams.get('highlight');

        if (orderId) {
            // Store deep link params
            if (tab) setDeepLinkTab(tab);
            if (highlight) setDeepLinkHighlight(highlight);

            // Open order by ID
            const openOrderById = async () => {
                try {
                    const res = await api.get(`/sales/${orderId}`);
                    if (res.data) {
                        setEditingOrder(res.data);
                        setDetailModalOpen(true);
                    }
                } catch (e) {
                    // Fallback: try to find in loaded data
                    const found = data.find(d => d.id === parseInt(orderId));
                    if (found) {
                        setEditingOrder(found);
                        setDetailModalOpen(true);
                    }
                }
            };
            openOrderById();

            // Clear URL params after handling
            setSearchParams({});
        }
    }, [searchParams, data]);

    // Generate years (e.g., current year - 2 to current year + 2)
    const years = Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i);

    const handleMonthClick = (month: number) => {
        setSelectedMonth(month);
        const start = dayjs().year(selectedYear).month(month - 1).startOf('month');
        const end = dayjs().year(selectedYear).month(month - 1).endOf('month');
        setDateRange([start, end]);
    };

    const handleYearChange = (val: number) => {
        setSelectedYear(val);
        // If a month is already selected, update range for new year
        if (selectedMonth !== null) {
            const start = dayjs().year(val).month(selectedMonth - 1).startOf('month');
            const end = dayjs().year(val).month(selectedMonth - 1).endOf('month');
            setDateRange([start, end]);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resSales, resProd, resCust, resUsers] = await Promise.all([
                api.get('/sales').catch(e => ({ data: [] })),
                api.get('/products').catch(e => ({ data: [] })),
                api.get('/customers').catch(e => ({ data: [] })),
                api.get('/users').catch(e => ({ data: [] }))
            ]);

            setData(Array.isArray(resSales.data) ? resSales.data : []);

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
            setCustomers(Array.isArray(resCust.data) ? resCust.data : []);
            setUsers(Array.isArray(resUsers.data) ? resUsers.data : []);
        } catch (e) {
            console.error("Error fetching data:", e);
            message.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- ACTIONS ---
    const handleCreateTask = (record: any) => {
        setTaskInitialValues({
            title: `Theo dõi đơn: ${record.order_code}`,
            reference_code: record.order_code,
            reference_type: 'SALES',
            description: `Khách: ${record.customer?.name || record.customer_name}`
        });
        setTaskModalOpen(true);
    };

    const openDetailModal = async (record?: any) => {
        if (record && record.order_code) {
            try {
                const res = await api.get(`/sales/${record.order_code}`);
                setEditingOrder(res.data);
            } catch (e) { message.error('Không tải được chi tiết đơn'); return; }
        } else {
            // New Order (Standard or Internal)
            setEditingOrder(record);
        }
        setDetailModalOpen(true);
    };

    const handleCopyLink = (uuid: string) => {
        if (!uuid) return message.warning('Chưa có Link');
        const link = `${window.location.protocol}//${window.location.host}/portal/quote/${uuid}`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => message.success('Đã copy Link Portal!')).catch(() => message.error('Không thể copy'));
        } else {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = link;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                message.success('Đã copy Link Portal!');
            } catch (err) {
                message.error('Không thể copy link');
            }
            document.body.removeChild(textArea);
        }
    };

    // --- FILTERING LOGIC ---
    const filteredData = useMemo(() => {
        return data.filter((x: any) => {
            // Handle special WEB_ORDER tab (filter by order_source)
            let matchTab = true;
            if (activeTab === 'ALL') {
                matchTab = true;
            } else if (activeTab === 'WEB_ORDER') {
                matchTab = x.order_source === 'WEBSITE';
            } else if (activeTab === 'DELIVERED') {
                matchTab = (x.status === 'DELIVERED' || x.status === 'PARTIAL_DELIVERY');
            } else if (activeTab === 'IN_PRODUCTION') {
                matchTab = (x.status === 'IN_PRODUCTION' || x.status === 'PLANNED');
            } else {
                matchTab = x.status === activeTab;
            }

            const matchSearch = x.order_code?.toLowerCase().includes(searchText.toLowerCase())
                || x.customer_name?.toLowerCase().includes(searchText.toLowerCase())
                || x.customer?.name?.toLowerCase().includes(searchText.toLowerCase());

            let matchDate = true;
            if (dateRange[0] && dateRange[1]) {
                const orderDate = dayjs(x.order_date);
                matchDate = orderDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
            }

            return matchTab && matchSearch && matchDate;
        });
    }, [data, activeTab, searchText, dateRange]);

    // --- METRICS ---
    const metrics = useMemo(() => {
        // FIX: Include QUOTATION in metrics so the user sees the value of what is listed
        const validOrders = filteredData.filter(x => x.status !== 'CANCELLED');
        const totalRevenue = validOrders.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

        // FIX: Lấy paid_amount từ API (đã được fix ở Backend để tính tổng Transaction)
        const totalPaid = validOrders.reduce((acc, curr) => acc + Number(curr.paid_amount || 0), 0);

        const totalRemaining = totalRevenue - totalPaid;
        const processingCount = validOrders.filter(x => ['SO_PENDING', 'SAMPLE_APPROVED', 'DEPOSITED', 'QUOTATION'].includes(x.status)).length; // Include QUOTATION in processing? Or just count?

        return { totalRevenue, totalPaid, totalRemaining, count: validOrders.length, processingCount };
    }, [filteredData]);

    // --- COLUMNS ---
    const columns = [
        {
            title: 'Mã Đơn', dataIndex: 'order_code', width: 140,
            render: (t: any, r: any) => <a onClick={() => openDetailModal(r)}><b>{t}</b></a>
        },
        {
            title: 'Khách Hàng',
            render: (r: any) => <span style={{ fontWeight: 500 }}>{r.customer?.name || r.customer_name || 'Khách lẻ'}</span>
        },
        {
            title: 'Ngày Đặt', dataIndex: 'order_date', width: 110,
            render: (t: any) => <span style={{ color: '#666' }}>{dayjs(t).format('DD/MM/YYYY')}</span>
        },
        {
            title: 'Ngày Giao', dataIndex: 'delivery_date', width: 110,
            render: (t: any) => t ? <span style={{ color: '#1890ff' }}>{dayjs(t).format('DD/MM/YYYY')}</span> : '-'
        },
        {
            title: 'Doanh Thu', dataIndex: 'total_amount', align: 'right' as const, width: 130,
            render: (v: any) => <b style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</b>
        },
        {
            title: 'Đã Thu', dataIndex: 'paid_amount', align: 'right' as const, width: 130,
            render: (v: any) => <span style={{ color: '#389e0d' }}>{Number(v).toLocaleString()}</span>
        },
        {
            title: 'Còn Lại', key: 'remaining', align: 'right' as const, width: 130,
            render: (r: any) => {
                const total = Number(r.total_amount) || 0;
                const paid = Number(r.paid_amount) || 0;
                const remain = total - paid;
                return <span style={{ color: remain > 0 ? '#fa541c' : '#999' }}>{remain.toLocaleString()}</span>
            }
        },
        {
            title: 'Nhân sự', dataIndex: 'assigned_to', width: 120,
            render: (u: any) => u ? <Tag color="blue">{u.full_name || u.username}</Tag> : '-'
        },
        {
            title: 'Trạng Thái', dataIndex: 'status', align: 'center' as const, width: 120,
            render: (t: any) => {
                let color = 'default';
                let label = t;
                if (t === 'QUOTATION') { color = 'orange'; label = 'Báo Giá'; }
                if (t === 'SO_PENDING') { color = 'processing'; label = 'Mới'; }
                if (t === 'SAMPLE_APPROVED') { color = 'cyan'; label = 'Đã Duyệt'; }
                if (t === 'DEPOSITED') { color = 'purple'; label = 'Đã Cọc'; }
                if (t === 'PLANNED') { color = 'geekblue'; label = 'Kế Hoạch SX'; }
                if (t === 'IN_PRODUCTION') { color = 'blue'; label = 'Đang SX'; }
                if (t === 'MANUFACTURING_COMPLETED') { color = 'gold'; label = 'Xong SX'; }
                if (t === 'COMPLETED') { color = 'success'; label = 'Hoàn Thành'; }
                if (t === 'DELIVERED') { color = 'geekblue'; label = 'Đã Giao'; }
                if (t === 'CANCELLED') { color = 'error'; label = 'Hủy'; }
                return <Tag color={color}>{label}</Tag>
            }
        },
        {
            title: 'Thanh Toán', dataIndex: 'payment_status', width: 140,
            render: (t: any, r: any) => {
                const total = Number(r.total_amount) || 0;
                const paid = Number(r.paid_amount) || 0;
                const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;

                return (
                    <Tooltip title={`Đã trả: ${paid.toLocaleString()} / ${total.toLocaleString()}`}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                                <Progress percent={pct} size="small" steps={5} strokeColor={pct >= 100 ? '#52c41a' : '#1890ff'} showInfo={false} />
                                <span style={{ fontSize: 11, color: pct >= 100 ? 'green' : '#666' }}>{pct}%</span>
                            </div>
                            {r.require_invoice && <Tag color="blue" style={{ margin: 0 }}>Lấy hóa đơn</Tag>}
                        </div>
                    </Tooltip>
                )
            }
        },
        {
            title: '', key: 'act', width: 120, align: 'right' as const,
            render: (r: any) => (
                <Space size={2}>
                    <Tooltip title="Xem/Sửa">
                        <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => openDetailModal(r)} />
                    </Tooltip>
                    <Tooltip title="Nhắc nhở">
                        <Button type="text" size="small" icon={<BellOutlined style={{ color: '#fa8c16' }} />} onClick={() => handleCreateTask(r)} />
                    </Tooltip>
                    <Tooltip title="Copy Link KH">
                        <Button type="text" size="small" icon={<LinkOutlined style={{ color: '#52c41a' }} />} onClick={() => handleCopyLink(r.uuid)} />
                    </Tooltip>
                </Space>
            )
        }
    ];

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                {/* FILTER BAR - MOBILE FRIENDLY */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: 16, gap: isMobile ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}><CalendarOutlined /> Thống kê:</span>

                        {/* Year Select */}
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
                                    onClick={() => {
                                        setSelectedMonth(null);
                                        const start = dayjs().year(selectedYear).startOf('year');
                                        const end = dayjs().year(selectedYear).endOf('year');
                                        setDateRange([start, end]);
                                    }}
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

                {/* STATS CARDS - GSAP & Glassmorphism */}
                <SalesKpiDashboard metrics={metrics} isMobile={!!isMobile} />
            </div>

            <Card
                title={
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 12 }}>
                        <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600 }}>Quản Lý Đơn Hàng</span>
                        <Input prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="Tìm kiếm..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: isMobile ? '100%' : 250 }} allowClear />
                    </div>
                }
                extra={
                    isMobile ? (
                        <Space>
                            {canCreate && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openDetailModal(null)}>Tạo</Button>}
                            <Dropdown
                                menu={{
                                    items: [
                                        ...(canCreate ? [{ key: 'internal', label: 'Tạo Nhập Kho (NB)', icon: <AppstoreAddOutlined />, onClick: () => openDetailModal({ isInternal: true }) }] : []),
                                        { key: 'refresh', label: 'Làm mới', icon: <ReloadOutlined />, onClick: fetchData }
                                    ]
                                }}
                                trigger={['click']}
                                placement="bottomRight"
                            >
                                <Button size="small" icon={<MoreOutlined />} />
                            </Dropdown>
                        </Space>
                    ) : (
                        <Space>
                            {canCreate && <Button type="dashed" icon={<AppstoreAddOutlined />} onClick={() => openDetailModal({ isInternal: true })} style={{ borderColor: '#722ed1', color: '#722ed1' }}>Tạo Đơn Nhập Kho (Nội Bộ)</Button>}
                            <Button type="default" icon={<ShopOutlined />} onClick={() => navigate('/sales/pos')} style={{ borderColor: '#52c41a', color: '#52c41a' }}>Bán Lẻ (POS)</Button>
                            {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => openDetailModal(null)}>Tạo Đơn Mới</Button>}
                            <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
                        </Space>
                    )
                }
                bodyStyle={{ padding: isMobile ? '0 12px 12px' : '0 24px 24px' }}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        { key: 'ALL', label: 'Tất cả' },
                        { key: 'WEB_ORDER', label: '🛒 Đơn hàng lẻ' },
                        { key: 'SO_PENDING', label: 'Chờ Duyệt' },
                        { key: 'DEPOSITED', label: 'Đã Đặt Cọc' },
                        { key: 'SAMPLE_APPROVED', label: 'Đã Duyệt Mẫu SX' },
                        { key: 'IN_PRODUCTION', label: 'Đang Sản Xuất' },
                        { key: 'MANUFACTURING_COMPLETED', label: 'Hoàn Thành SX' },
                        { key: 'DELIVERED', label: 'Đã Giao' },
                        { key: 'COMPLETED', label: 'Hoàn Thành' },
                        { key: 'QUOTATION', label: 'Báo Giá (Draft)' },
                    ]}
                    style={{ marginBottom: 16 }}
                />

                {/* MOBILE LIST VIEW */}
                {isMobile ? (
                    <List
                        dataSource={filteredData}
                        loading={loading}
                        pagination={{ pageSize: 10, showTotal: (total: number) => `Tổng ${total} đơn` }}
                        renderItem={(r: any) => {
                            const total = Number(r.total_amount) || 0;
                            const paid = Number(r.paid_amount) || 0;
                            const remain = total - paid;
                            const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;

                            // Status tag
                            let color = 'default', label = r.status;
                            if (r.status === 'QUOTATION') { color = 'orange'; label = 'Báo Giá'; }
                            if (r.status === 'SO_PENDING') { color = 'processing'; label = 'Mới'; }
                            if (r.status === 'SAMPLE_APPROVED') { color = 'cyan'; label = 'Đã Duyệt'; }
                            if (r.status === 'DEPOSITED') { color = 'purple'; label = 'Đã Cọc'; }
                            if (r.status === 'PLANNED') { color = 'geekblue'; label = 'Kế Hoạch SX'; }
                            if (r.status === 'IN_PRODUCTION') { color = 'blue'; label = 'Đang SX'; }
                            if (r.status === 'COMPLETED') { color = 'success'; label = 'Hoàn Thành'; }
                            if (r.status === 'DELIVERED') { color = 'geekblue'; label = 'Đã Giao'; }
                            if (r.status === 'CANCELLED') { color = 'error'; label = 'Hủy'; }

                            return (
                                <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ width: '100%' }} onClick={() => openDetailModal(r)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <div onClick={() => openDetailModal(r)} style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: '#1890ff' }}>{r.order_code}</div>
                                                <div style={{ fontSize: 13, color: '#333' }}>{r.customer?.name || r.customer_name || '-'}</div>
                                            </div>
                                            <Tag color={color}>{label}</Tag>
                                        </div>
                                        <div onClick={() => openDetailModal(r)}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                                <div>
                                                    <span style={{ color: '#666' }}>Tổng: </span>
                                                    <span style={{ fontWeight: 600, color: '#262626' }}>{total.toLocaleString()}đ</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#666' }}>Còn lại: </span>
                                                    <span style={{ fontWeight: 500, color: remain > 0 ? '#fa541c' : '#52c41a' }}>{remain.toLocaleString()}đ</span>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 8 }}>
                                                <Progress percent={pct} size="small" strokeColor={pct >= 100 ? '#52c41a' : '#1890ff'} showInfo={false} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: '#999' }}>
                                                <span>{r.order_date ? dayjs(r.order_date).format('DD/MM/YYYY') : '-'}</span>
                                                <span>{r.assigned_to?.full_name || '-'}</span>
                                                {r.require_invoice && <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>Lấy hóa đơn</Tag>}
                                            </div>
                                        </div>
                                        {/* Action buttons on mobile list item */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px dashed #f0f0f0', gap: 12 }}>
                                            <div style={{ color: '#fa8c16', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => { e.stopPropagation(); handleCreateTask(r); }}>
                                                <BellOutlined /> <span>Nhắc nhở</span>
                                            </div>
                                            <div style={{ color: '#52c41a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => { e.stopPropagation(); handleCopyLink(r.uuid); }}>
                                                <LinkOutlined /> <span>Link KH</span>
                                            </div>
                                            <div style={{ color: '#1890ff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => { e.stopPropagation(); openDetailModal(r); }}>
                                                <EditOutlined /> <span>Chi tiết</span>
                                            </div>
                                        </div>
                                    </div>
                                </List.Item>
                            );
                        }}
                    />
                ) : (
                    <Table
                        dataSource={filteredData}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} đơn hàng` }}
                        size="middle"
                    />
                )}

                {/* MODALS */}
                <QuickTaskModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} initialValues={taskInitialValues} />

                <SalesOrderDetail
                    open={detailModalOpen}
                    onClose={() => {
                        setDetailModalOpen(false);
                        setDeepLinkTab(null);
                        setDeepLinkHighlight(null);
                    }}
                    onSuccess={fetchData}
                    initialData={editingOrder}
                    customers={customers}
                    products={products}
                    users={users}
                    isQuotation={false}
                    defaultCommentTab={deepLinkTab || undefined}
                    highlightCommentId={deepLinkHighlight || undefined}
                />
                
                {isMobile && (
                    <FloatButton
                        icon={<ShopOutlined />}
                        type="primary"
                        style={{ right: 24, bottom: 80, backgroundColor: '#52c41a' }}
                        tooltip={<div>Bán Lẻ (POS)</div>}
                        onClick={() => navigate('/sales/pos')}
                    />
                )}
            </Card>
        </div >
    );
};

export default SalesPage;