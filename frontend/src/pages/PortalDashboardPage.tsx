import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import PortalUserGuide from '../components/PortalUserGuide';
import { getGoogleDriveImageUrl } from '../utils/googleDrive';
import { Watermark, Modal } from 'antd';
import PortalB2BCustomizer from '../components/b2b/PortalB2BCustomizer';

// ============================================================
// B2B PORTAL DASHBOARD
// Design: erp4u-website CSS globals (Be Vietnam Pro, #23A7D3, card-v2)
// Layout: Header → Hero → Stats → Orders → Promotions → Tracking
// ============================================================

interface CustomerInfo {
    id: number;
    name: string;
    code: string;
    email: string;
    phone: string;
    address?: string;
}

interface OrderItem {
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    image_url?: string;
    customer_description?: string;
    product_type?: string;
    vat_content?: string;
}

interface Order {
    id: number;
    uuid: string;
    order_code: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    payment_status: string;
    order_date: string;
    delivery_date: string;
    payment_note?: string;
    discount_amount?: number;
    shipping_address?: string;
    receiver_name?: string;
    receiver_phone?: string;
    shipping_carrier?: string;
    tracking_code?: string;
    shipping_fee?: number;
    assigned_to: { full_name: string } | null;
    items: OrderItem[];
}

interface PromotionInfo {
    id: number;
    name: string;
    description: string;
    discount_type: string;
    discount_value: number;
    start_date: string;
    end_date: string;
    min_quantity?: number;
    min_order_value?: number;
}

interface PromotionProduct {
    id: number;
    sku: string;
    name: string;
    unit: string;
    base_price: number;
    image_url?: string;
    category: string;
    customer_description?: string;
    product_type?: string;
}

interface DashboardData {
    customer: CustomerInfo;
    stats: { total_orders: number; total_revenue: number; active_orders: number };
    orders: Order[];
    promotions: PromotionInfo[];
    watermark_image?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    QUOTATION: { label: 'Báo giá', color: '#1890ff', bg: '#e6f7ff' },
    SO_PENDING: { label: 'Chờ xử lý', color: '#fa8c16', bg: '#fff7e6' },
    DEPOSITED: { label: 'Đã cọc', color: '#52c41a', bg: '#f6ffed' },
    SAMPLE_APPROVED: { label: 'Duyệt mẫu', color: '#13c2c2', bg: '#e6fffb' },
    IN_PRODUCTION: { label: 'Sản xuất', color: '#722ed1', bg: '#f9f0ff' },
    PLANNED: { label: 'Kế hoạch SX', color: '#722ed1', bg: '#f9f0ff' },
    MANUFACTURING_COMPLETED: { label: 'SX xong', color: '#2f54eb', bg: '#f0f5ff' },
    PARTIAL_DELIVERY: { label: 'Giao một phần', color: '#eb2f96', bg: '#fff0f6' },
    DELIVERED: { label: 'Đã giao', color: '#52c41a', bg: '#f6ffed' },
    COMPLETED: { label: 'Hoàn thành', color: '#389e0d', bg: '#f6ffed' },
    CANCELLED: { label: 'Đã hủy', color: '#ff4d4f', bg: '#fff2f0' },
};

const TRACKING_STEPS = [
    { key: 'CREATED', label: 'Tạo đơn', icon: '📋' },
    { key: 'DEPOSITED', label: 'Đã cọc', icon: '💰' },
    { key: 'IN_PRODUCTION', label: 'Sản xuất', icon: '🏭' },
    { key: 'DELIVERED', label: 'Giao hàng', icon: '🚚' },
    { key: 'COMPLETED', label: 'Hoàn thành', icon: '✅' },
];

const getTrackingStep = (status: string): number => {
    const map: Record<string, number> = {
        QUOTATION: 0, SO_PENDING: 0,
        DEPOSITED: 1, SAMPLE_APPROVED: 2,
        IN_PRODUCTION: 2, PLANNED: 2,
        MANUFACTURING_COMPLETED: 3,
        PARTIAL_DELIVERY: 3, DELIVERED: 3,
        COMPLETED: 4,
        CANCELLED: -1,
    };
    return map[status] ?? 0;
};

const PortalDashboardPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reorderLoading, setReorderLoading] = useState<number | null>(null);
    const [reorderResult, setReorderResult] = useState<{ success: boolean; message: string } | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

    // ===== REORDER MODAL STATE =====
    const [reorderModalOrder, setReorderModalOrder] = useState<Order | null>(null);
    const [reorderItems, setReorderItems] = useState<Record<string, number>>({});
    const [reorderNote, setReorderNote] = useState('');
    const [allowLessQuantity, setAllowLessQuantity] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const token = sessionStorage.getItem('portal_token');

    // ===== PRODUCT STATS STATE =====
    const [productStats, setProductStats] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsFromDate, setStatsFromDate] = useState<string>('');
    const [statsToDate, setStatsToDate] = useState<string>('');

    const fetchProductStats = useCallback(async () => {
        if (!token) return;
        setStatsLoading(true);
        try {
            let url = `${API_URL}/public/portal/product-stats/${slug}`;
            const params = new URLSearchParams();
            if (statsFromDate) params.append('fromDate', statsFromDate);
            if (statsToDate) params.append('toDate', statsToDate);
            if (params.toString()) url += `?${params.toString()}`;
            
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProductStats(res.data.data || []);
        } catch (err: any) {
            console.error('Error fetching product stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, [slug, token, statsFromDate, statsToDate]);

    useEffect(() => {
        if (slug && token) {
            fetchProductStats();
        }
    }, [fetchProductStats, slug, token]);


    const getWatermarkProps = (fontColor: string, fontSize: number) => {
        if (data?.watermark_image) {
            return {
                image: data.watermark_image.startsWith('/uploads/') ? `${API_URL}/upload/files/${data.watermark_image.replace('/uploads/', '')}` : data.watermark_image,
                width: 140,
                height: 140,
                gap: [100, 100] as [number, number]
            };
        }
        return {
            content: "ERP4U",
            font: { color: fontColor, fontSize }
        };
    };

    const fetchDashboard = useCallback(async () => {
        if (!token) {
            navigate('/portal/login');
            return;
        }
        try {
            const res = await axios.get(`${API_URL}/public/portal/dashboard/${slug}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (err: any) {
            if (err.response?.status === 401) {
                sessionStorage.clear();
                navigate('/portal/login');
                return;
            }
            setError(err.response?.data?.message || 'Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [slug, token, navigate]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    const openReorderModal = (order: Order) => {
        setReorderModalOrder(order);
        const initialItems: Record<string, number> = {};
        order.items.forEach(item => {
            initialItems[item.sku] = item.quantity;
        });
        setReorderItems(initialItems);
        setReorderNote('');
        setAllowLessQuantity(false);
    };

    const submitReorder = async () => {
        if (!token || !reorderModalOrder) return;
        setReorderLoading(reorderModalOrder.id);
        setReorderResult(null);
        try {
            const items = Object.entries(reorderItems)
                .filter(([, qty]) => qty > 0)
                .map(([sku, qty]) => {
                    const item = reorderModalOrder.items.find(x => x.sku === sku);
                    return { sku, quantity: qty, unit_price: item?.unit_price || 0 };
                });
            
            if (items.length === 0) {
                setReorderResult({ success: false, message: 'Vui lòng chọn ít nhất 1 sản phẩm' });
                return;
            }

            if (allowLessQuantity && reorderNote.trim() === '') {
                setReorderResult({ success: false, message: 'Vui lòng điền ghi chú khi đặt số lượng ít hơn' });
                return;
            }

            const res = await axios.post(
                `${API_URL}/public/portal/reorder/${slug}`,
                { 
                    order_id: reorderModalOrder.id,
                    items,
                    note: reorderNote 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setReorderResult({ success: true, message: res.data.message || 'Đã tạo báo giá mới!' });
            setReorderModalOrder(null);
            fetchDashboard();
        } catch (err: any) {
            setReorderResult({ success: false, message: err.response?.data?.message || 'Lỗi đặt hàng lại' });
        } finally {
            setReorderLoading(null);
        }
    };

    const handleLogout = () => {
        sessionStorage.clear();
        navigate('/portal/login');
    };

    const fmt = (n: number) => Number(n).toLocaleString('vi-VN');

    // ===== PROMOTION MODAL STATE =====
    const [promoModal, setPromoModal] = useState<{ promo: PromotionInfo; products: PromotionProduct[] } | null>(null);
    const [promoLoading, setPromoLoading] = useState(false);
    const [promoCart, setPromoCart] = useState<Record<string, number>>({});
    const [promoOrderLoading, setPromoOrderLoading] = useState(false);
    const [promoError, setPromoError] = useState('');

    const openPromoModal = async (promo: PromotionInfo) => {
        if (!token) return;
        setPromoLoading(true);
        try {
            const res = await axios.get(`${API_URL}/public/portal/promotion/${slug}/${promo.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPromoModal({ promo: res.data.promotion, products: res.data.products });
            setPromoCart({});
            setPromoError('');
        } catch (err: any) {
            setReorderResult({ success: false, message: err.response?.data?.message || 'Lỗi tải khuyến mãi' });
        } finally {
            setPromoLoading(false);
        }
    };

    const updatePromoQty = (sku: string, qty: number) => {
        setPromoCart(prev => {
            const next = { ...prev };
            if (qty <= 0) delete next[sku];
            else next[sku] = qty;
            return next;
        });
    };

    const promoCartTotal = promoModal ? Object.entries(promoCart).reduce((sum, [sku, qty]) => {
        const p = promoModal.products.find(x => x.sku === sku);
        return sum + (p ? p.base_price * qty : 0);
    }, 0) : 0;

    const promoDiscount = promoModal ? (
        promoModal.promo.discount_type === 'PERCENTAGE'
            ? promoCartTotal * Number(promoModal.promo.discount_value) / 100
            : Number(promoModal.promo.discount_value)
    ) : 0;

    const handlePromoOrder = async () => {
        if (!token || !promoModal) return;
        const items = Object.entries(promoCart)
            .filter(([, qty]) => qty > 0)
            .map(([sku, qty]) => {
                const p = promoModal.products.find(x => x.sku === sku);
                return { sku, quantity: qty, unit_price: p?.base_price || 0 };
            });
        if (items.length === 0) return;

        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

        if (promoModal.promo.min_quantity && totalQty < promoModal.promo.min_quantity) {
             setPromoError(`Vui lòng chọn ít nhất ${promoModal.promo.min_quantity} sản phẩm để áp dụng ưu đãi này.`);
             return;
        }

        if (promoModal.promo.min_order_value && totalValue < promoModal.promo.min_order_value) {
             setPromoError(`Giá trị đơn hàng tối thiểu để áp dụng ưu đãi là ${fmt(promoModal.promo.min_order_value)}đ.`);
             return;
        }

        setPromoError('');
        setPromoOrderLoading(true);
        try {
            const res = await axios.post(
                `${API_URL}/public/portal/promotion/${slug}/${promoModal.promo.id}/order`,
                { items },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setReorderResult({ success: true, message: res.data.message || 'Đã tạo báo giá!' });
            setPromoModal(null);
            fetchDashboard();
        } catch (err: any) {
            setReorderResult({ success: false, message: err.response?.data?.message || 'Lỗi đặt hàng' });
        } finally {
            setPromoOrderLoading(false);
        }
    };

    if (loading) return (
        <div style={{ ...S.wrapper, justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: 'spin 1s linear infinite' }}>⏳</div>
                <div style={{ color: '#666', fontSize: 15 }}>Đang tải dữ liệu...</div>
            </div>
        </div>
    );

    if (error || !data) return (
        <div style={{ ...S.wrapper, justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <h2 style={{ color: '#333', marginBottom: 8 }}>Không thể truy cập</h2>
                <p style={{ color: '#888', marginBottom: 24 }}>{error || 'Phiên đăng nhập không hợp lệ'}</p>
                <button onClick={() => navigate('/portal/login')} style={S.primaryBtn}>
                    Đăng nhập lại
                </button>
            </div>
        </div>
    );

    const { customer, stats, orders, promotions } = data;

    if (isCustomizerOpen && slug && token) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', overflowY: 'auto' }}>
                <PortalB2BCustomizer slug={slug} token={token} onClose={() => {
                    setIsCustomizerOpen(false);
                    fetchDashboard();
                }} />
            </div>
        );
    }

    return (
        <div style={S.wrapper}>
            {/* ===== HEADER ===== */}
            <header style={S.header}>
                <div style={S.headerInner}>
                    <a href="https://demo.erp4u.local" target="_blank" rel="noopener noreferrer" style={S.headerLogo}>
                        <img src="/logo-erp4u.png" alt="ERP4U" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
                        {!isMobile && <span style={{ fontSize: 12, color: '#aaa', marginLeft: 10 }}>Cổng Đối Tác</span>}
                    </a>
                    <div style={S.headerRight}>
                        <span style={{ fontSize: 14, color: '#555' }}>
                            Xin chào, <strong style={{ color: '#23A7D3' }}>{customer.name}</strong>
                        </span>
                        <button onClick={handleLogout} style={S.logoutBtn}>Đăng xuất</button>
                    </div>
                </div>
            </header>

            <main style={S.main}>
                {/* ===== HERO SECTION ===== */}
                <section style={S.heroSection}>
                    <div style={S.heroOverlay} />
                    <div style={S.heroContent}>
                        <h1 style={S.heroTitle}>CỔNG ĐỐI TÁC ĐỘC QUYỀN</h1>
                        <p style={S.heroDesc}>
                            Chào mừng <strong>{customer.name}</strong> — Quản lý đơn hàng, đặt hàng nhanh và nhận ưu đãi đối tác.
                        </p>
                        <button
                            onClick={() => setIsCustomizerOpen(true)}
                            style={{ padding: '12px 24px', background: '#fff', color: '#23A7D3', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '16px', display: 'inline-block' }}
                        >
                            🎨 Tự Thiết Kế Sản Phẩm
                        </button>
                        {promotions.length > 0 && (
                            <div style={S.heroBadge}>
                                🎁 {promotions.length} chương trình khuyến mãi đang áp dụng cho bạn
                            </div>
                        )}
                    </div>
                </section>

                {/* ===== STATS CARDS ===== */}
                <section style={S.statsSection}>
                    <div style={S.statsGrid}>
                        <div style={{ ...S.statCard, borderLeftColor: '#23A7D3' }}>
                            <div style={S.statIcon}>📦</div>
                            <div>
                                <div style={S.statValue}>{stats.total_orders}</div>
                                <div style={S.statLabel}>Tổng đơn hàng</div>
                            </div>
                        </div>
                        <div style={{ ...S.statCard, borderLeftColor: '#52c41a' }}>
                            <div style={S.statIcon}>💰</div>
                            <div>
                                <div style={S.statValue}>{fmt(stats.total_revenue)}đ</div>
                                <div style={S.statLabel}>Đã mua</div>
                            </div>
                        </div>
                        <div style={{ ...S.statCard, borderLeftColor: '#fa8c16' }}>
                            <div style={S.statIcon}>🔄</div>
                            <div>
                                <div style={S.statValue}>{stats.active_orders}</div>
                                <div style={S.statLabel}>Đơn đang xử lý</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===== PROMOTIONS ===== */}
                {promotions.length > 0 && (
                    <section style={S.section}>
                        <h2 style={S.sectionTitle}>🎁 Ưu Đãi Dành Cho Bạn</h2>
                        <div style={S.promoGrid}>
                            {promotions.map(p => (
                                <div key={p.id} style={S.promoCard}>
                                    <div style={S.promoHeader}>
                                        <span style={S.promoBadge}>
                                            {p.discount_type === 'PERCENTAGE' ? `Giảm ${p.discount_value}%` :
                                                p.discount_type === 'FIXED_AMOUNT' ? `Giảm ${fmt(p.discount_value)}đ` : p.discount_type}
                                        </span>
                                    </div>
                                    <h3 style={S.promoName}>{p.name}</h3>
                                    {p.description && <p style={S.promoDesc}>{p.description}</p>}
                                    <div style={S.promoDate}>
                                        📅 {new Date(p.start_date).toLocaleDateString('vi-VN')} - {new Date(p.end_date).toLocaleDateString('vi-VN')}
                                    </div>
                                    {(p.discount_type === 'PERCENTAGE' || p.discount_type === 'FIXED_AMOUNT') && (
                                        <button
                                            onClick={() => openPromoModal(p)}
                                            disabled={promoLoading}
                                            style={{ ...S.reorderBtn, marginTop: 12, width: '100%', padding: '10px 0', fontSize: 13 }}
                                        >
                                            {promoLoading ? '⏳ Đang tải...' : '🛒 Xem & Đặt hàng'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ===== RESULT MESSAGE ===== */}
                {reorderResult && (
                    <div style={{
                        ...S.resultBox,
                        background: reorderResult.success ? '#f6ffed' : '#fff2f0',
                        borderColor: reorderResult.success ? '#b7eb8f' : '#ffccc7',
                        color: reorderResult.success ? '#389e0d' : '#cf1322',
                    }}>
                        {reorderResult.success ? '✅' : '❌'} {reorderResult.message}
                        <button onClick={() => setReorderResult(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </div>
                )}

                {/* ===== PRODUCT STATS (KHO HÀNG) ===== */}
                <section style={S.section}>
                    <h2 style={S.sectionTitle}>📦 Sản Phẩm Đã Mua (Thống kê)</h2>
                    <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                            type="date"
                            value={statsFromDate}
                            onChange={(e) => setStatsFromDate(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14 }}
                        />
                        <span style={{ alignSelf: 'center' }}>-</span>
                        <input
                            type="date"
                            value={statsToDate}
                            onChange={(e) => setStatsToDate(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14 }}
                        />
                        <button
                            onClick={fetchProductStats}
                            disabled={statsLoading}
                            style={{ ...S.primaryBtn, padding: '8px 16px', height: 'auto', minHeight: 38 }}
                        >
                            {statsLoading ? '⏳...' : '🔍 Tra cứu'}
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                        <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                            <thead>
                                <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                                    <th style={{ padding: '12px 16px', color: '#888', fontWeight: 600 }}>Sản phẩm</th>
                                    <th style={{ padding: '12px 16px', color: '#888', fontWeight: 600 }}>Tên Sản Phẩm</th>
                                    <th style={{ padding: '12px 16px', color: '#888', fontWeight: 600, textAlign: 'right' }}>Số lượng</th>
                                    <th style={{ padding: '12px 16px', color: '#888', fontWeight: 600, textAlign: 'right' }}>Tổng tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>
                                            Không có dữ liệu trong thời gian này
                                        </td>
                                    </tr>
                                ) : (
                                    productStats.map(stat => (
                                        <tr key={stat.sku} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#555' }}>
                                                {stat.image_url ? (
                                                    <Watermark {...getWatermarkProps('rgba(0,0,0,0.15)', 10)}>
                                                        <img 
                                                            src={getGoogleDriveImageUrl(stat.image_url || '') || undefined} 
                                                            alt={stat.name || ''} 
                                                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in', display: 'block' }} 
                                                            onClick={() => {
                                                                setPreviewImage(getGoogleDriveImageUrl(stat.image_url || '', 'w1000') || stat.image_url || '');
                                                                setPreviewVisible(true);
                                                            }}
                                                        />
                                                    </Watermark>
                                                ) : (
                                                    <div style={{ width: 48, height: 48, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#ccc' }}>📦</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#333' }}>
                                                <div style={{ fontWeight: 600 }}>{stat.name}</div>
                                                <div style={{ fontSize: 12, color: '#888' }}>SKU: {stat.sku}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#23A7D3' }}>
                                                {fmt(stat.total_quantity)} <span style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>{stat.unit}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmt(stat.total_value)}đ</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ===== ORDER HISTORY ===== */}
                <section style={S.section}>
                    <h2 style={S.sectionTitle}>📋 Lịch Sử Đơn Hàng</h2>

                    {orders.length === 0 ? (
                        <div style={S.emptyState}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                            <p style={{ color: '#888' }}>Chưa có đơn hàng nào</p>
                        </div>
                    ) : (
                        <div style={S.orderList}>
                            {orders.map(order => {
                                const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#666', bg: '#f5f5f5' };
                                const trackingStep = getTrackingStep(order.status);

                                return (
                                    <div key={order.id} style={S.orderCard}>
                                        {/* Order Header */}
                                        <div style={S.orderHeader}>
                                            <div>
                                                <span style={S.orderCode}>{order.order_code}</span>
                                                <span style={{
                                                    ...S.statusTag,
                                                    color: statusInfo.color,
                                                    background: statusInfo.bg,
                                                    border: `1px solid ${statusInfo.color}22`,
                                                }}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <div style={S.orderDate}>
                                                {new Date(order.order_date).toLocaleDateString('vi-VN')}
                                            </div>
                                        </div>

                                        {/* Order Items Full List */}
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left', marginBottom: 16 }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid #eee', color: '#888' }}>
                                                        <th style={{ padding: '8px 16px', fontWeight: 600 }}>Sản phẩm</th>
                                                        <th style={{ padding: '8px 16px', fontWeight: 600, textAlign: 'right' }}>Đơn giá</th>
                                                        <th style={{ padding: '8px 16px', fontWeight: 600, textAlign: 'right' }}>SL</th>
                                                        <th style={{ padding: '8px 16px', fontWeight: 600, textAlign: 'right' }}>Thành tiền</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                            <td style={{ padding: '8px 16px', color: '#333', fontWeight: 500 }}>
                                                                <div>{item.product_name}</div>
                                                                <div style={{ fontSize: 11, color: '#888' }}>SKU: {item.sku}</div>
                                                            </td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#666' }}>{fmt(item.unit_price)}đ</td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#23A7D3', fontWeight: 600 }}>x{item.quantity}</td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#333' }}>{fmt(item.subtotal)}đ</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Delivery & Payment Info */}
                                        <div style={{ padding: '12px 16px', background: '#fafafa', borderTop: '1px solid #eee', fontSize: 13, color: '#555', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                            <div style={{ flex: '1 1 200px' }}>
                                                <div style={{ fontWeight: 600, color: '#333', marginBottom: 4 }}>🚚 Giao hàng</div>
                                                {order.receiver_name ? (
                                                    <>
                                                        <div>Người nhận: {order.receiver_name} {order.receiver_phone ? `- ${order.receiver_phone}` : ''}</div>
                                                        <div>Địa chỉ: {order.shipping_address || 'Chưa cập nhật'}</div>
                                                        {order.shipping_carrier && <div>Đơn vị: {order.shipping_carrier} {order.tracking_code ? `(Mã VĐ: ${order.tracking_code})` : ''}</div>}
                                                    </>
                                                ) : (
                                                    <div style={{ color: '#999', fontStyle: 'italic' }}>Chưa có thông tin giao hàng</div>
                                                )}
                                            </div>
                                            <div style={{ flex: '1 1 200px' }}>
                                                <div style={{ fontWeight: 600, color: '#333', marginBottom: 4 }}>💳 Thanh toán</div>
                                                <div>Trạng thái: <span style={{ color: order.payment_status === 'PAID' ? 'green' : order.payment_status === 'PARTIAL_PAID' ? '#fa8c16' : 'red' }}>
                                                    {order.payment_status === 'PAID' ? 'Đã thanh toán' : order.payment_status === 'PARTIAL_PAID' ? 'Thanh toán một phần' : 'Chưa thanh toán'}
                                                </span></div>
                                                {order.payment_note && <div>Ghi chú: {order.payment_note}</div>}
                                                {(order.discount_amount || 0) > 0 && <div>Giảm giá: -{fmt(order.discount_amount || 0)}đ</div>}
                                            </div>
                                        </div>

                                        {/* Order Footer */}
                                        <div style={S.orderFooter}>
                                            <div>
                                                <span style={S.totalLabel}>Tổng:</span>
                                                <span style={S.totalValue}>{fmt(order.total_amount)}đ</span>
                                                {order.paid_amount > 0 && (
                                                    <span style={S.paidBadge}>Đã thanh toán: {fmt(order.paid_amount)}đ</span>
                                                )}
                                            </div>
                                            <div style={S.orderActions}>
                                                <button
                                                    onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                                                    style={S.outlineBtn}
                                                >
                                                    {selectedOrder?.id === order.id ? 'Ẩn' : '👁 Theo dõi'}
                                                </button>
                                                <a
                                                    href={`/portal/quote/${order.uuid}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ ...S.outlineBtn, textDecoration: 'none' }}
                                                >
                                                    📄 Xem báo giá
                                                </a>
                                                {order.status !== 'CANCELLED' && (
                                                    <button
                                                        onClick={() => openReorderModal(order)}
                                                        disabled={reorderLoading === order.id}
                                                        style={{
                                                            ...S.reorderBtn,
                                                            opacity: reorderLoading === order.id ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {reorderLoading === order.id ? '⏳...' : '🔁 Đặt lại'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Tracking Timeline (expandable) */}
                                        {selectedOrder?.id === order.id && order.status !== 'CANCELLED' && (
                                            <div style={S.trackingSection}>
                                                <div style={S.trackingTitle}>📍 Theo dõi đơn hàng</div>
                                                <div style={S.trackingTimeline}>
                                                    {TRACKING_STEPS.map((step, idx) => {
                                                        const isActive = idx <= trackingStep;
                                                        const isCurrent = idx === trackingStep;
                                                        return (
                                                            <div key={step.key} style={S.trackingStep}>
                                                                <div style={{
                                                                    ...S.trackingDot,
                                                                    background: isActive ? '#23A7D3' : '#e0e0e0',
                                                                    transform: isCurrent ? 'scale(1.3)' : 'scale(1)',
                                                                    boxShadow: isCurrent ? '0 0 0 4px rgba(35,167,211,0.2)' : 'none',
                                                                }}>
                                                                    <span style={{ fontSize: 14 }}>{step.icon}</span>
                                                                </div>
                                                                {idx < TRACKING_STEPS.length - 1 && (
                                                                    <div style={{
                                                                        ...S.trackingLine,
                                                                        background: idx < trackingStep ? '#23A7D3' : '#e0e0e0',
                                                                    }} />
                                                                )}
                                                                <div style={{
                                                                    ...S.trackingLabel,
                                                                    color: isActive ? '#23A7D3' : '#aaa',
                                                                    fontWeight: isCurrent ? 700 : 400,
                                                                }}>
                                                                    {step.label}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ===== USER GUIDE ===== */}
                <PortalUserGuide />

                {/* ===== B2B SUPPORT ===== */}
                <section style={S.section}>
                    <div style={S.supportCard}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 8 }}>Hỗ Trợ B2B</h3>
                        <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
                            Cần hỗ trợ về đơn hàng, báo giá hoặc sản phẩm? Liên hệ đội ngũ Sales ngay.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <a href="tel:0983882210" style={{ ...S.supportBtn, background: '#23A7D3', color: '#fff' }}>
                                📞 Hotline
                            </a>
                            <a href="mailto:phamhang.erp4u@gmail.com" style={{ ...S.supportBtn, background: '#fff', color: '#23A7D3', border: '1px solid #23A7D3' }}>
                                ✉️ Email
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            {/* ===== PROMOTION DETAIL MODAL ===== */}
            {promoModal && (
                <div style={S.modalOverlay} onClick={() => setPromoModal(null)}>
                    <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div style={S.modalHeader}>
                            <div>
                                <span style={{ ...S.promoBadge, fontSize: 11, marginRight: 8 }}>
                                    {promoModal.promo.discount_type === 'PERCENTAGE'
                                        ? `Giảm ${promoModal.promo.discount_value}%`
                                        : `Giảm ${fmt(promoModal.promo.discount_value)}đ`}
                                </span>
                                <span style={{ fontSize: 11, color: '#999' }}>
                                    📅 {new Date(promoModal.promo.start_date).toLocaleDateString('vi-VN')} - {new Date(promoModal.promo.end_date).toLocaleDateString('vi-VN')}
                                </span>
                            </div>
                            <button onClick={() => setPromoModal(null)} style={S.modalClose}>✕</button>
                        </div>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>🎁 {promoModal.promo.name}</h2>
                        {promoModal.promo.description && (
                            <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px', lineHeight: 1.5 }}>{promoModal.promo.description}</p>
                        )}

                        {/* Product List */}
                        {promoModal.products.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa' }}>
                                <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                                <p>Chương trình này chưa có sản phẩm cụ thể.<br />Vui lòng liên hệ Sales để biết thêm chi tiết.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8 }}>Chọn sản phẩm ({promoModal.products.length})</div>
                                <div style={S.productList}>
                                    {promoModal.products.map(p => {
                                        const qty = promoCart[p.sku] || 0;
                                        return (
                                            <div key={p.sku} style={{ ...S.productRow, alignItems: 'flex-start' }}>
                                                <div style={{ width: 60, height: 60, marginRight: 12, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
                                                    {p.image_url ? (
                                                        <Watermark {...getWatermarkProps('rgba(0,0,0,0.15)', 12)}>
                                                            <img src={getGoogleDriveImageUrl(p.image_url) || p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                        </Watermark>
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 10 }}>No Img</div>
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{p.name}</span>
                                                        {p.product_type === 'COMBO' && <span style={{ fontSize: 10, background: '#e6f7ff', color: '#1890ff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>COMBO</span>}
                                                    </div>
                                                    {p.customer_description ? (
                                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4, whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                                                            {p.customer_description.split('\n').map((line, idx) => {
                                                                const comboMatch = line.match(/^•\s*(.*?)\s*\(x([\d\.]+)\)(?:\s*-\s*(.*))?$/);
                                                                if (comboMatch) {
                                                                    return <div key={idx}><span style={{fontWeight: 600}}>*** {comboMatch[1]} {Number(comboMatch[2]) > 1 ? `(x${comboMatch[2]})` : ''}</span>{comboMatch[3] ? <span style={{color: '#888', fontStyle: 'italic'}}><br/>. {comboMatch[3]}</span> : ''}</div>
                                                                }
                                                                if (!line.trim()) return null;
                                                                return <div key={idx}>. <span style={{fontStyle: 'italic'}}>{line.replace(/^[•-]\s*/, '')}</span></div>
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', marginBottom: 4 }}>Chưa có mô tả chi tiết</div>
                                                    )}
                                                    <div style={{ fontSize: 11, color: '#aaa' }}><span style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 2 }}>{p.sku}</span> • {p.unit || 'Cái'}</div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#23A7D3', marginTop: 2 }}>{fmt(p.base_price)}đ</div>
                                                </div>
                                                <div style={S.qtyControl}>
                                                    <button onClick={() => updatePromoQty(p.sku, qty - 1)} style={S.qtyBtn} disabled={qty <= 0}>−</button>
                                                    <input
                                                        type="number"
                                                        value={qty}
                                                        onChange={e => updatePromoQty(p.sku, Math.max(0, parseInt(e.target.value) || 0))}
                                                        style={S.qtyInput}
                                                        min={0}
                                                    />
                                                    <button onClick={() => updatePromoQty(p.sku, qty + 1)} style={S.qtyBtn}>+</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Summary */}
                                {Object.keys(promoCart).length > 0 && (
                                    <div style={S.promoSummary}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ color: '#888' }}>Tạm tính:</span>
                                            <span style={{ fontWeight: 600 }}>{fmt(promoCartTotal)}đ</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ color: '#fa8c16' }}>Giảm giá:</span>
                                            <span style={{ fontWeight: 700, color: '#fa8c16' }}>-{fmt(promoDiscount)}đ</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: 8, marginTop: 4 }}>
                                            <span style={{ fontWeight: 700, fontSize: 15 }}>Ước tính:</span>
                                            <span style={{ fontWeight: 800, fontSize: 16, color: '#23A7D3' }}>{fmt(Math.max(0, promoCartTotal - promoDiscount))}đ</span>
                                        </div>
                                    </div>
                                )}

                                {promoError && (
                                    <div style={{ color: '#cf1322', background: '#fff2f0', border: '1px solid #ffccc7', padding: '8px 12px', borderRadius: 6, marginTop: 12, fontSize: 13 }}>
                                        ❌ {promoError}
                                    </div>
                                )}

                                <button
                                    onClick={handlePromoOrder}
                                    disabled={promoOrderLoading || Object.keys(promoCart).length === 0}
                                    style={{
                                        ...S.primaryBtn,
                                        width: '100%',
                                        marginTop: 12,
                                        opacity: (promoOrderLoading || Object.keys(promoCart).length === 0) ? 0.5 : 1,
                                    }}
                                >
                                    {promoOrderLoading ? '⏳ Đang xử lý...' : '🛒 Tạo Báo Giá Từ Ưu Đãi'}
                                </button>
                                <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 8 }}>
                                    Báo giá sẽ được đội Sales xác nhận trước khi chốt đơn.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ===== REORDER MODAL ===== */}
            {reorderModalOrder && (
                <div style={S.modalOverlay} onClick={() => setReorderModalOrder(null)}>
                    <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                        <div style={S.modalHeader}>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                                🔁 Đặt lại đơn {reorderModalOrder.order_code}
                            </h2>
                            <button onClick={() => setReorderModalOrder(null)} style={S.modalClose}>✕</button>
                        </div>
                        <p style={{ fontSize: 13, color: '#888', margin: '8px 0 16px', lineHeight: 1.5 }}>Điều chỉnh số lượng sản phẩm bạn muốn đặt lại và thêm ghi chú nếu cần.</p>
                        
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#333', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={allowLessQuantity}
                                    onChange={e => {
                                        setAllowLessQuantity(e.target.checked);
                                        if (!e.target.checked) {
                                            const resetItems = { ...reorderItems };
                                            reorderModalOrder.items.forEach(item => {
                                                if ((resetItems[item.sku] || 0) < item.quantity) {
                                                    resetItems[item.sku] = item.quantity;
                                                }
                                            });
                                            setReorderItems(resetItems);
                                        }
                                    }}
                                    style={{ marginRight: 8 }}
                                />
                                Cho phép đặt số lượng ít hơn đơn cũ (Bắt buộc điền ghi chú)
                            </label>
                        </div>

                        <div style={S.productList}>
                            {reorderModalOrder.items.map(p => {
                                const qty = reorderItems[p.sku] || 0;
                                const minQty = allowLessQuantity ? 0 : p.quantity;
                                return (
                                    <div key={p.sku} style={{ ...S.productRow, alignItems: 'flex-start' }}>
                                        <div style={{ width: 60, height: 60, marginRight: 12, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
                                            {p.image_url ? (
                                                <Watermark {...getWatermarkProps('rgba(0,0,0,0.15)', 12)}>
                                                    <img src={getGoogleDriveImageUrl(p.image_url) || p.image_url} alt={p.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                </Watermark>
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 10 }}>No Img</div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{p.product_name}</span>
                                                {p.product_type === 'COMBO' && <span style={{ fontSize: 10, background: '#e6f7ff', color: '#1890ff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>COMBO</span>}
                                            </div>
                                            {p.vat_content && <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 4 }}>VAT: {p.vat_content}</div>}
                                            {p.customer_description ? (
                                                <div style={{ fontSize: 12, color: '#666', marginBottom: 4, whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                                                    {p.customer_description.split('\n').map((line, idx) => {
                                                        const comboMatch = line.match(/^•\s*(.*?)\s*\(x([\d\.]+)\)(?:\s*-\s*(.*))?$/);
                                                        if (comboMatch) {
                                                            return <div key={idx}><span style={{fontWeight: 600}}>*** {comboMatch[1]} {Number(comboMatch[2]) > 1 ? `(x${comboMatch[2]})` : ''}</span>{comboMatch[3] ? <span style={{color: '#888', fontStyle: 'italic'}}><br/>. {comboMatch[3]}</span> : ''}</div>
                                                        }
                                                        if (!line.trim()) return null;
                                                        return <div key={idx}>. <span style={{fontStyle: 'italic'}}>{line.replace(/^[•-]\s*/, '')}</span></div>
                                                    })}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', marginBottom: 4 }}>Chưa có mô tả chi tiết</div>
                                            )}
                                            <div style={{ fontSize: 11, color: '#aaa' }}><span style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 2 }}>{p.sku}</span> <span style={{ color: '#888' }}>(Đơn cũ: {p.quantity})</span></div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#23A7D3', marginTop: 2 }}>{fmt(p.unit_price)}đ</div>
                                        </div>
                                        <div style={S.qtyControl}>
                                            <button onClick={() => setReorderItems(prev => ({ ...prev, [p.sku]: Math.max(minQty, qty - 1) }))} style={S.qtyBtn} disabled={qty <= minQty}>−</button>
                                            <input
                                                type="number"
                                                value={qty}
                                                onChange={e => setReorderItems(prev => ({ ...prev, [p.sku]: Math.max(minQty, parseInt(e.target.value) || 0) }))}
                                                style={S.qtyInput}
                                                min={minQty}
                                            />
                                            <button onClick={() => setReorderItems(prev => ({ ...prev, [p.sku]: qty + 1 }))} style={S.qtyBtn}>+</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div style={{ marginTop: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
                                Ghi chú cho đơn hàng {allowLessQuantity && <span style={{ color: '#ff4d4f' }}>(*)</span>}
                            </label>
                            <textarea 
                                value={reorderNote}
                                onChange={e => setReorderNote(e.target.value)}
                                placeholder="Ví dụ: Đổi màu xám, cần giao gấp..."
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    resize: 'none',
                                    outline: 'none',
                                    height: 80,
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <button
                            onClick={submitReorder}
                            disabled={reorderLoading === reorderModalOrder.id || Object.values(reorderItems).every(q => q === 0)}
                            style={{
                                ...S.primaryBtn,
                                width: '100%',
                                marginTop: 16,
                                opacity: (reorderLoading === reorderModalOrder.id || Object.values(reorderItems).every(q => q === 0)) ? 0.5 : 1,
                            }}
                        >
                            {reorderLoading === reorderModalOrder.id ? '⏳ Đang xử lý...' : '🛒 Gửi Yêu Cầu Đặt Lại'}
                        </button>
                    </div>
                </div>
            )}

            {/* ===== FOOTER ===== */}
            <footer style={S.footer}>
                <p>© 2024 ERP4U — Nệm Mầm Non | Cổng Đối Tác B2B</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>
                    <a href="https://demo.erp4u.local" style={{ color: '#23A7D3', textDecoration: 'none' }}>demo.erp4u.local</a>
                    {' '} | localhost:3000
                </p>
            </footer>

            {/* Image Preview Modal */}
            <Modal
                open={previewVisible}
                footer={null}
                onCancel={() => setPreviewVisible(false)}
                centered
                closable={false}
                width="auto"
                styles={{
                    body: { padding: 0, textAlign: 'center', background: 'transparent' },
                    content: { background: 'transparent', boxShadow: 'none' }
                }}
            >
                {previewImage && (
                    <Watermark {...getWatermarkProps('rgba(0,0,0,0.15)', 24)}>
                        <img 
                            src={previewImage} 
                            alt="Zoomed Product" 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '70vh', 
                                objectFit: 'contain', 
                                borderRadius: 8,
                                cursor: 'zoom-out',
                                display: 'block',
                                margin: '0 auto'
                            }} 
                            onClick={() => setPreviewVisible(false)}
                        />
                    </Watermark>
                )}
            </Modal>
        </div>
    );
};

// ============================================================
// STYLES
// ============================================================
const S: Record<string, React.CSSProperties> = {
    wrapper: {
        minHeight: '100vh',
        background: '#f4f7fa',
        fontFamily: "'Be Vietnam Pro', 'Inter', -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
    },
    // Header
    header: {
        background: '#fff',
        borderBottom: '1px solid #eee',
        position: 'sticky' as const,
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    },
    headerInner: {
        maxWidth: 1100,
        margin: '0 auto',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLogo: {
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
    },
    logoutBtn: {
        padding: '6px 16px',
        background: 'transparent',
        border: '1px solid #ddd',
        borderRadius: 20,
        fontSize: 12,
        color: '#888',
        cursor: 'pointer',
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    // Main
    main: {
        maxWidth: 1100,
        margin: '0 auto',
        padding: '0 20px 40px',
        width: '100%',
        flex: 1,
    },
    // Hero
    heroSection: {
        background: 'url("/banner-bg.jpg") center/cover no-repeat',
        borderRadius: '0 0 24px 24px',
        padding: '48px 32px',
        textAlign: 'center' as const,
        position: 'relative' as const,
        overflow: 'hidden',
        marginBottom: 24,
    },
    heroOverlay: {
        position: 'absolute' as const,
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
    },
    heroContent: {
        position: 'relative' as const,
        zIndex: 1,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: 900,
        color: '#fff',
        letterSpacing: 3,
        margin: '0 0 12px',
        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
    },
    heroDesc: {
        fontSize: 15,
        color: '#fff',
        maxWidth: 500,
        margin: '0 auto 16px',
        lineHeight: 1.6,
        textShadow: '0 1px 4px rgba(0,0,0,0.3)',
    },
    heroBadge: {
        display: 'inline-block',
        padding: '8px 20px',
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        borderRadius: 50,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        border: '1px solid rgba(255,255,255,0.2)',
    },
    // Stats
    statsSection: {
        marginBottom: 24,
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
    },
    statCard: {
        background: '#fff',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        borderLeft: '4px solid',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    },
    statIcon: { fontSize: 32 },
    statValue: { fontSize: 22, fontWeight: 800, color: '#1a1a1a' },
    statLabel: { fontSize: 13, color: '#888', marginTop: 2 },
    // Sections
    section: { marginBottom: 32 },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 800,
        color: '#1a1a1a',
        marginBottom: 16,
    },
    // Promotions
    promoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
    },
    promoCard: {
        background: 'linear-gradient(135deg, #fffbf0 0%, #fff7e8 100%)',
        borderRadius: 16,
        padding: 20,
        border: '1px solid #ffe4a0',
        boxShadow: '0 2px 8px rgba(250,140,22,0.08)',
    },
    promoHeader: { marginBottom: 10 },
    promoBadge: {
        display: 'inline-block',
        padding: '4px 14px',
        background: 'linear-gradient(135deg, #fa8c16, #ffa940)',
        color: '#fff',
        borderRadius: 50,
        fontSize: 12,
        fontWeight: 700,
    },
    promoName: { fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 4 },
    promoDesc: { fontSize: 13, color: '#888', marginBottom: 8, lineHeight: 1.5 },
    promoDate: { fontSize: 12, color: '#aaa' },
    // Orders
    orderList: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
    orderCard: {
        background: '#fff',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        border: '1px solid #f0f0f0',
        transition: 'box-shadow 0.2s',
    },
    orderHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexWrap: 'wrap' as const,
        gap: 8,
    },
    orderCode: {
        fontSize: 16,
        fontWeight: 800,
        color: '#23A7D3',
        marginRight: 10,
    },
    statusTag: {
        display: 'inline-block',
        padding: '3px 12px',
        borderRadius: 50,
        fontSize: 11,
        fontWeight: 700,
    },
    orderDate: { fontSize: 13, color: '#aaa' },
    orderItems: {
        borderTop: '1px solid #f5f5f5',
        borderBottom: '1px solid #f5f5f5',
        padding: '10px 0',
        marginBottom: 12,
    },
    orderItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        gap: 8,
    },
    itemName: { flex: 1, fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    itemQty: { fontSize: 12, color: '#999', minWidth: 30, textAlign: 'center' as const },
    itemPrice: { fontSize: 13, fontWeight: 600, color: '#333', minWidth: 80, textAlign: 'right' as const },
    orderFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: 12,
    },
    totalLabel: { fontSize: 14, color: '#888', marginRight: 6 },
    totalValue: { fontSize: 18, fontWeight: 800, color: '#23A7D3' },
    paidBadge: {
        display: 'inline-block',
        marginLeft: 10,
        padding: '2px 10px',
        background: '#f6ffed',
        color: '#52c41a',
        borderRadius: 50,
        fontSize: 11,
        fontWeight: 600,
    },
    orderActions: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap' as const,
    },
    outlineBtn: {
        padding: '6px 14px',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 20,
        fontSize: 12,
        color: '#555',
        cursor: 'pointer',
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
    },
    reorderBtn: {
        padding: '6px 14px',
        background: 'linear-gradient(135deg, #23A7D3, #1e8fb5)',
        border: 'none',
        borderRadius: 20,
        fontSize: 12,
        color: '#fff',
        cursor: 'pointer',
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontWeight: 700,
    },
    // Tracking
    trackingSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px dashed #eee',
    },
    trackingTitle: {
        fontSize: 14,
        fontWeight: 700,
        color: '#333',
        marginBottom: 16,
    },
    trackingTimeline: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    trackingStep: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        flex: 1,
        position: 'relative' as const,
    },
    trackingDot: {
        width: 36,
        height: 36,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s',
        marginBottom: 6,
    },
    trackingLine: {
        position: 'absolute' as const,
        top: 18,
        left: '50%',
        width: '100%',
        height: 3,
        borderRadius: 2,
        zIndex: 0,
    },
    trackingLabel: {
        fontSize: 11,
        textAlign: 'center' as const,
        transition: 'color 0.3s',
    },
    // Support
    supportCard: {
        background: 'linear-gradient(135deg, #f0faff 0%, #e8f7fc 100%)',
        borderRadius: 20,
        padding: '32px 24px',
        textAlign: 'center' as const,
        border: '1px solid rgba(35,167,211,0.15)',
    },
    supportBtn: {
        padding: '10px 24px',
        borderRadius: 50,
        fontSize: 13,
        fontWeight: 700,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.2s',
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    // Empty & result
    emptyState: { textAlign: 'center' as const, padding: '48px 20px' },
    resultBox: {
        padding: '12px 20px',
        borderRadius: 12,
        border: '1px solid',
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtn: {
        padding: '12px 28px',
        background: 'linear-gradient(135deg, #23A7D3, #1e8fb5)',
        color: '#fff',
        border: 'none',
        borderRadius: 50,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    // Footer
    footer: {
        textAlign: 'center' as const,
        padding: '20px',
        color: '#aaa',
        fontSize: 12,
        borderTop: '1px solid #eee',
        background: '#fff',
    },
    // Promotion Modal
    modalOverlay: {
        position: 'fixed' as const,
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    modalContent: {
        background: '#fff',
        borderRadius: 20,
        padding: '24px',
        maxWidth: 520,
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto' as const,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        position: 'relative' as const,
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalClose: {
        background: 'none',
        border: 'none',
        fontSize: 20,
        color: '#aaa',
        cursor: 'pointer',
        padding: '4px 8px',
    },
    productList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 10,
        maxHeight: 320,
        overflowY: 'auto' as const,
        marginBottom: 16,
    },
    productRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: '#f9fafb',
        borderRadius: 12,
        border: '1px solid #f0f0f0',
    },
    qtyControl: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    qtyBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        border: '1px solid #d9d9d9',
        background: '#fff',
        fontSize: 16,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#555',
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    qtyInput: {
        width: 44,
        height: 30,
        borderRadius: 8,
        border: '1px solid #d9d9d9',
        textAlign: 'center' as const,
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Be Vietnam Pro', sans-serif",
        outline: 'none',
    },
    promoSummary: {
        background: 'linear-gradient(135deg, #f0faff 0%, #e8f7fc 100%)',
        borderRadius: 12,
        padding: '12px 16px',
        border: '1px solid rgba(35,167,211,0.15)',
        fontSize: 14,
    },
};

export default PortalDashboardPage;
