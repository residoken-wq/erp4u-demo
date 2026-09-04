// frontend/src/components/products/ProductSalesHistoryTab.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Card, Row, Col, Statistic, Empty, Button, Tooltip, Typography, Space } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, FileTextOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';

const { Text } = Typography;

interface ProductSalesHistoryTabProps {
    editingItem: any;
}

const ProductSalesHistoryTab: React.FC<ProductSalesHistoryTabProps> = ({ editingItem }) => {
    const [loading, setLoading] = useState(false);
    const [salesHistory, setSalesHistory] = useState<any[]>([]);

    const fetchHistory = async () => {
        if (!editingItem?.id) return;
        setLoading(true);
        try {
            const res = await api.get(`/products/${editingItem.id}/sales-history`);
            setSalesHistory(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Lỗi tải lịch sử bán hàng:', error);
            setSalesHistory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (editingItem?.id) {
            fetchHistory();
        }
    }, [editingItem?.id]);

    const stats = useMemo(() => {
        let totalQty = 0;
        let totalRevenue = 0;
        const uniqueOrders = new Set<string>();

        salesHistory.forEach(item => {
            const qty = Number(item.quantity || 0);
            const total = Number(item.total_price || (qty * Number(item.unit_price || 0)));
            totalQty += qty;
            totalRevenue += total;
            if (item.order_code) uniqueOrders.add(item.order_code);
        });

        return {
            totalQty,
            totalRevenue,
            totalOrders: uniqueOrders.size
        };
    }, [salesHistory]);

    const getStatusTag = (status: string) => {
        const map: Record<string, { color: string; label: string }> = {
            QUOTATION: { color: 'default', label: 'Báo giá' },
            SO_PENDING: { color: 'orange', label: 'Chờ duyệt' },
            SAMPLE_APPROVED: { color: 'blue', label: 'Duyệt mẫu' },
            DEPOSITED: { color: 'cyan', label: 'Đã cọc' },
            IN_PRODUCTION: { color: 'geekblue', label: 'Đang SX' },
            PLANNED: { color: 'purple', label: 'Đã lên kế hoạch' },
            PARTIAL_DELIVERY: { color: 'gold', label: 'Giao một phần' },
            DELIVERED: { color: 'green', label: 'Đã giao hàng' },
            COMPLETED: { color: '#52c41a', label: 'Hoàn thành' },
            CANCELLED: { color: 'red', label: 'Đã hủy' }
        };
        const config = map[status] || { color: 'default', label: status || 'N/A' };
        return <Tag color={config.color} style={{ margin: 0, fontWeight: 500 }}>{config.label}</Tag>;
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => <span style={{ color: '#8c8c8c' }}>{index + 1}</span>
        },
        {
            title: 'Mã đơn hàng (SO)',
            dataIndex: 'order_code',
            width: 180,
            render: (orderCode: string, record: any) => (
                <div>
                    <Space size={4}>
                        <FileTextOutlined style={{ color: '#1890ff' }} />
                        <b style={{ color: '#1890ff' }}>{orderCode}</b>
                    </Space>
                    {record.order_date && (
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {dayjs(record.order_date).format('DD/MM/YYYY HH:mm')}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Tên Khách Hàng',
            dataIndex: 'customer_name',
            render: (name: string) => (
                <span style={{ fontWeight: 500, color: '#262626' }}>
                    {name || 'Khách vãng lai'}
                </span>
            )
        },
        {
            title: 'SL Đặt Hàng',
            dataIndex: 'quantity',
            width: 120,
            align: 'right' as const,
            render: (qty: number) => (
                <b style={{ color: '#096dd9' }}>
                    {Number(qty || 0).toLocaleString()}
                </b>
            )
        },
        {
            title: 'Đơn Giá',
            dataIndex: 'unit_price',
            width: 130,
            align: 'right' as const,
            render: (price: number) => (
                <span>
                    {Number(price || 0).toLocaleString()} ₫
                </span>
            )
        },
        {
            title: 'Tổng Tiền',
            dataIndex: 'total_price',
            width: 150,
            align: 'right' as const,
            render: (total: number, record: any) => {
                const calculated = Number(total || 0) > 0 ? Number(total) : Number(record.quantity || 0) * Number(record.unit_price || 0);
                return (
                    <span style={{ color: '#cf1322', fontWeight: 600 }}>
                        {calculated.toLocaleString()} ₫
                    </span>
                );
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 130,
            align: 'center' as const,
            render: (status: string) => getStatusTag(status)
        },
        {
            title: 'Ngày giao',
            dataIndex: 'delivery_date',
            width: 110,
            align: 'center' as const,
            render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : <span style={{ color: '#ccc' }}>—</span>
        }
    ];

    return (
        <div style={{ padding: '8px 0' }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                    <Card size="small" bordered style={{ background: '#f6ffed', borderColor: '#b7eb8f', borderRadius: 8 }}>
                        <Statistic
                            title={<span style={{ color: '#389e0d', fontWeight: 600 }}>Tổng Số Lượng Đã Bán</span>}
                            value={stats.totalQty}
                            prefix={<ShoppingCartOutlined style={{ color: '#52c41a' }} />}
                            suffix={editingItem?.unit || 'cái'}
                            valueStyle={{ color: '#389e0d', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small" bordered style={{ background: '#e6f7ff', borderColor: '#91d5ff', borderRadius: 8 }}>
                        <Statistic
                            title={<span style={{ color: '#096dd9', fontWeight: 600 }}>Tổng Doanh Thu</span>}
                            value={stats.totalRevenue}
                            prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
                            suffix="₫"
                            valueStyle={{ color: '#096dd9', fontWeight: 'bold' }}
                            formatter={val => Number(val).toLocaleString()}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small" bordered style={{ background: '#fff7e6', borderColor: '#ffd591', borderRadius: 8 }}>
                        <Statistic
                            title={<span style={{ color: '#d46b08', fontWeight: 600 }}>Tổng Số Đơn Hàng (SO)</span>}
                            value={stats.totalOrders}
                            prefix={<FileTextOutlined style={{ color: '#fa8c16' }} />}
                            suffix="đơn"
                            valueStyle={{ color: '#d46b08', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14 }}>
                    Danh Sách Các Đơn Hàng Đã Đặt Sản Phẩm: <b style={{ color: '#1890ff' }}>{editingItem?.sku}</b>
                </Text>
                <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={fetchHistory}
                    loading={loading}
                >
                    Làm mới
                </Button>
            </div>

            <Table
                dataSource={salesHistory}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="middle"
                bordered
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50'],
                    showTotal: (total) => `Tổng số ${total} đơn hàng`
                }}
                locale={{
                    emptyText: <Empty description="Chưa có đơn hàng nào bán sản phẩm này" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                }}
            />
        </div>
    );
};

export default ProductSalesHistoryTab;
