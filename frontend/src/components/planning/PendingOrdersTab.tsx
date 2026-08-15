import React, { useState } from 'react';
import { Table, Button, Tag, Space, Modal, message, DatePicker, Input, Tooltip, Progress } from 'antd';
import { AlertOutlined, TruckOutlined, FilterOutlined, SearchOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import api from '../../utils/api';

dayjs.extend(isBetween);
const { RangePicker } = DatePicker;

interface PendingOrdersTabProps {
    pendingOrders: any[];
    selectedRowKeys: React.Key[];
    onSelectedRowKeysChange: (keys: React.Key[]) => void;
    onCreatePlan: () => void;
    isMobile: boolean;
    loading: boolean;
    setLoading: (v: boolean) => void;
    onRefresh: () => void;
}

const PendingOrdersTab: React.FC<PendingOrdersTabProps> = ({
    pendingOrders, selectedRowKeys, onSelectedRowKeysChange, onCreatePlan, isMobile, loading, setLoading, onRefresh
}) => {
    const [deliveryDateRange, setDeliveryDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');

    const handleFulfillStock = async (order: any) => {
        // Chỉ gửi items có CONFIRMED booking hoặc có đủ tồn kho khả dụng
        const eligibleItems = order.items.filter((i: any) => {
            if (i.booking_status === 'CONFIRMED') return true;
            const available = Number(i.available_stock || 0);
            return available >= Number(i.quantity);
        });

        if (eligibleItems.length === 0) {
            message.warning('Không có sản phẩm nào đủ điều kiện xuất kho (cần booking đã duyệt hoặc tồn kho khả dụng đủ)');
            return;
        }

        Modal.confirm({
            title: `Xuất kho cho đơn ${order.order_code}?`,
            content: (
                <div>
                    <p>Hệ thống sẽ tạo Phiếu Xuất Kho cho <b>{eligibleItems.length}/{order.items.length}</b> sản phẩm đủ điều kiện.</p>
                    <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', marginTop: 8 }}>
                        {eligibleItems.map((i: any, idx: number) => (
                            <div key={idx} style={{ fontSize: 13 }}>
                                ✅ <b>{i.sku}</b> — SL: {Number(i.quantity).toLocaleString()}
                                {i.booking_status === 'CONFIRMED' && <Tag color="green" style={{ margin: '0 0 0 6px', fontSize: 10 }}>Đã book</Tag>}
                            </div>
                        ))}
                    </div>
                    {eligibleItems.length < order.items.length && (
                        <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', marginTop: 8 }}>
                            <b>⚠️ Các SP bị bỏ qua (thiếu kho / chưa book):</b>
                            {order.items.filter((i: any) => !eligibleItems.includes(i)).map((i: any, idx: number) => (
                                <div key={idx} style={{ fontSize: 12, color: '#d46b08' }}>• {i.sku} — Cần: {Number(i.quantity).toLocaleString()}, TK khả dụng: {Number(i.available_stock || 0).toLocaleString()}</div>
                            ))}
                        </div>
                    )}
                </div>
            ),
            okText: 'Xuất kho',
            cancelText: 'Hủy',
            onOk: async () => {
                setLoading(true);
                try {
                    const deliveryItems = eligibleItems.map((i: any) => ({
                        sku: i.sku,
                        quantity: i.quantity,
                        note: 'Xuất kho từ Lập Kế Hoạch'
                    }));
                    const payload = {
                        code: `PX-${order.order_code}-${dayjs().format('HHmm')}`,
                        date: new Date().toISOString(),
                        note: 'Xuất nhanh từ Planning Center',
                        delivery_address: order.shipping_address,
                        contact_name: order.receiver_name,
                        contact_phone: order.receiver_phone,
                        items: deliveryItems
                    };
                    await api.post(`/sales/${order.id}/delivery`, payload);
                    message.success(`Đã tạo phiếu xuất kho (${eligibleItems.length} SP)`);
                    onRefresh();
                } catch (e: any) {
                    const errMsg = e.response?.data?.message || 'Lỗi khi xuất kho';
                    message.error(errMsg);
                }
                setLoading(false);
            }
        });
    };

    const readyCount = pendingOrders.filter(o => o.can_fulfill_stock).length;

    const pendingColumns = [
        {
            title: 'Mã Đơn', dataIndex: 'order_code', width: 140,
            render: (t: any) => <b style={{ color: '#1d39c4' }}>{t}</b>
        },
        {
            title: 'Khách Hàng', dataIndex: 'customer_name', ellipsis: true,
            render: (t: any, r: any) => <span style={{ fontWeight: 500 }}>{t || r.customer?.name}</span>
        },
        {
            title: 'Trạng Thái', dataIndex: 'status', width: 160, align: 'center' as const,
            render: (t: any, r: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <Tag>{t}</Tag>
                    {r.can_fulfill_stock && <Tag color="green" icon={<CheckCircleOutlined />}>Sẵn sàng xuất</Tag>}
                </div>
            )
        },
        {
            title: 'Ngày Giao', dataIndex: 'delivery_date', width: 120, align: 'center' as const,
            render: (t: any) => {
                if (!t) return <span style={{ color: '#bbb' }}>—</span>;
                const d = dayjs(t);
                const daysLeft = d.diff(dayjs(), 'day');
                const color = daysLeft < 0 ? '#f5222d' : daysLeft <= 7 ? '#fa8c16' : '#52c41a';
                return (
                    <Tooltip title={`Còn ${daysLeft} ngày`}>
                        <Tag color={daysLeft < 0 ? 'red' : daysLeft <= 7 ? 'orange' : 'default'}>{d.format('DD/MM/YYYY')}</Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Giá Trị', dataIndex: 'total_amount', align: 'right' as const, width: 130,
            render: (v: any) => <b>{Number(v || 0).toLocaleString()}</b>
        },
        {
            title: 'Thao tác', width: 130, align: 'center' as const,
            render: (_: any, r: any) => {
                if (!r.can_fulfill_stock && !r.has_pending_export) return null;
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        {r.can_fulfill_stock && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<TruckOutlined />}
                                onClick={() => handleFulfillStock(r)}
                                disabled={r.has_pending_export}
                                style={
                                    r.has_pending_export
                                        ? { borderRadius: 6, fontWeight: 500, opacity: 0.6 }
                                        : { background: 'linear-gradient(135deg, #52c41a, #389e0d)', border: 'none', borderRadius: 6, fontWeight: 500 }
                                }
                            >
                                Xuất Kho
                            </Button>
                        )}
                        {r.has_pending_export && (
                            <Tag color="warning" style={{ margin: 0, borderRadius: 4, fontSize: 11 }}>
                                Chờ kho xác nhận
                            </Tag>
                        )}
                    </div>
                );
            }
        }
    ];

    const expandedRowRender = (record: any) => (
        <div style={{ padding: '8px 0' }}>
            <Table
                dataSource={record.items}
                rowKey="id"
                pagination={false}
                size="small"
                expandable={{
                    expandedRowRender: (item: any) => {
                        if (!item.combo_components || item.combo_components.length === 0) return null;
                        return (
                            <div style={{ margin: '8px 16px', padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px dashed #d9d9d9' }}>
                                <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>
                                    <InfoCircleOutlined style={{ marginRight: 6 }} />
                                    <b>Thành phần Combo:</b> Dùng để xem chi tiết tồn kho các sản phẩm con phục vụ việc duyệt book hàng
                                </div>
                                <Table
                                    dataSource={item.combo_components}
                                    rowKey={(r) => r.child_product?.sku || r.sku || Math.random().toString()}
                                    pagination={false}
                                    size="small"
                                    columns={[
                                        {
                                            title: 'Sản phẩm con', dataIndex: ['child_product', 'name'],
                                            render: (t: any, r: any) => (
                                                <span>
                                                    <b style={{ color: '#531dab' }}>{r.child_product?.sku || r.sku}</b>
                                                    <span style={{ color: '#666', marginLeft: 6 }}>{t || r.child_product?.name || r.name}</span>
                                                </span>
                                            )
                                        },
                                        {
                                            title: 'SL Cần', align: 'center' as const, width: 80,
                                            render: (_: any, r: any) => {
                                                const qtyPerCombo = Number(r.quantity || 1);
                                                const totalNeeded = qtyPerCombo * Number(item.quantity || 0);
                                                return <b>{totalNeeded.toLocaleString()}</b>;
                                            }
                                        },
                                        {
                                            title: 'TK Thực tế', align: 'center' as const, width: 100,
                                            render: (_: any, r: any) => <span style={{ fontWeight: 500 }}>{Number(r.child_product?.quantity_in_stock || 0).toLocaleString()}</span>
                                        },
                                        {
                                            title: 'Booking đã duyệt', align: 'center' as const, width: 130,
                                            render: (_: any, r: any) => {
                                                const v = Number(r.child_product?.approved_booking_stock || 0);
                                                return v > 0 ? <Tag color="orange">{v.toLocaleString()}</Tag> : <span style={{ color: '#bbb' }}>0</span>;
                                            }
                                        },
                                        {
                                            title: 'TK Khả dụng', align: 'center' as const, width: 120,
                                            render: (_: any, r: any) => {
                                                const available = Math.max(0, Number(r.child_product?.quantity_in_stock || 0) - Number(r.child_product?.approved_booking_stock || 0));
                                                const needed = Number(r.quantity || 1) * Number(item.quantity || 0);
                                                const sufficient = available >= needed;
                                                return (
                                                    <span style={{ fontWeight: 'bold', color: sufficient ? '#52c41a' : '#f5222d' }}>
                                                        {available.toLocaleString()}
                                                        {sufficient
                                                            ? <CheckCircleOutlined style={{ marginLeft: 4, fontSize: 12 }} />
                                                            : <WarningOutlined style={{ marginLeft: 4, fontSize: 12 }} />
                                                        }
                                                    </span>
                                                );
                                            }
                                        },
                                        {
                                            title: 'Đánh giá', align: 'center' as const, width: 110,
                                            render: (_: any, r: any) => {
                                                const available = Math.max(0, Number(r.child_product?.quantity_in_stock || 0) - Number(r.child_product?.approved_booking_stock || 0));
                                                const needed = Number(r.quantity || 1) * Number(item.quantity || 0);
                                                if (item.booking_status === 'CONFIRMED') return <Tag color="green" icon={<CheckCircleOutlined />}>Sẵn sàng</Tag>;
                                                if (available >= needed) return <Tag color="cyan" icon={<CheckCircleOutlined />}>Đủ kho</Tag>;
                                                return <Tag color="red" icon={<WarningOutlined />}>Thiếu {(needed - available).toLocaleString()}</Tag>;
                                            }
                                        }
                                    ]}
                                />
                            </div>
                        );
                    },
                    rowExpandable: (item: any) => item.combo_components && item.combo_components.length > 0
                }}
                columns={[
                    {
                        title: 'Sản phẩm', dataIndex: ['product', 'name'], width: '25%',
                        render: (t: any, r: any) => (
                            <span>
                                <b style={{ color: '#1d39c4' }}>{r.sku}</b>
                                <span style={{ color: '#666', marginLeft: 6 }}>{t || r.sku}</span>
                            </span>
                        )
                    },
                    {
                        title: 'SL Đặt', dataIndex: 'quantity', align: 'center' as const, width: 80,
                        render: (v: any) => <b>{Number(v || 0).toLocaleString()}</b>
                    },
                    {
                        title: 'TK Thực tế', dataIndex: 'total_stock', align: 'center' as const, width: 100,
                        render: (v: any) => <span style={{ fontWeight: 500 }}>{Number(v || 0).toLocaleString()}</span>
                    },
                    {
                        title: 'Booking đã duyệt', dataIndex: 'approved_booking_stock', align: 'center' as const, width: 130,
                        render: (v: any) => v > 0 ? <Tag color="orange">{Number(v || 0).toLocaleString()}</Tag> : <span style={{ color: '#bbb' }}>0</span>
                    },
                    {
                        title: 'TK Khả dụng', align: 'center' as const, width: 120,
                        render: (_: any, r: any) => {
                            const available = Number(r.available_stock || 0);
                            const needed = Number(r.quantity || 0);
                            const sufficient = available >= needed;
                            return (
                                <span style={{ fontWeight: 'bold', color: sufficient ? '#52c41a' : '#f5222d' }}>
                                    {available.toLocaleString()}
                                    {sufficient
                                        ? <CheckCircleOutlined style={{ marginLeft: 4, fontSize: 12 }} />
                                        : <WarningOutlined style={{ marginLeft: 4, fontSize: 12 }} />
                                    }
                                </span>
                            );
                        }
                    },
                    {
                        title: 'Booking', dataIndex: 'booking_status', align: 'center' as const, width: 110,
                        render: (s: any) => {
                            if (s === 'CONFIRMED') return <Tag color="green">Đã duyệt</Tag>;
                            if (s === 'TEMPORARY') return <Tag color="orange">Chờ duyệt</Tag>;
                            return <Tag>Chưa book</Tag>;
                        }
                    },
                    {
                        title: 'Đánh giá', align: 'center' as const, width: 110,
                        render: (_: any, r: any) => {
                            const available = Number(r.available_stock || 0);
                            const needed = Number(r.quantity || 0);
                            if (r.booking_status === 'CONFIRMED') return <Tag color="green" icon={<CheckCircleOutlined />}>Sẵn sàng</Tag>;
                            if (available >= needed) return <Tag color="cyan" icon={<CheckCircleOutlined />}>Đủ kho</Tag>;
                            return <Tag color="red" icon={<WarningOutlined />}>Thiếu {(needed - available).toLocaleString()}</Tag>;
                        }
                    }
                ]}
            />
        </div>
    );

    const filteredOrders = pendingOrders.filter(o => {
        let matchDate = true;
        if (deliveryDateRange && deliveryDateRange[0] && deliveryDateRange[1]) {
            if (!o.delivery_date) matchDate = false;
            else matchDate = dayjs(o.delivery_date).isBetween(deliveryDateRange[0], deliveryDateRange[1], 'day', '[]');
        }
        
        let matchCustomer = true;
        if (customerSearch) {
            const cName = o.customer_name || o.customer?.name || '';
            matchCustomer = cName.toLowerCase().includes(customerSearch.toLowerCase()) || (o.order_code || '').toLowerCase().includes(customerSearch.toLowerCase());
        }

        return matchDate && matchCustomer;
    });

    return (
        <div>
            {/* Stats bar */}
            <div style={{
                marginBottom: 12,
                background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #91d5ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8
            }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1d39c4' }}>
                        <AlertOutlined style={{ marginRight: 6 }} />
                        Tổng: <b>{filteredOrders.length}</b> đơn chờ
                    </span>
                    {readyCount > 0 && (
                        <Tag color="green" style={{ fontSize: 13, padding: '2px 10px', borderRadius: 12 }}>
                            <CheckCircleOutlined /> {readyCount} sẵn sàng xuất kho
                        </Tag>
                    )}
                </div>
                <Space wrap size={8}>
                    <Input.Search
                        placeholder="Tìm KH hoặc Mã SO..."
                        allowClear
                        size="small"
                        prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        style={{ width: isMobile ? '100%' : 220, borderRadius: 6 }}
                    />
                    <RangePicker
                        size="small"
                        format="DD/MM/YYYY"
                        value={deliveryDateRange}
                        onChange={(dates) => setDeliveryDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                        allowClear
                        placeholder={['Từ ngày', 'Đến ngày']}
                        style={{ width: isMobile ? '100%' : 240, borderRadius: 6 }}
                    />
                </Space>
            </div>

            <Table
                rowSelection={{ selectedRowKeys, onChange: (keys) => onSelectedRowKeysChange(keys) }}
                dataSource={filteredOrders}
                columns={pendingColumns}
                rowKey="id"
                expandable={{ expandedRowRender }}
                scroll={{ x: isMobile ? 800 : undefined }}
                size="middle"
                rowClassName={(record: any) => record.can_fulfill_stock ? 'row-ready-ship' : ''}
                footer={() => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#666', fontSize: 13 }}>
                            <InfoCircleOutlined /> Chọn đơn hàng để gom lập kế hoạch sản xuất
                        </span>
                        <Button
                            type="primary"
                            disabled={selectedRowKeys.length === 0}
                            onClick={onCreatePlan}
                            style={{ borderRadius: 6, fontWeight: 500 }}
                        >
                            Lập Kế Hoạch ({selectedRowKeys.length})
                        </Button>
                    </div>
                )}
            />

            <style>{`
                .row-ready-ship td { background: #f6ffed !important; }
                .row-ready-ship:hover td { background: #d9f7be !important; }
            `}</style>
        </div>
    );
};

export default PendingOrdersTab;
