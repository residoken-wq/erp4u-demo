import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Modal, message, Space, Tooltip, Badge, Tabs, Select, DatePicker } from 'antd';
import { SyncOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, FacebookOutlined, ShopOutlined, TikTokOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface SocialOrder {
    id: number;
    platform: string;
    platform_order_id: string;
    platform_order_code: string;
    buyer_name: string;
    buyer_phone: string;
    shipping_address: string;
    total_amount: number;
    shipping_fee: number;
    sync_status: string;
    platform_status: string;
    sales_order_id: number;
    items: any[];
    created_at: string;
    channel: any;
    sales_order: any;
}

const SocialOrdersPage: React.FC = () => {
    const [orders, setOrders] = useState<SocialOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<SocialOrder | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [platformFilter, setPlatformFilter] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<string | undefined>();

    const fetchOrders = async () => {
        setLoading(true);
        try {
            let url = `${API_URL}/social/orders`;
            const params = new URLSearchParams();
            if (platformFilter) params.append('platform', platformFilter);
            if (statusFilter) params.append('status', statusFilter);
            if (params.toString()) url += `?${params.toString()}`;

            const res = await axios.get(url);
            setOrders(res.data);
        } catch (e) {
            message.error('Lỗi tải đơn hàng');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, [platformFilter, statusFilter]);

    const handleSync = async (orderId: number) => {
        try {
            await axios.post(`${API_URL}/social/orders/${orderId}/sync`);
            message.success('Đồng bộ thành công');
            fetchOrders();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi đồng bộ');
        }
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'FACEBOOK': return <FacebookOutlined style={{ color: '#1877F2' }} />;
            case 'SHOPEE': return <ShopOutlined style={{ color: '#EE4D2D' }} />;
            case 'TIKTOK': return <TikTokOutlined style={{ color: '#000' }} />;
            default: return <ShoppingCartOutlined />;
        }
    };

    const getSyncStatusTag = (status: string) => {
        switch (status) {
            case 'SYNCED': return <Tag color="success" icon={<CheckCircleOutlined />}>Đã đồng bộ</Tag>;
            case 'PENDING': return <Tag color="warning">Chờ xử lý</Tag>;
            case 'FAILED': return <Tag color="error" icon={<CloseCircleOutlined />}>Lỗi</Tag>;
            default: return <Tag>{status}</Tag>;
        }
    };

    const columns = [
        {
            title: 'Nguồn',
            dataIndex: 'platform',
            width: 100,
            render: (platform: string) => (
                <Space>{getPlatformIcon(platform)} {platform}</Space>
            ),
        },
        {
            title: 'Mã đơn',
            dataIndex: 'platform_order_code',
            width: 150,
            render: (code: string) => <strong>{code}</strong>,
        },
        {
            title: 'Khách hàng',
            key: 'customer',
            render: (_: any, record: SocialOrder) => (
                <div>
                    <div>{record.buyer_name}</div>
                    <small style={{ color: '#999' }}>{record.buyer_phone}</small>
                </div>
            ),
        },
        {
            title: 'Tổng tiền',
            dataIndex: 'total_amount',
            width: 120,
            align: 'right' as const,
            render: (v: number) => (
                <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
                    {Number(v).toLocaleString()}₫
                </span>
            ),
        },
        {
            title: 'Trạng thái Platform',
            dataIndex: 'platform_status',
            width: 140,
            render: (status: string) => <Tag>{status}</Tag>,
        },
        {
            title: 'Đồng bộ',
            dataIndex: 'sync_status',
            width: 130,
            render: (status: string) => getSyncStatusTag(status),
        },
        {
            title: 'Mã SO',
            key: 'sales_order',
            width: 140,
            render: (_: any, record: SocialOrder) => (
                record.sales_order ? (
                    <Tag color="blue">{record.sales_order.order_code}</Tag>
                ) : '-'
            ),
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'created_at',
            width: 160,
            render: (date: string) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: '',
            key: 'actions',
            width: 120,
            render: (_: any, record: SocialOrder) => (
                <Space>
                    <Tooltip title="Xem chi tiết">
                        <Button
                            icon={<EyeOutlined />}
                            size="small"
                            onClick={() => {
                                setSelectedOrder(record);
                                setDetailModalOpen(true);
                            }}
                        />
                    </Tooltip>
                    {record.sync_status === 'PENDING' && (
                        <Tooltip title="Đồng bộ về SO">
                            <Button
                                icon={<SyncOutlined />}
                                size="small"
                                type="primary"
                                onClick={() => handleSync(record.id)}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={<span><ShoppingCartOutlined /> Đơn hàng từ Social</span>}
            extra={
                <Space>
                    <Select
                        placeholder="Nền tảng"
                        allowClear
                        style={{ width: 140 }}
                        value={platformFilter}
                        onChange={setPlatformFilter}
                    >
                        <Option value="FACEBOOK">Facebook</Option>
                        <Option value="SHOPEE">Shopee</Option>
                        <Option value="TIKTOK">TikTok</Option>
                    </Select>
                    <Select
                        placeholder="Trạng thái"
                        allowClear
                        style={{ width: 140 }}
                        value={statusFilter}
                        onChange={setStatusFilter}
                    >
                        <Option value="PENDING">Chờ xử lý</Option>
                        <Option value="SYNCED">Đã đồng bộ</Option>
                        <Option value="FAILED">Lỗi</Option>
                    </Select>
                    <Button icon={<SyncOutlined />} onClick={fetchOrders}>
                        Làm mới
                    </Button>
                </Space>
            }
        >
            <Table
                dataSource={orders}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="small"
                pagination={{ pageSize: 20 }}
            />

            <Modal
                title={`Chi tiết đơn: ${selectedOrder?.platform_order_code}`}
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
                width={700}
            >
                {selectedOrder && (
                    <div>
                        <Tabs items={[
                            {
                                key: '1',
                                label: 'Thông tin',
                                children: (
                                    <div>
                                        <p><strong>Nền tảng:</strong> {selectedOrder.platform}</p>
                                        <p><strong>Mã đơn:</strong> {selectedOrder.platform_order_code}</p>
                                        <p><strong>Khách hàng:</strong> {selectedOrder.buyer_name}</p>
                                        <p><strong>SĐT:</strong> {selectedOrder.buyer_phone}</p>
                                        <p><strong>Địa chỉ:</strong> {selectedOrder.shipping_address}</p>
                                        <p><strong>Tổng tiền:</strong> {Number(selectedOrder.total_amount).toLocaleString()}₫</p>
                                        <p><strong>Phí ship:</strong> {Number(selectedOrder.shipping_fee).toLocaleString()}₫</p>
                                    </div>
                                ),
                            },
                            {
                                key: '2',
                                label: 'Sản phẩm',
                                children: selectedOrder.items?.length ? (
                                    <Table
                                        dataSource={selectedOrder.items}
                                        columns={[
                                            { title: 'SKU', dataIndex: 'sku' },
                                            { title: 'Tên', dataIndex: 'name' },
                                            { title: 'SL', dataIndex: 'quantity', width: 60 },
                                            { title: 'Giá', dataIndex: 'price', render: (v: number) => `${Number(v).toLocaleString()}₫` },
                                        ]}
                                        rowKey="platform_item_id"
                                        size="small"
                                        pagination={false}
                                    />
                                ) : <p>Không có dữ liệu sản phẩm</p>,
                            },
                        ]} />
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default SocialOrdersPage;
