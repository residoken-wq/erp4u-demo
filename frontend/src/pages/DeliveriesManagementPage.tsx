import React, { useEffect, useState, useMemo } from 'react';
import { 
    Table, Tag, Button, Input, Select, DatePicker, Card, Row, Col, Space, 
    Tooltip, Modal, message, Badge, Typography, Statistic, Divider, Spin, 
    Alert, Dropdown, MenuProps 
} from 'antd';
import { 
    CarOutlined, SearchOutlined, ReloadOutlined, PrinterOutlined, 
    FilePdfOutlined, HistoryOutlined, CopyOutlined, MessageOutlined, 
    CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, 
    SyncOutlined, InfoCircleOutlined, PhoneOutlined, EnvironmentOutlined, 
    DropboxOutlined, FilterOutlined, SendOutlined, ThunderboltOutlined,
    GlobalOutlined, PictureOutlined, CompassOutlined, DollarOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

interface DeliveryItem {
    id: number;
    sku: string;
    quantity: number;
    product_name: string;
    unit: string;
    unit_price: number;
    order_quantity: number;
}

interface SiblingDelivery {
    id: number;
    code: string;
    delivery_date: string;
    status: string;
    shipping_carrier: string;
    tracking_code: string;
    shipping_cost: number;
    items_count: number;
    total_quantity: number;
    pick_money: number;
    shipping_status_text?: string;
}

interface DeliveryRecord {
    id: number;
    code: string;
    order_id: number;
    order_code: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    contact_name: string;
    contact_phone: string;
    delivery_date: string;
    created_at: string;
    status: string;
    email_sent: boolean;
    note: string;
    attachments: string[];
    shipping_carrier: string;
    shipping_provider: string;
    tracking_code: string;
    shipping_cost: number;
    pick_money: number;
    is_freeship: number;
    weight_gram: number;
    package_count: number;
    package_length?: number;
    package_width?: number;
    package_height?: number;
    packing_spec_name?: string;
    shipping_status_id?: number;
    shipping_status_text?: string;
    shipping_metadata?: any;
    shipping_legs?: any[];
    delivery_notice?: string;
    order_status?: string;
    order_total_amount?: number;
    order_paid_amount?: number;
    items: DeliveryItem[];
    sibling_deliveries: SiblingDelivery[];
    all_order_deliveries: SiblingDelivery[];
}

interface DeliveryStats {
    total_count: number;
    ghtk_count: number;
    lalamove_count: number;
    other_count: number;
    total_shipping_cost: number;
    total_pick_money: number;
}

const DeliveriesManagementPage: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
    const [stats, setStats] = useState<DeliveryStats>({
        total_count: 0,
        ghtk_count: 0,
        lalamove_count: 0,
        other_count: 0,
        total_shipping_cost: 0,
        total_pick_money: 0
    });

    // Filters
    const [carrierFilter, setCarrierFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

    // Modal tracking GHTK
    const [ghtkTrackingOpen, setGhtkTrackingOpen] = useState<boolean>(false);
    const [ghtkTrackingLoading, setGhtkTrackingLoading] = useState<boolean>(false);
    const [currentTrackingDelivery, setCurrentTrackingDelivery] = useState<DeliveryRecord | null>(null);
    const [ghtkTimelineData, setGhtkTimelineData] = useState<any>(null);

    // Modal tracking & POD Lalamove
    const [lalamoveModalOpen, setLalamoveModalOpen] = useState<boolean>(false);
    const [lalamoveLoading, setLalamoveLoading] = useState<boolean>(false);
    const [lalamoveOrderData, setLalamoveOrderData] = useState<any>(null);
    const [currentLalamoveDelivery, setCurrentLalamoveDelivery] = useState<DeliveryRecord | null>(null);

    // Modal view & copy delivery notice
    const [noticeModalOpen, setNoticeModalOpen] = useState<boolean>(false);
    const [currentNoticeDelivery, setCurrentNoticeDelivery] = useState<DeliveryRecord | null>(null);

    // Syncing carrier status
    const [syncingId, setSyncingId] = useState<number | null>(null);

    const fetchDeliveries = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (carrierFilter && carrierFilter !== 'ALL') {
                params.carrier = carrierFilter;
            }
            if (statusFilter && statusFilter !== 'ALL') {
                params.status = statusFilter;
            }
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }
            if (dateRange && dateRange[0] && dateRange[1]) {
                params.startDate = dateRange[0].format('YYYY-MM-DD');
                params.endDate = dateRange[1].format('YYYY-MM-DD');
            }

            const res = await api.get('/shipping/deliveries', { params });
            if (res.data) {
                setDeliveries(res.data.data || []);
                if (res.data.stats) {
                    setStats(res.data.stats);
                }
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi khi tải danh sách vận đơn');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveries();
    }, [carrierFilter, statusFilter, dateRange]);

    // Quick Date Presets
    const handleSetDatePreset = (preset: 'today' | 'week' | 'month' | 'last_month' | 'all') => {
        if (preset === 'today') {
            setDateRange([dayjs().startOf('day'), dayjs().endOf('day')]);
        } else if (preset === 'week') {
            setDateRange([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
        } else if (preset === 'month') {
            setDateRange([dayjs().startOf('month'), dayjs().endOf('month')]);
        } else if (preset === 'last_month') {
            const lastMonth = dayjs().subtract(1, 'month');
            setDateRange([lastMonth.startOf('month'), lastMonth.endOf('month')]);
        } else if (preset === 'all') {
            setDateRange(null);
        }
    };

    // Copy to clipboard helper
    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        message.success(`Đã sao chép ${label}: ${text}`);
    };

    // GHTK Tracking View
    const handleViewGhtkTracking = async (record: DeliveryRecord) => {
        setCurrentTrackingDelivery(record);
        setGhtkTrackingOpen(true);
        setGhtkTrackingLoading(true);
        setGhtkTimelineData(null);
        try {
            const res = await api.get(`/shipping/delivery/${record.id}/tracking`);
            setGhtkTimelineData(res.data);
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể tra cứu hành trình GHTK');
        } finally {
            setGhtkTrackingLoading(false);
        }
    };

    // GHTK Print Label
    const handlePrintGhtkLabel = async (record: DeliveryRecord) => {
        try {
            const res = await api.get(`/shipping/delivery/${record.id}/label?pageSize=A6`);
            if (res.data?.url) {
                window.open(res.data.url, '_blank');
            } else {
                message.warning('Không tìm thấy link nhãn in GHTK');
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi lấy nhãn in GHTK');
        }
    };

    // Lalamove Details & POD View
    const handleViewLalamoveDetails = async (record: DeliveryRecord) => {
        setCurrentLalamoveDelivery(record);
        setLalamoveModalOpen(true);
        setLalamoveLoading(true);
        setLalamoveOrderData(null);
        try {
            const orderId = record.shipping_metadata?.orderId || record.tracking_code;
            if (orderId) {
                const res = await api.get(`/shipping/delivery/${record.id}/lalamove-order/${orderId}`);
                setLalamoveOrderData(res.data);
            } else {
                setLalamoveOrderData(record.shipping_metadata);
            }
        } catch (e: any) {
            setLalamoveOrderData(record.shipping_metadata);
        } finally {
            setLalamoveLoading(false);
        }
    };

    // Sync Carrier Status
    const handleSyncStatus = async (record: DeliveryRecord) => {
        try {
            setSyncingId(record.id);
            const res = await api.post(`/shipping/delivery/${record.id}/sync-carrier`);
            if (res.data?.success !== false) {
                message.success(res.data?.message || 'Đã đồng bộ trạng thái từ hãng vận chuyển');
            } else {
                message.warning(res.data?.message || 'Chưa thể đồng bộ trạng thái');
            }
            fetchDeliveries();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi đồng bộ trạng thái');
        } finally {
            setSyncingId(null);
        }
    };

    // Delivery Status Badge Helper
    const renderDeliveryStatusTag = (status: string) => {
        switch (status) {
            case 'PENDING_EXPORT':
                return <Tag color="orange" icon={<ClockCircleOutlined />}>Chờ xuất kho</Tag>;
            case 'SHIPPED':
                return <Tag color="blue" icon={<CarOutlined />}>Đã gửi hàng</Tag>;
            case 'COMPLETED':
                return <Tag color="green" icon={<CheckCircleOutlined />}>Hoàn tất</Tag>;
            case 'DRAFT':
                return <Tag color="default">Phiếu nháp</Tag>;
            default:
                return <Tag>{status || 'Chưa xác định'}</Tag>;
        }
    };

    // Carrier Badge Helper
    const renderCarrierBadge = (carrier: string, provider: string) => {
        const cUpper = (carrier || '').toUpperCase();
        const pUpper = (provider || '').toUpperCase();
        if (cUpper.includes('GHTK') || pUpper === 'GHTK') {
            return (
                <Tag color="#008444" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                    <ThunderboltOutlined style={{ marginRight: 4 }} /> GHTK
                </Tag>
            );
        }
        if (cUpper.includes('LALAMOVE') || pUpper === 'LALAMOVE') {
            return (
                <Tag color="#eb6100" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                    <CarOutlined style={{ marginRight: 4 }} /> Lalamove
                </Tag>
            );
        }
        return (
            <Tag color="#108ee9" style={{ margin: 0 }}>
                <SendOutlined style={{ marginRight: 4 }} /> {carrier || 'Chành xe / Nội bộ'}
            </Tag>
        );
    };

    // Table Columns
    const columns = [
        {
            title: 'Mã SO',
            key: 'order_code',
            width: 140,
            render: (_: any, r: DeliveryRecord) => (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <a 
                            href={`/orders?search=${encodeURIComponent(r.order_code)}`} 
                            style={{ fontWeight: 700, color: '#1677ff', fontSize: 13 }}
                        >
                            {r.order_code || `SO #${r.order_id}`}
                        </a>
                        <Tooltip title="Sao chép mã SO">
                            <Button 
                                type="text" 
                                size="small" 
                                icon={<CopyOutlined style={{ fontSize: 11, color: '#8c8c8c' }} />} 
                                onClick={() => handleCopy(r.order_code, 'Mã SO')} 
                                style={{ width: 20, height: 20 }}
                            />
                        </Tooltip>
                    </div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                        Phiếu: <b>{r.code}</b>
                    </div>
                </div>
            )
        },
        {
            title: 'Khách Hàng',
            key: 'customer',
            width: 200,
            render: (_: any, r: DeliveryRecord) => (
                <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                        {r.customer_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <PhoneOutlined style={{ fontSize: 10 }} />
                        <span>{r.customer_phone || r.contact_phone || 'Chưa có SĐT'}</span>
                    </div>
                    {r.customer_address && (
                        <Tooltip title={r.customer_address}>
                            <div style={{ 
                                fontSize: 11, 
                                color: '#94a3b8', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                maxWidth: 190,
                                marginTop: 2 
                            }}>
                                <EnvironmentOutlined style={{ fontSize: 10, marginRight: 3 }} />
                                {r.customer_address}
                            </div>
                        </Tooltip>
                    )}
                </div>
            )
        },
        {
            title: 'Vận Đơn & ĐVVC',
            key: 'tracking',
            width: 190,
            render: (_: any, r: DeliveryRecord) => (
                <div>
                    <div style={{ marginBottom: 4 }}>
                        {renderCarrierBadge(r.shipping_carrier, r.shipping_provider)}
                    </div>
                    {r.tracking_code ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 700, 
                                fontSize: 12, 
                                color: r.tracking_code.startsWith('GHTK-DEMO') ? '#fa8c16' : '#0f172a',
                                background: '#f1f5f9',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: '1px solid #e2e8f0'
                            }}>
                                {r.tracking_code}
                            </span>
                            <Tooltip title="Sao chép mã vận đơn">
                                <Button 
                                    type="text" 
                                    size="small" 
                                    icon={<CopyOutlined style={{ fontSize: 11 }} />} 
                                    onClick={() => handleCopy(r.tracking_code, 'Mã vận đơn')} 
                                    style={{ width: 20, height: 20 }}
                                />
                            </Tooltip>
                        </div>
                    ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Chưa có mã VĐ</span>
                    )}
                </div>
            )
        },
        {
            title: 'Ngày Tạo / Giao',
            key: 'dates',
            width: 130,
            render: (_: any, r: DeliveryRecord) => (
                <div style={{ fontSize: 12 }}>
                    <div>
                        <span style={{ color: '#64748b' }}>Giao: </span>
                        <b style={{ color: '#0f172a' }}>{r.delivery_date ? dayjs(r.delivery_date).format('DD/MM/YYYY') : '-'}</b>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        Tạo: {dayjs(r.created_at).format('DD/MM/YY HH:mm')}
                    </div>
                </div>
            )
        },
        {
            title: 'Trạng Thái',
            key: 'status',
            width: 170,
            render: (_: any, r: DeliveryRecord) => (
                <div>
                    <div style={{ marginBottom: 4 }}>
                        {renderDeliveryStatusTag(r.status)}
                    </div>
                    {r.shipping_status_text && (
                        <div style={{ fontSize: 11, color: '#475569', background: '#f8fafc', padding: '2px 6px', borderRadius: 4, border: '1px solid #e2e8f0', display: 'inline-block' }}>
                            {r.shipping_status_text}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Cước Phí & COD',
            key: 'cost',
            width: 160,
            align: 'right' as const,
            render: (_: any, r: DeliveryRecord) => (
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: r.shipping_cost > 0 ? '#1e293b' : '#64748b', fontSize: 13 }}>
                        {r.shipping_cost > 0 ? `${r.shipping_cost.toLocaleString()} đ` : '0 đ'}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                        {r.is_freeship === 1 ? (
                            <Tag color="cyan" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>Shop trả</Tag>
                        ) : (
                            <Tag color="magenta" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>Khách trả</Tag>
                        )}
                    </div>
                    {r.pick_money > 0 && (
                        <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 3 }}>
                            COD: {r.pick_money.toLocaleString()} đ
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Thao Tác',
            key: 'actions',
            width: 150,
            align: 'center' as const,
            render: (_: any, r: DeliveryRecord) => {
                const isGhtk = (r.shipping_carrier || '').toUpperCase().includes('GHTK') || r.shipping_provider === 'GHTK';
                const isLalamove = (r.shipping_carrier || '').toUpperCase().includes('LALAMOVE') || r.shipping_provider === 'LALAMOVE';

                return (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {/* GHTK Tracking / Print */}
                        {isGhtk && r.tracking_code && (
                            <>
                                <Tooltip title="Xem hành trình GHTK">
                                    <Button 
                                        size="small" 
                                        icon={<HistoryOutlined style={{ color: '#008444' }} />} 
                                        onClick={() => handleViewGhtkTracking(r)} 
                                    />
                                </Tooltip>
                                {!r.tracking_code.startsWith('GHTK-DEMO') && (
                                    <Tooltip title="In Vận Đơn GHTK (A6)">
                                        <Button 
                                            size="small" 
                                            style={{ color: '#008444', borderColor: '#b7eb8f' }} 
                                            icon={<FilePdfOutlined />} 
                                            onClick={() => handlePrintGhtkLabel(r)} 
                                        />
                                    </Tooltip>
                                )}
                            </>
                        )}

                        {/* Lalamove Tracking & POD */}
                        {isLalamove && (
                            <Tooltip title="Xem chi tiết chuyến Lalamove & Ảnh POD">
                                <Button 
                                    size="small" 
                                    style={{ color: '#eb6100', borderColor: '#ffd591' }} 
                                    icon={<CarOutlined />} 
                                    onClick={() => handleViewLalamoveDetails(r)} 
                                />
                            </Tooltip>
                        )}

                        {/* Thông báo giao hàng */}
                        <Tooltip title="Xem & Sao chép Thông báo giao hàng (Zalo)">
                            <Button 
                                size="small" 
                                style={{ color: '#1677ff', borderColor: '#91d5ff' }} 
                                icon={<MessageOutlined />} 
                                onClick={() => {
                                    setCurrentNoticeDelivery(r);
                                    setNoticeModalOpen(true);
                                }} 
                            />
                        </Tooltip>

                        {/* Đồng bộ trạng thái */}
                        {(isGhtk || isLalamove) && r.tracking_code && (
                            <Tooltip title="Đồng bộ trạng thái từ hãng vận chuyển">
                                <Button 
                                    size="small" 
                                    icon={<SyncOutlined spin={syncingId === r.id} />} 
                                    loading={syncingId === r.id}
                                    onClick={() => handleSyncStatus(r)} 
                                />
                            </Tooltip>
                        )}
                    </div>
                );
            }
        }
    ];

    // Expandable Row Renderer
    const expandedRowRender = (record: DeliveryRecord) => {
        const totalDeliveredQty = (record.items || []).reduce((acc, it) => acc + it.quantity, 0);

        return (
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', margin: '4px 0' }}>
                <Row gutter={[16, 16]}>
                    {/* CỘT TRÁI: DANH SÁCH MẶT HÀNG XUẤT ĐỢT NÀY */}
                    <Col xs={24} lg={13}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <DropboxOutlined style={{ color: '#1677ff' }} />
                                <span>Danh Sách Sản Phẩm Xuất Đợt Này (Tổng: {totalDeliveredQty}):</span>
                            </div>
                            <Tag color="blue">Phiếu: {record.code}</Tag>
                        </div>
                        <Table 
                            dataSource={record.items} 
                            rowKey="id" 
                            pagination={false} 
                            size="small"
                            bordered
                            style={{ background: '#fff' }}
                            columns={[
                                { title: 'SKU', dataIndex: 'sku', width: 100, render: (v: string) => <b style={{ fontFamily: 'monospace' }}>{v}</b> },
                                { title: 'Tên Sản Phẩm', dataIndex: 'product_name' },
                                { title: 'ĐVT', dataIndex: 'unit', width: 60, align: 'center' },
                                { 
                                    title: 'Giao / Đặt', 
                                    key: 'qty', 
                                    width: 100, 
                                    align: 'center',
                                    render: (_: any, it: DeliveryItem) => (
                                        <span>
                                            <b style={{ color: '#1677ff', fontSize: 13 }}>{it.quantity}</b>
                                            <span style={{ color: '#94a3b8' }}> / {it.order_quantity || it.quantity}</span>
                                        </span>
                                    )
                                }
                            ]}
                        />

                        {/* Ghi chú giao hàng nếu có */}
                        {record.note && (
                            <div style={{ marginTop: 8, fontSize: 12, background: '#fffbe6', padding: '6px 10px', borderRadius: 6, border: '1px solid #ffe58f' }}>
                                <span style={{ fontWeight: 600, color: '#d46b08' }}>Ghi chú phiếu: </span>
                                <span>{record.note}</span>
                            </div>
                        )}
                    </Col>

                    {/* CỘT PHẢI: CÁC ĐỢT GIAO LIÊN QUAN CÙNG SO & THÔNG TIN GIAO NHẬN */}
                    <Col xs={24} lg={11}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <HistoryOutlined style={{ color: '#52c41a' }} />
                                <span>Các Đợt Giao Cùng Đơn Hàng ({record.all_order_deliveries?.length || 1} đợt):</span>
                            </div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                                Mã SO: <b>{record.order_code}</b>
                            </span>
                        </div>

                        {record.all_order_deliveries && record.all_order_deliveries.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {record.all_order_deliveries.map((sib, index) => {
                                    const isCurrent = sib.id === record.id;
                                    return (
                                        <div 
                                            key={sib.id}
                                            style={{
                                                background: isCurrent ? '#e6f7ff' : '#ffffff',
                                                border: isCurrent ? '1.5px solid #91d5ff' : '1px solid #e2e8f0',
                                                borderRadius: 6,
                                                padding: '8px 12px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontWeight: 700, fontSize: 12, color: isCurrent ? '#0958d9' : '#1e293b' }}>
                                                        Đợt {index + 1}: {sib.code}
                                                    </span>
                                                    {isCurrent && <Tag color="processing" style={{ margin: 0, fontSize: 10 }}>Đang xem</Tag>}
                                                    {renderCarrierBadge(sib.shipping_carrier, '')}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                    Ngày giao: <b>{sib.delivery_date ? dayjs(sib.delivery_date).format('DD/MM/YYYY') : '-'}</b> | 
                                                    SL: <b style={{ color: '#0958d9' }}>{sib.total_quantity}</b> sp | 
                                                    Mã VĐ: {sib.tracking_code ? <b style={{ fontFamily: 'monospace' }}>{sib.tracking_code}</b> : <i style={{ color: '#94a3b8' }}>Chưa có</i>}
                                                </div>
                                            </div>
                                            <div>
                                                {renderDeliveryStatusTag(sib.status)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Alert message="Đơn hàng này chỉ có duy nhất 1 đợt xuất kho." type="info" showIcon />
                        )}

                        {/* THÔNG TIN NGƯỜI NHẬN & QUY CÁCH KIỆN */}
                        <div style={{ marginTop: 12, background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                            <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                                📍 Chi tiết nhận hàng:
                            </div>
                            <div style={{ color: '#475569' }}>
                                Người nhận: <b>{record.contact_name || record.customer_name}</b> ({record.contact_phone || record.customer_phone})
                            </div>
                            <div style={{ color: '#475569', marginTop: 2 }}>
                                Địa chỉ: {record.customer_address || 'Theo thỏa thuận'}
                            </div>
                            {(record.package_count > 1 || record.package_length || record.weight_gram) && (
                                <div style={{ color: '#0284c7', marginTop: 4, fontSize: 11, background: '#f0f9ff', padding: '3px 6px', borderRadius: 4 }}>
                                    📦 Quy cách: {record.package_count || 1} kiện | 
                                    {record.package_length ? ` ${record.package_length}x${record.package_width}x${record.package_height} cm | ` : ''} 
                                    Trọng lượng: {record.weight_gram || 500}g
                                </div>
                            )}
                        </div>
                    </Col>
                </Row>
            </div>
        );
    };

    return (
        <div style={{ padding: '0 4px' }}>
            {/* TIÊU ĐỀ TRANG & ACTION HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <Title level={4} style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CarOutlined style={{ color: '#1677ff' }} />
                        <span>Quản Lý Giao Nhận & Vận Đơn (GHTK / Lalamove)</span>
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Theo dõi tập trung các vận đơn xuất kho, tình trạng giao hàng, cước phí và đối soát COD
                    </Text>
                </div>
                <Space>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={fetchDeliveries} 
                        loading={loading}
                    >
                        Làm mới
                    </Button>
                </Space>
            </div>

            {/* BẢNG THỐNG KÊ KPI CARDS */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={6} md={4}>
                    <Card size="small" style={{ borderRadius: 8, borderColor: '#e2e8f0' }} hoverable onClick={() => setCarrierFilter('ALL')}>
                        <Statistic 
                            title={<span style={{ fontSize: 12, color: '#64748b' }}>Tổng Vận Đơn</span>}
                            value={stats.total_count}
                            valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20 }}
                            prefix={<DropboxOutlined style={{ color: '#1677ff' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6} md={5}>
                    <Card size="small" style={{ borderRadius: 8, borderColor: '#b7eb8f', background: carrierFilter === 'GHTK' ? '#f6ffed' : '#fff' }} hoverable onClick={() => setCarrierFilter('GHTK')}>
                        <Statistic 
                            title={<span style={{ fontSize: 12, color: '#008444', fontWeight: 600 }}>Vận Đơn GHTK</span>}
                            value={stats.ghtk_count}
                            valueStyle={{ color: '#008444', fontWeight: 700, fontSize: 20 }}
                            prefix={<ThunderboltOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6} md={5}>
                    <Card size="small" style={{ borderRadius: 8, borderColor: '#ffd591', background: carrierFilter === 'LALAMOVE' ? '#fff7e6' : '#fff' }} hoverable onClick={() => setCarrierFilter('LALAMOVE')}>
                        <Statistic 
                            title={<span style={{ fontSize: 12, color: '#eb6100', fontWeight: 600 }}>Vận Đơn Lalamove</span>}
                            value={stats.lalamove_count}
                            valueStyle={{ color: '#eb6100', fontWeight: 700, fontSize: 20 }}
                            prefix={<CarOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6} md={5}>
                    <Card size="small" style={{ borderRadius: 8, borderColor: '#e2e8f0' }}>
                        <Statistic 
                            title={<span style={{ fontSize: 12, color: '#64748b' }}>Tổng Cước Phí</span>}
                            value={stats.total_shipping_cost}
                            precision={0}
                            valueStyle={{ color: '#1e293b', fontWeight: 700, fontSize: 18 }}
                            suffix="đ"
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6} md={5}>
                    <Card size="small" style={{ borderRadius: 8, borderColor: '#e2e8f0' }}>
                        <Statistic 
                            title={<span style={{ fontSize: 12, color: '#d97706' }}>Thu Hộ COD</span>}
                            value={stats.total_pick_money}
                            precision={0}
                            valueStyle={{ color: '#d97706', fontWeight: 700, fontSize: 18 }}
                            suffix="đ"
                        />
                    </Card>
                </Col>
            </Row>

            {/* THANH BỘ LỌC & TÌM KIẾM */}
            <Card size="small" style={{ marginBottom: 16, borderRadius: 8, borderColor: '#e2e8f0' }}>
                <Row gutter={[10, 10]} align="middle">
                    {/* Tìm kiếm từ khóa */}
                    <Col xs={24} md={7}>
                        <Input 
                            placeholder="Tìm Mã SO, Mã Vận Đơn, Tên KH, SĐT..." 
                            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onPressEnter={fetchDeliveries}
                            allowClear
                        />
                    </Col>

                    {/* Filter ĐVVC */}
                    <Col xs={12} md={4}>
                        <Select 
                            style={{ width: '100%' }}
                            value={carrierFilter}
                            onChange={val => setCarrierFilter(val)}
                            options={[
                                { value: 'ALL', label: 'Tất cả ĐVVC' },
                                { value: 'GHTK', label: '⚡ GHTK' },
                                { value: 'LALAMOVE', label: '🚗 Lalamove' },
                                { value: 'OTHER', label: '📦 Chành xe / Khác' },
                            ]}
                        />
                    </Col>

                    {/* Filter Trạng thái */}
                    <Col xs={12} md={4}>
                        <Select 
                            style={{ width: '100%' }}
                            value={statusFilter}
                            onChange={val => setStatusFilter(val)}
                            options={[
                                { value: 'ALL', label: 'Tất cả trạng thái' },
                                { value: 'PENDING_EXPORT', label: 'Chờ xuất kho' },
                                { value: 'SHIPPED', label: 'Đã gửi hàng' },
                                { value: 'COMPLETED', label: 'Hoàn tất' },
                                { value: 'DRAFT', label: 'Phiếu nháp' },
                            ]}
                        />
                    </Col>

                    {/* Chọn mốc thời gian */}
                    <Col xs={24} md={9} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <RangePicker 
                            style={{ flex: 1 }}
                            format="DD/MM/YYYY"
                            value={dateRange}
                            onChange={(dates: any) => setDateRange(dates)}
                            placeholder={['Từ ngày', 'Đến ngày']}
                        />
                        <Select 
                            size="middle"
                            style={{ width: 115 }}
                            placeholder="Mốc nhanh"
                            defaultValue="all"
                            onChange={handleSetDatePreset}
                            options={[
                                { value: 'all', label: 'Toàn thời gian' },
                                { value: 'today', label: 'Hôm nay' },
                                { value: 'week', label: '7 ngày qua' },
                                { value: 'month', label: 'Tháng này' },
                                { value: 'last_month', label: 'Tháng trước' },
                            ]}
                        />
                    </Col>
                </Row>
            </Card>

            {/* BẢNG DANH SÁCH VẬN ĐƠN CHÍNH */}
            <Table 
                dataSource={deliveries}
                rowKey="id"
                columns={columns}
                loading={loading}
                expandable={{
                    expandedRowRender,
                    rowExpandable: () => true,
                }}
                pagination={{
                    defaultPageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '15', '30', '50'],
                    showTotal: (total) => `Tổng cộng ${total} vận đơn`
                }}
                bordered
                size="middle"
                style={{ borderRadius: 8, overflow: 'hidden' }}
            />

            {/* MODAL TRA CỨU HÀNH TRÌNH GHTK */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CarOutlined style={{ color: '#008444' }} />
                        <span>Hành trình Vận Đơn GHTK: <b>{currentTrackingDelivery?.tracking_code}</b></span>
                    </div>
                }
                open={ghtkTrackingOpen}
                onCancel={() => setGhtkTrackingOpen(false)}
                footer={[
                    <Button key="print" type="dashed" icon={<FilePdfOutlined />} onClick={() => currentTrackingDelivery && handlePrintGhtkLabel(currentTrackingDelivery)}>
                        In nhãn A6
                    </Button>,
                    <Button key="close" type="primary" onClick={() => setGhtkTrackingOpen(false)}>
                        Đóng
                    </Button>
                ]}
                width={560}
            >
                {ghtkTrackingLoading ? (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <Spin tip="Đang tra cứu hành trình từ GHTK..." />
                    </div>
                ) : (
                    <div>
                        <div style={{ background: '#f6ffed', padding: 12, borderRadius: 6, border: '1px solid #b7eb8f', marginBottom: 15 }}>
                            <div style={{ fontWeight: 600, color: '#008444', marginBottom: 4, fontSize: 13 }}>
                                Trạng thái: {ghtkTimelineData?.status_text || currentTrackingDelivery?.shipping_status_text || 'Đang cập nhật'}
                            </div>
                            <div style={{ fontSize: 12, color: '#595959' }}>
                                Người nhận: <b>{currentTrackingDelivery?.contact_name}</b> ({currentTrackingDelivery?.contact_phone})
                            </div>
                            <div style={{ fontSize: 12, color: '#595959' }}>
                                Địa chỉ: {currentTrackingDelivery?.customer_address}
                            </div>
                        </div>

                        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Lịch sử vận chuyển:</div>
                        {ghtkTimelineData?.timeline && ghtkTimelineData.timeline.length > 0 ? (
                            <div style={{ maxHeight: 260, overflowY: 'auto', paddingLeft: 10 }}>
                                {ghtkTimelineData.timeline.map((t: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 12, borderLeft: '2px solid #008444', paddingLeft: 10 }}>
                                        <div style={{ fontSize: 11, color: '#888', minWidth: 110 }}>
                                            {dayjs(t.time).format('DD/MM/YYYY HH:mm')}
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b' }}>
                                            {t.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: '#888', fontStyle: 'italic', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                                Chưa có cập nhật hành trình mới từ Shipper GHTK.
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* MODAL CHI TIẾT CHUYẾN XE LALAMOVE & POD */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CarOutlined style={{ color: '#eb6100' }} />
                        <span>Chi Tiết Chuyến Xe Lalamove - Phiếu: <b>{currentLalamoveDelivery?.code}</b></span>
                    </div>
                }
                open={lalamoveModalOpen}
                onCancel={() => setLalamoveModalOpen(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setLalamoveModalOpen(false)}>
                        Đóng
                    </Button>
                ]}
                width={600}
            >
                {lalamoveLoading ? (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <Spin tip="Đang kiểm tra thông tin chuyến xe Lalamove..." />
                    </div>
                ) : (
                    <div>
                        <div style={{ background: '#fff7e6', padding: 12, borderRadius: 6, border: '1px solid #ffd591', marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, color: '#eb6100', fontSize: 14 }}>
                                Trạng thái: {lalamoveOrderData?.status || currentLalamoveDelivery?.shipping_status_text || 'Đã đặt xe'}
                            </div>
                            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                Mã đơn Lalamove: <b>{lalamoveOrderData?.orderId || currentLalamoveDelivery?.tracking_code}</b>
                            </div>
                            {lalamoveOrderData?.shareLink && (
                                <div style={{ marginTop: 6 }}>
                                    <a href={lalamoveOrderData.shareLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#eb6100', fontWeight: 600 }}>
                                        📍 Mở bản đồ định vị GPS tài xế thời gian thực &rarr;
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Thông tin tài xế */}
                        {lalamoveOrderData?.driver ? (
                            <div style={{ marginBottom: 16, background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>👨‍✈️ Tài xế nhận đơn:</div>
                                <div style={{ fontSize: 12 }}>Tên: <b>{lalamoveOrderData.driver.name}</b></div>
                                <div style={{ fontSize: 12 }}>SĐT: <b>{lalamoveOrderData.driver.phone}</b></div>
                                <div style={{ fontSize: 12 }}>Biển số xe: <b>{lalamoveOrderData.driver.plateNumber}</b></div>
                            </div>
                        ) : null}

                        {/* Ảnh nghiệm thu giao hàng POD */}
                        {lalamoveOrderData?.podUrl || currentLalamoveDelivery?.shipping_metadata?.podUrl ? (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <PictureOutlined style={{ color: '#52c41a' }} />
                                    <span>Ảnh Chứng Thực Giao Hàng (POD - Proof Of Delivery):</span>
                                </div>
                                <img 
                                    src={lalamoveOrderData?.podUrl || currentLalamoveDelivery?.shipping_metadata?.podUrl} 
                                    alt="Lalamove POD" 
                                    style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6, border: '1px solid #e2e8f0' }} 
                                />
                            </div>
                        ) : (
                            <div style={{ color: '#888', fontStyle: 'italic', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>
                                Đơn chưa hoàn tất hoặc tài xế chưa cập nhật ảnh giao hàng POD.
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* MODAL XEM & SAO CHÉP THÔNG BÁO GIAO HÀNG */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MessageOutlined style={{ color: '#1677ff' }} />
                        <span>Nội Dung Thông Báo Giao Hàng - Phiếu: <b>{currentNoticeDelivery?.code}</b></span>
                    </div>
                }
                open={noticeModalOpen}
                onCancel={() => setNoticeModalOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setNoticeModalOpen(false)}>
                        Đóng
                    </Button>,
                    <Button 
                        key="copy" 
                        type="primary" 
                        icon={<CopyOutlined />} 
                        onClick={() => currentNoticeDelivery?.delivery_notice && handleCopy(currentNoticeDelivery.delivery_notice, 'Thông báo giao hàng')}
                    >
                        Sao chép gửi Zalo / SMS
                    </Button>
                ]}
                width={620}
            >
                <div style={{ marginBottom: 10, fontSize: 12, color: '#64748b' }}>
                    Khách hàng: <b>{currentNoticeDelivery?.customer_name}</b> | Mã SO: <b>{currentNoticeDelivery?.order_code}</b>
                </div>
                <Input.TextArea
                    rows={12}
                    value={currentNoticeDelivery?.delivery_notice || 'Chưa lưu nội dung thông báo giao hàng cho phiếu xuất này.'}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: '1.5' }}
                />
            </Modal>
        </div>
    );
};

export default DeliveriesManagementPage;
